import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';

import type { AppConfig } from '../../config/env.validation';
import { PrismaService } from '../../shared/database/prisma.service';

import { buildAiJobIdempotencyKey } from './ai-idempotency';
import {
  AI_JOB_QUEUE,
  AI_JOB_STAGE_COUNT,
  AI_PIPELINE_VERSION,
  AI_STAGE_PROGRESS,
} from './ai.constants';
import {
  AI_JOB_OWNERSHIP_MISMATCH,
  aiDocumentNotFound,
  aiJobEnqueueFailed,
  aiJobNotFound,
} from './ai.errors';
import type {
  AiJobPayload,
  AiJobProcessingContext,
  AiJobRecord,
  CreateAiJobInput,
} from './ai-job.types';

const JOB_SELECT = {
  id: true,
  type: true,
  status: true,
  progress: true,
  stageIndex: true,
  attempts: true,
  maxAttempts: true,
  pipelineVersion: true,
  errorCode: true,
  resultJson: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
    @InjectQueue(AI_JOB_QUEUE) private readonly queue: Queue<AiJobPayload>,
  ) {}

  /**
   * Creates a job and hands it to the queue. Repeating the same logical request
   * returns the existing job instead of queueing duplicate processing.
   */
  async create(input: CreateAiJobInput): Promise<AiJobRecord> {
    const documentIds = [...new Set(input.documentIds)].sort();
    const idempotencyKey = buildAiJobIdempotencyKey({
      type: input.type,
      pipelineVersion: AI_PIPELINE_VERSION,
      documentIds,
    });

    const existing = await this.prisma.aiJob.findUnique({
      where: {
        ai_job_user_idempotency_key: { userId: input.userId, idempotencyKey },
      },
      select: JOB_SELECT,
    });
    if (existing) {
      return existing;
    }

    let created: AiJobRecord;
    try {
      // Ownership is re-checked inside the same transaction as the insert, so a
      // job can never come into existence referencing a document the caller
      // does not own, and no job is created when the check fails.
      created = await this.prisma.$transaction(async (tx) => {
        const owned = await tx.document.count({
          where: {
            id: { in: documentIds },
            userId: input.userId,
            deletedAt: null,
          },
        });
        if (owned !== documentIds.length) {
          throw aiDocumentNotFound();
        }

        return tx.aiJob.create({
          data: {
            userId: input.userId,
            type: input.type,
            status: 'PENDING',
            pipelineVersion: AI_PIPELINE_VERSION,
            idempotencyKey,
            // Kept in step with the queue's attempt bound so the row and Redis
            // agree on when a failure is terminal.
            maxAttempts: this.configService.get('ai', { infer: true })
              .jobAttempts,
            documents: {
              create: documentIds.map((documentId) => ({ documentId })),
            },
          },
          select: JOB_SELECT,
        });
      });
    } catch (error) {
      // Two concurrent identical requests: the loser reads the winner's job.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.aiJob.findUnique({
          where: {
            ai_job_user_idempotency_key: {
              userId: input.userId,
              idempotencyKey,
            },
          },
          select: JOB_SELECT,
        });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }

    try {
      await this.queue.add(created.type, { aiJobId: created.id }, {
        jobId: created.id,
      });
    } catch {
      // Never leave a job stranded in PENDING with nothing to process it.
      await this.prisma.aiJob.delete({ where: { id: created.id } });
      this.logger.error(`AI job enqueue failed aiJobId=${created.id}`);
      throw aiJobEnqueueFailed();
    }

    return created;
  }

  /** Every read is scoped to the owner; a foreign job is indistinguishable from a missing one. */
  async findForUser(userId: string, jobId: string): Promise<AiJobRecord> {
    const job = await this.prisma.aiJob.findFirst({
      where: { id: jobId, userId },
      select: JOB_SELECT,
    });
    if (!job) {
      throw aiJobNotFound();
    }
    return job;
  }

  /**
   * Loads everything the worker needs, re-deriving ownership from the database
   * rather than trusting the join rows: every linked document must still belong
   * to the job's owner and must not be soft-deleted.
   */
  async loadForProcessing(jobId: string): Promise<AiJobProcessingContext> {
    const job = await this.prisma.aiJob.findUniqueOrThrow({
      where: { id: jobId },
      select: {
        userId: true,
        documents: {
          orderBy: { documentId: 'asc' },
          select: {
            document: {
              select: {
                id: true,
                userId: true,
                deletedAt: true,
                storageKey: true,
                mimeType: true,
                sizeBytes: true,
                checksum: true,
              },
            },
          },
        },
      },
    });

    const documents = job.documents.map((link) => link.document);
    const consistent = documents.every(
      (document) => document.userId === job.userId && document.deletedAt === null,
    );
    if (documents.length === 0 || !consistent) {
      throw new Error(AI_JOB_OWNERSHIP_MISMATCH);
    }

    return {
      userId: job.userId,
      documents: documents.map((document) => ({
        id: document.id,
        storageKey: document.storageKey,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        checksum: document.checksum,
      })),
    };
  }

  /**
   * Moves the job into PROCESSING and consumes one attempt.
   *
   * The attempt count is taken from our own row rather than from the queue's
   * `attemptsMade`, so the bound holds regardless of redelivery semantics.
   */
  async beginAttempt(
    jobId: string,
  ): Promise<{ attempts: number; maxAttempts: number }> {
    const job = await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        // A retry restarts the stages, so progress must not appear to resume
        // from a stale value.
        progress: 0,
        stageIndex: 0,
        errorCode: null,
      },
      select: { attempts: true, maxAttempts: true, startedAt: true },
    });

    // Records when work first began; retries keep the original timestamp.
    if (!job.startedAt) {
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: { startedAt: new Date() },
      });
    }

    return { attempts: job.attempts, maxAttempts: job.maxAttempts };
  }

  async advanceStage(jobId: string, stageIndex: number): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        stageIndex,
        progress: AI_STAGE_PROGRESS[stageIndex] ?? 0,
      },
    });
  }

  async markDone(jobId: string, result: Prisma.InputJsonValue): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        progress: 100,
        stageIndex: AI_JOB_STAGE_COUNT - 1,
        resultJson: result,
        errorCode: null,
        completedAt: new Date(),
      },
    });
  }

  /** Terminal failure. `errorCode` is a stable domain code, never a stack trace. */
  async markFailed(jobId: string, errorCode: string): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorCode,
        completedAt: new Date(),
      },
    });
  }

  /** A retry is still pending, so the job stays PROCESSING and records the last error. */
  async recordRetry(jobId: string, errorCode: string): Promise<void> {
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', errorCode },
    });
  }
}

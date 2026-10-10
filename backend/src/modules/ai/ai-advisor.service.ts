import { Injectable } from '@nestjs/common';

import { AiJobsService } from './ai-jobs.service';
import type { AnalyzeAcceptedDto, AiJobStatusDto } from './dto/ai-job-response.dto';
import { mapAiJobStatus } from './mappers/ai-job.mapper';

@Injectable()
export class AiAdvisorService {
  constructor(private readonly jobs: AiJobsService) {}

  /**
   * Queues a document analysis. Ownership of every requested document is
   * verified inside the creating transaction, and repeating the same request
   * returns the existing job rather than queueing duplicate work.
   */
  async analyze(
    userId: string,
    documentIds: readonly string[],
  ): Promise<AnalyzeAcceptedDto> {
    const job = await this.jobs.create({
      userId,
      type: 'DOCUMENT_ANALYSIS',
      documentIds,
    });

    return { jobId: job.id };
  }

  async getJob(userId: string, jobId: string): Promise<AiJobStatusDto> {
    return mapAiJobStatus(await this.jobs.findForUser(userId, jobId));
  }
}

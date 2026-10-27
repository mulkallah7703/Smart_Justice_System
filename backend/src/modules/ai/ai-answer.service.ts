import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { AppError } from '../../shared/exceptions/app-error';
import { aiAnswerInvalid } from './ai.errors';
import { AiRetrievalService } from './ai-retrieval.service';
import type { AnswerQueryDto } from './dto/answer-query.dto';
import type { AnswerResponseDto } from './dto/answer-response.dto';
import type { RetrieveResultItemDto } from './dto/retrieve-response.dto';
import {
  buildEvidenceMap,
  mapAnswerResponse,
} from './mappers/answer.mapper';
import {
  ANSWER_LLM_PROVIDER,
  type LlmProvider,
} from './providers/llm-provider.interface';
import {
  asksForVerbatimPii,
  PII_REFUSAL_AR,
  redactPii,
} from './privacy/pii';
import {
  LEGAL_ANSWER_RETRY_SUFFIX,
  LEGAL_ANSWER_SYSTEM_PROMPT,
  INSUFFICIENT_EVIDENCE_ANSWER_AR,
  INSUFFICIENT_EVIDENCE_ANSWER_EN,
  answerAppearsToLeakSecrets,
  buildLegalAnswerUserPrompt,
  isPrimarilyArabic,
  type EvidenceForPrompt,
} from './prompts/legal-answer.prompt';

interface ParsedLlmAnswer {
  answer: string;
  claims: Array<{ text: string; evidenceIds: string[] }>;
  insufficientEvidence: boolean;
}

/**
 * Synchronous RAG answer generation.
 * Retrieval (Phase G) is authoritative; the LLM is not.
 */
@Injectable()
export class AiAnswerService {
  private readonly logger = new Logger(AiAnswerService.name);

  constructor(
    private readonly retrieval: AiRetrievalService,
    private readonly configService: ConfigService<AppConfig, true>,
    @Inject(ANSWER_LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async answer(
    userId: string,
    body: AnswerQueryDto,
  ): Promise<AnswerResponseDto> {
    const ai = this.configService.get('ai', { infer: true });
    const started = Date.now();

    if (asksForVerbatimPii(body.query)) {
      this.logger.warn('Answer refused: verbatim PII request');
      return {
        answer: PII_REFUSAL_AR,
        claims: [],
        insufficientEvidence: true,
        model: this.llm.name === 'mock' ? 'mock-llm-v1' : ai.llmModel,
      };
    }

    const retrieved = await this.retrieval.retrieve(userId, {
      query: body.query,
      limit: Math.min(ai.llmMaxEvidenceItems, ai.retrievalMaxLimit),
      caseId: body.caseId,
      documentIds: body.documentIds,
    });

    const budgeted = this.applyEvidenceBudget(
      retrieved.results,
      ai.llmMaxEvidenceItems,
      ai.llmMaxEvidenceChars,
    );

    if (budgeted.length === 0) {
      this.logger.log(
        `Answer insufficientEvidence=true evidenceCount=0 provider=${this.llm.name}`,
      );
      return this.insufficientResponse(body.query, this.llm.name === 'mock' ? 'mock-llm-v1' : ai.llmModel);
    }

    const evidenceMap = buildEvidenceMap(budgeted);
    const evidenceById = new Map(
      evidenceMap.map((entry) => [entry.evidenceId, entry.result]),
    );
    const promptEvidence: EvidenceForPrompt[] = evidenceMap.map((entry) => ({
      evidenceId: entry.evidenceId,
      text: entry.result.text,
    }));

    const userPrompt = buildLegalAnswerUserPrompt({
      query: body.query,
      evidence: promptEvidence,
    });

    let raw = await this.callLlm(LEGAL_ANSWER_SYSTEM_PROMPT, userPrompt);
    let parsed = this.tryParseAndValidate(raw.text, evidenceById);

    if (!parsed.ok) {
      this.logger.warn(
        `Answer validation failed; single retry reason=${parsed.reason}`,
      );
      raw = await this.callLlm(
        LEGAL_ANSWER_SYSTEM_PROMPT,
        `${userPrompt}\n${LEGAL_ANSWER_RETRY_SUFFIX}`,
      );
      parsed = this.tryParseAndValidate(raw.text, evidenceById);
      if (!parsed.ok) {
        this.logger.warn(`Answer rejected after retry reason=${parsed.reason}`);
        throw aiAnswerInvalid();
      }
    }

    const response = mapAnswerResponse({
      answer: parsed.value.answer,
      claims: parsed.value.claims,
      insufficientEvidence: parsed.value.insufficientEvidence,
      model: raw.model,
      evidenceById,
    });

    this.logger.log(
      `Answer complete evidenceCount=${budgeted.length} claims=${response.claims.length} insufficient=${response.insufficientEvidence} provider=${this.llm.name} model=${raw.model} latencyMs=${Date.now() - started}`,
    );

    return response;
  }

  private insufficientResponse(
    query: string,
    model: string,
  ): AnswerResponseDto {
    const answer = isPrimarilyArabic(query)
      ? INSUFFICIENT_EVIDENCE_ANSWER_AR
      : INSUFFICIENT_EVIDENCE_ANSWER_EN;
    return {
      answer,
      claims: [],
      insufficientEvidence: true,
      model,
    };
  }

  private applyEvidenceBudget(
    results: readonly RetrieveResultItemDto[],
    maxItems: number,
    maxChars: number,
  ): RetrieveResultItemDto[] {
    const selected: RetrieveResultItemDto[] = [];
    let chars = 0;
    for (const item of results) {
      if (selected.length >= maxItems) {
        break;
      }
      const next = chars + item.text.length;
      if (selected.length > 0 && next > maxChars) {
        break;
      }
      if (item.text.length > maxChars && selected.length === 0) {
        // Single oversized chunk: still include one full chunk (provenance intact).
        selected.push(item);
        break;
      }
      selected.push(item);
      chars = next;
    }
    return selected;
  }

  private async callLlm(systemPrompt: string, userPrompt: string) {
    try {
      return await this.llm.generateAnswer({ systemPrompt, userPrompt });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      this.logger.warn('LLM generateAnswer failed');
      throw aiAnswerInvalid();
    }
  }

  private tryParseAndValidate(
    rawText: string,
    evidenceById: Map<string, RetrieveResultItemDto>,
  ):
    | { ok: true; value: ParsedLlmAnswer }
    | { ok: false; reason: string } {
    let json: unknown;
    try {
      json = JSON.parse(rawText);
    } catch {
      return { ok: false, reason: 'malformed_json' };
    }

    if (!json || typeof json !== 'object') {
      return { ok: false, reason: 'not_object' };
    }

    const record = json as Record<string, unknown>;
    if (typeof record.answer !== 'string' || record.answer.trim().length === 0) {
      return { ok: false, reason: 'empty_answer' };
    }
    if (answerAppearsToLeakSecrets(record.answer)) {
      return { ok: false, reason: 'secret_leak' };
    }
    if (typeof record.insufficientEvidence !== 'boolean') {
      return { ok: false, reason: 'bad_insufficient_flag' };
    }
    if (!Array.isArray(record.claims)) {
      return { ok: false, reason: 'claims_not_array' };
    }

    const claims: Array<{ text: string; evidenceIds: string[] }> = [];
    for (const claim of record.claims) {
      if (!claim || typeof claim !== 'object') {
        return { ok: false, reason: 'bad_claim' };
      }
      const c = claim as Record<string, unknown>;
      if (typeof c.text !== 'string' || c.text.trim().length === 0) {
        return { ok: false, reason: 'empty_claim_text' };
      }
      if (!Array.isArray(c.evidenceIds)) {
        return { ok: false, reason: 'evidence_ids_not_array' };
      }
      const evidenceIds = c.evidenceIds;
      if (evidenceIds.length === 0) {
        return { ok: false, reason: 'uncited_claim' };
      }
      for (const id of evidenceIds) {
        if (typeof id !== 'string' || !evidenceById.has(id)) {
          return { ok: false, reason: 'unknown_evidence_id' };
        }
      }
      claims.push({
        text: c.text,
        evidenceIds: evidenceIds as string[],
      });
    }

    if (!record.insufficientEvidence && claims.length === 0) {
      // Allow insufficient-only answers without claims; otherwise require claims.
      // A non-insufficient answer with zero claims is rejected.
      return { ok: false, reason: 'no_claims' };
    }

    const answer = redactPii(record.answer.trim());
    const redactedClaims = claims.map((claim) => ({
      ...claim,
      text: redactPii(claim.text),
    }));
    // Citations and the insufficient flag describe the same outcome.
    const insufficientEvidence = redactedClaims.length === 0;

    return {
      ok: true,
      value: {
        answer: answer.length > 0 ? answer : INSUFFICIENT_EVIDENCE_ANSWER_AR,
        claims: redactedClaims,
        insufficientEvidence,
      },
    };
  }
}

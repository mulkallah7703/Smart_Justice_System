import { Injectable } from '@nestjs/common';

import { aiProviderError } from '../../ai.errors';
import type {
  LlmCompletion,
  LlmCompletionInput,
  LlmGenerateAnswerInput,
  LlmGenerateAnswerResult,
  LlmProvider,
} from '../llm-provider.interface';

import { LEGAL_GUIDE_SYSTEM_PROMPT } from '../../guide/prompts/legal-guide.prompt';

import { mockDigest, shouldMockFail } from './mock-directives';

/** Test markers recognised only by the mock answer path. */
export const MOCK_ANSWER_MALFORMED = 'mock-answer-malformed';
export const MOCK_ANSWER_UNKNOWN_CITE = 'mock-answer-unknown-cite';
export const MOCK_ANSWER_UNCITED = 'mock-answer-uncited';
export const MOCK_ANSWER_EMPTY = 'mock-answer-empty';
export const MOCK_ANSWER_INSUFFICIENT = 'mock-answer-insufficient';
export const MOCK_GUIDE_MALFORMED = 'mock-guide-malformed';

/**
 * Topic-neutral guide turn: one clarification, then guidance. It never names a legal
 * scenario, so mock sessions cannot imply a fixed questionnaire.
 */
const mockGuideTurn = (userPrompt: string): string => {
  if (userPrompt.includes(MOCK_GUIDE_MALFORMED)) {
    return 'not-json{{{';
  }
  const answerNow =
    userPrompt.includes('MUST_ANSWER_NOW: true') ||
    userPrompt.includes('[ASSISTANT (clarification question)]');
  return JSON.stringify({
    domains: ['GENERAL'],
    understanding: 'ملخص تجريبي لمسألة المستخدم (وضع الاختبار).',
    knownFacts: ['وصف المستخدم لمسألته'],
    missingFacts: answerNow ? [] : ['تفاصيل ما حدث'],
    needsClarification: !answerNow,
    clarificationQuestion: answerNow ? null : 'هل يمكنك توضيح ما حدث بالتفصيل؟',
    suggestedReplies: [],
    guidance: answerNow ? 'إرشاد تجريبي عام (وضع الاختبار).' : null,
    nextSteps: answerNow ? ['راجع مختصاً عند الحاجة.'] : [],
    suggestedDocuments: answerNow ? ['المستندات المتوفرة لديك'] : [],
    likelyAuthority: null,
    uncertainty: answerNow ? 'لا تتوفر مصادر نظامية موثقة.' : null,
    urgent: false,
  });
};

const extractEvidenceIds = (userPrompt: string): string[] => {
  const ids = new Set<string>();
  const re = /BEGIN EVIDENCE (E\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(userPrompt)) !== null) {
    ids.add(match[1]!);
  }
  return [...ids];
};

/**
 * DEVELOPMENT/TEST ONLY. No network. Deterministic outputs for CI.
 * Refused in production via AI_LLM_MODE / AI_PROVIDER_MODE validation.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  complete(input: LlmCompletionInput): Promise<LlmCompletion> {
    if (shouldMockFail('llm', input.untrustedContext)) {
      return Promise.reject(aiProviderError());
    }

    const digest = mockDigest(input.instruction, ...input.untrustedContext);

    return Promise.resolve({
      text: `MOCK_LLM_OUTPUT:${digest.slice(0, 32)}`,
      promptTokens: input.untrustedContext.join('').length,
      completionTokens: 32,
      model: 'mock-llm-v1',
    });
  }

  generateAnswer(
    input: LlmGenerateAnswerInput,
  ): Promise<LlmGenerateAnswerResult> {
    if (shouldMockFail('llm', [input.userPrompt, input.systemPrompt])) {
      return Promise.reject(aiProviderError());
    }

    const prompt = input.userPrompt;
    if (input.systemPrompt === LEGAL_GUIDE_SYSTEM_PROMPT) {
      const guideText = mockGuideTurn(prompt);
      return Promise.resolve({
        text: guideText,
        model: 'mock-llm-v1',
        promptTokens: prompt.length,
        completionTokens: guideText.length,
      });
    }

    const evidenceIds = extractEvidenceIds(prompt);
    const firstId = evidenceIds[0] ?? 'E1';

    let text: string;

    if (prompt.includes(MOCK_ANSWER_MALFORMED)) {
      text = 'not-json{{{';
    } else if (prompt.includes(MOCK_ANSWER_EMPTY)) {
      text = JSON.stringify({
        answer: '',
        claims: [],
        insufficientEvidence: false,
      });
    } else if (prompt.includes(MOCK_ANSWER_UNKNOWN_CITE)) {
      text = JSON.stringify({
        answer: 'Unsupported cite.',
        claims: [{ text: 'Claim', evidenceIds: ['E999'] }],
        insufficientEvidence: false,
      });
    } else if (prompt.includes(MOCK_ANSWER_UNCITED)) {
      text = JSON.stringify({
        answer: 'Uncited claim answer.',
        claims: [{ text: 'Claim without evidence', evidenceIds: [] }],
        insufficientEvidence: false,
      });
    } else if (prompt.includes(MOCK_ANSWER_INSUFFICIENT) || evidenceIds.length === 0) {
      text = JSON.stringify({
        answer:
          'The available documents do not provide enough reliable information.',
        claims: [],
        insufficientEvidence: true,
      });
    } else {
      text = JSON.stringify({
        answer: `Based on the supplied documents (${firstId}).`,
        claims: [
          {
            text: 'Document-supported statement.',
            evidenceIds: [firstId],
          },
        ],
        insufficientEvidence: false,
      });
    }

    return Promise.resolve({
      text,
      model: 'mock-llm-v1',
      promptTokens: prompt.length,
      completionTokens: text.length,
    });
  }
}

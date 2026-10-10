import { buildAiJobIdempotencyKey } from '../src/modules/ai/ai-idempotency';
import {
  AI_JOB_STAGES,
  AI_PIPELINE_VERSION,
} from '../src/modules/ai/ai.constants';

const base = {
  type: 'DOCUMENT_ANALYSIS' as const,
  pipelineVersion: AI_PIPELINE_VERSION,
  documentIds: ['doc-b', 'doc-a'],
};

describe('AI job idempotency key', () => {
  it('is stable for the same logical request', () => {
    expect(buildAiJobIdempotencyKey(base)).toBe(
      buildAiJobIdempotencyKey(base),
    );
  });

  it('ignores document order', () => {
    expect(
      buildAiJobIdempotencyKey({ ...base, documentIds: ['doc-a', 'doc-b'] }),
    ).toBe(buildAiJobIdempotencyKey({ ...base, documentIds: ['doc-b', 'doc-a'] }));
  });

  it('ignores duplicate document ids', () => {
    expect(
      buildAiJobIdempotencyKey({
        ...base,
        documentIds: ['doc-a', 'doc-b', 'doc-a'],
      }),
    ).toBe(buildAiJobIdempotencyKey(base));
  });

  it('changes when the document set changes', () => {
    expect(
      buildAiJobIdempotencyKey({ ...base, documentIds: ['doc-a'] }),
    ).not.toBe(buildAiJobIdempotencyKey(base));
  });

  it('changes when the job type changes', () => {
    expect(buildAiJobIdempotencyKey({ ...base, type: 'OCR' })).not.toBe(
      buildAiJobIdempotencyKey(base),
    );
    expect(buildAiJobIdempotencyKey({ ...base, type: 'EMBEDDING' })).not.toBe(
      buildAiJobIdempotencyKey({ ...base, type: 'OCR' }),
    );
  });

  it('changes when the pipeline version changes, so a new pipeline may reprocess', () => {
    expect(
      buildAiJobIdempotencyKey({
        ...base,
        pipelineVersion: AI_PIPELINE_VERSION + 1,
      }),
    ).not.toBe(buildAiJobIdempotencyKey(base));
  });

  it('is an opaque digest that cannot leak its inputs', () => {
    const key = buildAiJobIdempotencyKey(base);

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('doc-a');
    expect(key).not.toContain('DOCUMENT_ANALYSIS');
  });
});

describe('AI job stages', () => {
  it('matches the three stages the Advisor UI renders', () => {
    expect(AI_JOB_STAGES).toHaveLength(3);
  });
});

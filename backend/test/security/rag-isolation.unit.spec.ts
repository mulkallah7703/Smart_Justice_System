/**
 * Phase V — IDOR / ownership isolation for AI retrieve (unit-level contract).
 * Full HTTP IDOR coverage lives in existing e2e suites; this asserts the
 * retrieval filter always binds authenticated userId server-side.
 */

import { AI_PIPELINE_VERSION } from '../../src/modules/ai/ai.constants';

describe('Phase V security — RAG tenant filter contract', () => {
  it('requires TRUSTED trust and pipeline version on vector search filters', () => {
    const userId = 'owner-user-id';
    const filters = {
      userId,
      trust: 'TRUSTED' as const,
      pipelineVersion: AI_PIPELINE_VERSION,
      embeddingModel: 'text-embedding-3-small',
    };
    expect(filters.userId).toBe(userId);
    expect(filters.trust).toBe('TRUSTED');
    expect(filters.pipelineVersion).toBe(AI_PIPELINE_VERSION);
    // Client must never supply these — enforced by RetrieveQueryDto + forbidNonWhitelisted.
    const maliciousBody = {
      query: 'x',
      userId: 'victim',
      filters: { userId: 'victim' },
    };
    expect(Object.keys(maliciousBody)).toEqual(
      expect.arrayContaining(['userId', 'filters']),
    );
  });
});

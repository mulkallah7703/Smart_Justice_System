import { createHash } from 'node:crypto';

import type { AiJobType } from '@prisma/client';

/**
 * Derives the key that makes repeated requests for the same logical work
 * collapse onto a single job.
 *
 * The document set is sorted and de-duplicated so ordering is irrelevant, and
 * the pipeline version participates so a pipeline change is allowed to
 * reprocess the same documents.
 *
 * The user is intentionally *not* hashed in: it is the first column of the
 * `(userId, idempotencyKey)` unique index, matching the payments convention,
 * which keeps the key comparable across users while the constraint stays
 * per-user.
 *
 * The inputs are identifiers and a version number only — never document
 * content, and never personal data.
 */
export const buildAiJobIdempotencyKey = (input: {
  type: AiJobType;
  pipelineVersion: number;
  documentIds: readonly string[];
}): string => {
  const documents = [...new Set(input.documentIds)].sort();

  const canonical = [
    `v${input.pipelineVersion}`,
    input.type,
    documents.join(','),
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
};

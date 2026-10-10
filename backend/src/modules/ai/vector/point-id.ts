import { createHash } from 'node:crypto';

/**
 * Qdrant point ids must be UUID or unsigned integer. DocumentChunk.id is a
 * cuid, so we derive a deterministic UUIDv5-like id from it. Retries reuse
 * the same point id → upsert is idempotent.
 */
export const chunkIdToPointId = (chunkId: string): string => {
  const hash = createHash('sha1').update(`sjs:document-chunk:${chunkId}`).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

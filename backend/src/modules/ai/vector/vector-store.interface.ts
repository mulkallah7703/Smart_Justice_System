export const VECTOR_STORE = Symbol('VECTOR_STORE');

/**
 * Provenance stored beside each vector. Canonical chunk text stays in Postgres.
 * Never include National ID, JWT, storageKey, or secrets.
 */
export interface VectorPointPayload {
  chunkId: string;
  documentId: string;
  documentPageId: string;
  /** Internal owner key for future server-side filters. Never logged or returned by APIs. */
  userId: string;
  pageNumber: number;
  chunkIndex: number;
  pipelineVersion: number;
  embeddingModel: string;
  extractionMethod: 'TEXT_LAYER' | 'OCR';
  trust: 'TRUSTED';
  /** Ruling section when the chunker labelled one. */
  section?: string | null;
}

export interface VectorUpsertPoint {
  /** Deterministic id derived from DocumentChunk.id. */
  id: string;
  vector: readonly number[];
  payload: VectorPointPayload;
}

/** Server-side must-filters for ANN search. Never take filter values from the client. */
export interface VectorSearchFilters {
  userId: string;
  trust: 'TRUSTED';
  pipelineVersion: number;
  embeddingModel: string;
  /** When set, only these documents are eligible. Empty means no hits. */
  documentIds?: readonly string[];
}

export interface VectorSearchInput {
  vector: readonly number[];
  limit: number;
  filters: VectorSearchFilters;
  /** Minimum cosine similarity (0..1). Omitted = no floor. */
  scoreThreshold?: number;
}

/**
 * Ranked hit. Use `chunkId` for Postgres lookup — never treat payload as
 * authoritative text. Point ids are intentionally omitted from public APIs.
 */
export interface VectorSearchHit {
  chunkId: string;
  score: number;
  payload: VectorPointPayload;
}

export interface VectorStore {
  readonly name: string;
  readonly collection: string;
  readonly dimensions: number;

  ensureCollection(): Promise<void>;
  upsert(points: readonly VectorUpsertPoint[]): Promise<void>;
  deleteByIds(ids: readonly string[]): Promise<void>;
  search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]>;
  /** True when the store answers a lightweight ping. */
  healthCheck(): Promise<boolean>;
}

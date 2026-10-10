export interface RetrieveProvenanceDto {
  documentId: string;
  documentName: string;
  documentPageId: string;
  documentChunkId: string;
  pageNumber: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  pipelineVersion: number;
  embeddingModel: string;
  extractionMethod: 'TEXT_LAYER' | 'OCR';
  trust: 'TRUSTED';
}

export interface RetrieveResultItemDto {
  score: number;
  /** Authoritative DocumentChunk.text from PostgreSQL. */
  text: string;
  provenance: RetrieveProvenanceDto;
}

export interface RetrieveMetaDto {
  collection: string;
  embeddingModel: string;
  embeddingDimensions: number;
  limit: number;
  returned: number;
  /** Candidates dropped after Qdrant because PostgreSQL rejected them. */
  droppedCount: number;
}

/** Evidence-only response. Never an LLM answer. */
export interface RetrieveResponseDto {
  query: string;
  results: RetrieveResultItemDto[];
  retrieval: RetrieveMetaDto;
}

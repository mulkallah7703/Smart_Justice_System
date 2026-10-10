import type {
  RetrieveProvenanceDto,
  RetrieveResponseDto,
  RetrieveResultItemDto,
} from '../dto/retrieve-response.dto';

export interface RetrievalChunkRow {
  id: string;
  text: string;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  pipelineVersion: number;
  embeddingModel: string | null;
  documentId: string;
  documentPageId: string;
  document: {
    originalName: string;
  };
  documentPage: {
    pageNumber: number;
    extractionMethod: 'TEXT_LAYER' | 'OCR';
    trust: 'TRUSTED' | 'REVIEW_REQUIRED' | 'UNUSABLE';
  };
}

export const mapRetrieveResultItem = (
  score: number,
  chunk: RetrievalChunkRow,
): RetrieveResultItemDto => {
  const provenance: RetrieveProvenanceDto = {
    documentId: chunk.documentId,
    documentName: chunk.document.originalName,
    documentPageId: chunk.documentPageId,
    documentChunkId: chunk.id,
    pageNumber: chunk.documentPage.pageNumber,
    chunkIndex: chunk.chunkIndex,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    pipelineVersion: chunk.pipelineVersion,
    embeddingModel: chunk.embeddingModel ?? '',
    extractionMethod: chunk.documentPage.extractionMethod,
    trust: 'TRUSTED',
  };

  return {
    score,
    text: chunk.text,
    provenance,
  };
};

export const mapRetrieveResponse = (input: {
  query: string;
  results: RetrieveResultItemDto[];
  collection: string;
  embeddingModel: string;
  embeddingDimensions: number;
  limit: number;
  droppedCount: number;
}): RetrieveResponseDto => ({
  query: input.query,
  results: input.results,
  retrieval: {
    collection: input.collection,
    embeddingModel: input.embeddingModel,
    embeddingDimensions: input.embeddingDimensions,
    limit: input.limit,
    returned: input.results.length,
    droppedCount: input.droppedCount,
  },
});

export interface AnswerCitationDto {
  evidenceId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkId: string;
  startOffset: number;
  endOffset: number;
}

export interface AnswerClaimDto {
  text: string;
  citations: AnswerCitationDto[];
}

/** Informational RAG answer — not an official legal opinion. */
export interface AnswerResponseDto {
  answer: string;
  claims: AnswerClaimDto[];
  insufficientEvidence: boolean;
  model: string;
}

import type { RetrieveResultItemDto } from '../dto/retrieve-response.dto';
import type {
  AnswerCitationDto,
  AnswerClaimDto,
  AnswerResponseDto,
} from '../dto/answer-response.dto';

export interface EvidenceMapEntry {
  evidenceId: string;
  result: RetrieveResultItemDto;
}

export const buildEvidenceMap = (
  results: readonly RetrieveResultItemDto[],
): EvidenceMapEntry[] =>
  results.map((result, index) => ({
    evidenceId: `E${index + 1}`,
    result,
  }));

export const mapCitation = (
  evidenceId: string,
  result: RetrieveResultItemDto,
): AnswerCitationDto => ({
  evidenceId,
  documentId: result.provenance.documentId,
  documentName: result.provenance.documentName,
  pageNumber: result.provenance.pageNumber,
  chunkId: result.provenance.documentChunkId,
  startOffset: result.provenance.startOffset,
  endOffset: result.provenance.endOffset,
});

export const mapAnswerResponse = (input: {
  answer: string;
  claims: Array<{ text: string; evidenceIds: string[] }>;
  insufficientEvidence: boolean;
  model: string;
  evidenceById: Map<string, RetrieveResultItemDto>;
}): AnswerResponseDto => {
  const claims: AnswerClaimDto[] = input.claims.map((claim) => ({
    text: claim.text,
    citations: claim.evidenceIds.map((id) => {
      const result = input.evidenceById.get(id);
      if (!result) {
        throw new Error('AI_ANSWER_INVALID');
      }
      return mapCitation(id, result);
    }),
  }));

  return {
    answer: input.answer,
    claims,
    insufficientEvidence: input.insufficientEvidence,
    model: input.model,
  };
};

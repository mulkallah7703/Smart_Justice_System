export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingInput {
  texts: readonly string[];
}

export interface EmbeddingResult {
  /** One vector per input text, in the same order. */
  vectors: readonly (readonly number[])[];
  /** Fixed for a given model. A vector store collection is bound to this. */
  dimensions: number;
  model: string;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;

  embed(input: EmbeddingInput): Promise<EmbeddingResult>;
}

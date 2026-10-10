export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** Dedicated token for Phase H answer generation (selected by AI_LLM_MODE). */
export const ANSWER_LLM_PROVIDER = Symbol('ANSWER_LLM_PROVIDER');

export interface LlmCompletionInput {
  /** Trusted instruction layer. Never sourced from user or document content. */
  instruction: string;
  /**
   * Untrusted material (user question, retrieved chunks). Adapters must pass
   * this to the model as data, never merged into the instruction layer.
   */
  untrustedContext: readonly string[];
}

export interface LlmCompletion {
  text: string;
  /** Reported by the adapter when the provider exposes it. Never a secret. */
  promptTokens: number;
  completionTokens: number;
  model: string;
}

export interface LlmGenerateAnswerInput {
  /** Trusted system instructions. Never from user/documents. */
  systemPrompt: string;
  /**
   * User question + delimited evidence blocks. Evidence is DATA only —
   * never treated as instructions by the adapter.
   */
  userPrompt: string;
}

export interface LlmGenerateAnswerResult {
  /** Raw model text (expected JSON). Never logged. */
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Seam between AI business logic and model vendors.
 * `complete` — worker placeholder path.
 * `generateAnswer` — Phase H structured legal RAG answers.
 */
export interface LlmProvider {
  readonly name: string;

  complete(input: LlmCompletionInput): Promise<LlmCompletion>;

  generateAnswer(
    input: LlmGenerateAnswerInput,
  ): Promise<LlmGenerateAnswerResult>;
}

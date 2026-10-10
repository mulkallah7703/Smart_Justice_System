import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

// Suites exercise many analysis requests per user; the limit itself is proven
// by a dedicated suite that lowers this value for its own application.
process.env.AI_ANALYSIS_RATE_LIMIT_MAX ??= '1000';
process.env.AI_RETRIEVAL_RATE_LIMIT_MAX ??= '1000';
process.env.AI_ANSWER_RATE_LIMIT_MAX ??= '1000';
process.env.AI_GUIDE_RATE_LIMIT_MAX ??= '1000';
process.env.KIOSK_RATE_LIMIT_MAX ??= '1000';

process.env.AI_PROVIDER_MODE ??= 'mock';
// Deterministic embeddings + in-memory vectors for automated e2e (no paid API).
process.env.AI_EMBEDDING_MODE ??= 'mock';
process.env.AI_VECTOR_STORE_MODE ??= 'mock';
process.env.AI_LLM_MODE ??= 'mock';

// Default to the deterministic extractor. Suites that need real PDF extraction
// opt in explicitly and must restore this afterwards so later files in the
// same Jest worker are not polluted.
process.env.AI_TEXT_EXTRACTOR_MODE ??= 'mock';
process.env.AI_OCR_MODE ??= 'mock';
process.env.PAYMENT_PROVIDER ??= 'mock';
process.env.NAFATH_MODE ??= 'mock';

// The analysis engine's public API, for server code (server actions, route
// handlers, scripts). Client components must not import this file, because it
// re-exports the OpenRouter client; they import ./types, ./stored, ./red-lines,
// ./clean, ./citations, ./exposure, ./tiers or ./wording directly
// (tests/engine/server-boundary.test.ts).

export * from "./types";
export * from "./model";
export { findCitation, checkQuote, citationMatches, MIN_CITATION_CHARS, type QuoteCheck } from "./citations";
export {
  analyse,
  ALLOWED_CLAUSE_TYPES,
  ANALYSIS_SCHEMA,
  ANALYSIS_TASK,
  MAX_ATTEMPTS,
  type AnalyseInput,
  type ModelAnalysisItem,
  type ModelAnalysisPayload,
  type ModelOutsideTermsItem,
} from "./analyse";
export { decideOutcome } from "./clean";
export { checkExposure, hasFigure, parseMoneyAmount, type ExposureCheck } from "./exposure";
export { assignTier, rankFlags, type TierInput } from "./tiers";
export { describeRedLine, findBreaches, parseLimit, parseRedLine, parseRedLines } from "./red-lines";
export {
  BANNED_TERMS,
  HEDGING_TERMS,
  MARKET_TERMS,
  WordingDefectsError,
  findWordingDefects,
  type WordingPiece,
} from "./wording";
export { checkStoredAnalysis, readStoredAnalysis, type StoredAnalysisCheck } from "./stored";
export { createOpenRouterClient, isModelConfigured, OPENROUTER_URL, type OpenRouterOptions } from "./openrouter";
export { ScriptedModelClient, type ScriptStep } from "./scripted";

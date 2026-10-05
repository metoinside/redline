// The analysis engine's public API, for server code (server actions, route
// handlers, scripts). Client components must not import this file, because it
// re-exports the OpenRouter client; they import ./types, ./stored or
// ./citations directly (tests/engine/server-boundary.test.ts).

export * from "./types";
export * from "./model";
export { findCitation, checkQuote, citationMatches, MIN_CITATION_CHARS, type QuoteCheck } from "./citations";
export {
  analyse,
  ALLOWED_CLAUSE_TYPES,
  ANALYSIS_SCHEMA,
  ANALYSIS_TASK,
  type AnalyseInput,
  type ModelAnalysisItem,
  type ModelAnalysisPayload,
} from "./analyse";
export { readStoredAnalysis } from "./stored";
export { createOpenRouterClient, isModelConfigured, OPENROUTER_URL, type OpenRouterOptions } from "./openrouter";
export { ScriptedModelClient, type ScriptStep } from "./scripted";

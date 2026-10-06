"use server";

// Runs an analysis, or answers a question, on the server, where the
// OpenRouter key lives. The browser calls these by reference and gets back
// only the analysis or the answer: the key, the model and the model's raw
// answer never leave the server. Deleting a saved document runs here too.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkDocumentText } from "@/lib/documents/new-document";
import { runSavedAnalysis } from "@/lib/documents/saved-run";
import { runSavedQuestion } from "@/lib/documents/saved-question";
import { ask } from "@/lib/engine/ask";
import { CounterOfferDefectsError, analyse } from "@/lib/engine/analyse";
import { checkQuestion } from "@/lib/engine/answers";
import { ModelError, type ModelClient } from "@/lib/engine/model";
import { createOpenRouterClient, isModelConfigured } from "@/lib/engine/openrouter";
import { WordingDefectsError } from "@/lib/engine/wording";
import type { Analysis, Answer, AskResult, QuestionProblem, RedLine } from "@/lib/engine/types";
import { RED_LINE_COLUMNS } from "@/lib/red-lines/rows";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";

/**
 * One run as the browser gets it. redLines is the snapshot the run used:
 * checkStoredAnalysis works breaches and tiers out again from it before
 * anything is shown. A run in the browser only (signed out) has none.
 */
export type AnalysisRun = { analysis: Analysis; ranAt: string; redLines: RedLine[] };

export type RunAnalysisFailure =
  | "model-off"
  | "model-failed"
  /** The model's wording still hedged or compared with the market after a retry. Nothing is shown or saved. */
  | "wording-failed"
  /** A flag still had no usable counter-offer after a retry. Nothing is shown or saved: a flag is never shown without one. */
  | "counter-offer-failed"
  | "accounts-off"
  | "signed-out"
  | "not-found"
  | "invalid"
  | "save-failed"
  /** The buyer's red lines couldn't be loaded, so nothing ran: a run without them could miss a breach. */
  | "red-lines-failed";

export type RunAnalysisResult = { ok: true; run: AnalysisRun } | { ok: false; reason: RunAnalysisFailure };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EngineFailure = "model-off" | "model-failed" | "wording-failed" | "counter-offer-failed";

/** Runs the engine with the real model. Any model failure becomes a plain reason; nothing about it reaches the browser. */
async function runEngine<T>(
  run: (client: ModelClient) => Promise<T>,
  label = "analysis",
): Promise<{ ok: true; value: T } | { ok: false; reason: EngineFailure }> {
  if (!isModelConfigured()) return { ok: false, reason: "model-off" };
  try {
    return { ok: true, value: await run(createOpenRouterClient()) };
  } catch (err) {
    if (err instanceof WordingDefectsError) {
      // The terms only, never the model's text.
      const terms = [...new Set(err.attempts.flatMap((a) => a.defects.map((d) => d.term)))];
      console.error(`[${label}] wording check failed after ${err.attempts.length} attempts: ${terms.join(", ")}`);
      return { ok: false, reason: "wording-failed" };
    }
    if (err instanceof CounterOfferDefectsError) {
      // The clause types only, never the model's text.
      const types = [...new Set(err.attempts.flatMap((a) => a.defects.map((d) => d.clauseType)))];
      console.error(`[${label}] counter-offer check failed after ${err.attempts.length} attempts: ${types.join(", ")}`);
      return { ok: false, reason: "counter-offer-failed" };
    }
    if (err instanceof ModelError) {
      // The kind and status only: messages are already free of the key and model id.
      console.error(`[${label}] model call failed: ${err.kind}${"status" in err ? ` ${String(err.status)}` : ""}`);
      return { ok: false, reason: err.kind === "not-configured" ? "model-off" : "model-failed" };
    }
    console.error(`[${label}] failed`, err instanceof Error ? err.name : typeof err);
    return { ok: false, reason: "model-failed" };
  }
}

/**
 * Analyses a document in the signed-in buyer's library and saves the result
 * with its run date. The text is loaded under row-level security, so only the
 * owner's own document can be analysed. The buyer's current red lines are
 * loaded the same way and go into the run, and the saved row keeps a
 * snapshot of them, so "Analyse again" after a change uses the new ones. If
 * the red lines, the model or the save fails, nothing is saved and nothing
 * is shown.
 */
export async function analyseSavedDocument(documentId: unknown): Promise<RunAnalysisResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "accounts-off" };
  if (typeof documentId !== "string" || !UUID.test(documentId)) return { ok: false, reason: "invalid" };
  if (!isModelConfigured()) return { ok: false, reason: "model-off" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const supabase = await createServerSupabase();
  const { data: doc, error: loadError } = await supabase.from("documents").select("id, body").eq("id", documentId).maybeSingle();
  if (loadError) return { ok: false, reason: "model-failed" };
  if (!doc) return { ok: false, reason: "not-found" };

  const { data: rows, error: redLinesError } = await supabase
    .from("red_lines")
    .select(RED_LINE_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (redLinesError) {
    console.error("[analysis] could not load red lines", redLinesError.code);
    return { ok: false, reason: "red-lines-failed" };
  }

  const engine = await runEngine((client) =>
    runSavedAnalysis({ documentId, body: doc.body as string, redLineRows: rows ?? [], client }),
  );
  if (!engine.ok) return engine;
  if (!engine.value.ok) {
    console.error("[analysis] a red line row could not be read");
    return { ok: false, reason: "red-lines-failed" };
  }
  const result = engine.value.run;

  const { data: saved, error: saveError } = await supabase.from("analyses").insert(result.insert).select("created_at").single();
  if (saveError || !saved) {
    console.error("[analysis] could not save the analysis", saveError?.code ?? "no row");
    return { ok: false, reason: "save-failed" };
  }

  return {
    ok: true,
    run: { analysis: result.analysis, ranAt: new Date(saved.created_at as string).toISOString(), redLines: result.redLines },
  };
}

/**
 * Analyses a document kept only in the browser (signed out, or no accounts on
 * this server). The text is checked and normalised again here, without
 * trusting the browser, and nothing is saved. Red lines need an account, so
 * this runs with none.
 */
export async function analyseBrowserDocument(body: unknown): Promise<RunAnalysisResult> {
  const checked = checkDocumentText(body);
  if (!checked.ok) return { ok: false, reason: "invalid" };

  const result = await runEngine((client) => analyse({ text: checked.text, redLines: [], client }));
  if (!result.ok) return result;
  return { ok: true, run: { analysis: result.value.analysis, ranAt: new Date().toISOString(), redLines: [] } };
}

// ---------- The question box ----------

/**
 * One question as the browser gets it. `result` is the answer exactly as
 * saved or returned: the browser reads it through readStoredAnswer against
 * the document's own text before showing it, so a citation that no longer
 * matches is shown as "the document doesn't say". `id` is null for a question
 * about a document kept in the browser only, which is never saved.
 */
export type AskedQuestion = { id: string | null; question: string; result: Answer; askedAt: string };

export type AskQuestionFailure =
  | "model-off"
  | "model-failed"
  /** The answer still hedged or compared with the market after a retry. Nothing is shown or saved. */
  | "wording-failed"
  | `question-${QuestionProblem}`
  | "accounts-off"
  | "signed-out"
  | "not-found"
  | "invalid"
  | "save-failed";

export type AskQuestionResult = { ok: true; asked: AskedQuestion } | { ok: false; reason: AskQuestionFailure };

type AskRefusal = Exclude<AskResult, { ok: true }>;

/** Runs ask() with the real model and turns every way it can fail into a plain reason. */
async function runAsk<S extends { ok: true }>(
  run: (client: ModelClient) => Promise<S | AskRefusal>,
): Promise<{ ok: true; value: S } | { ok: false; reason: AskQuestionFailure }> {
  const engine = await runEngine(run, "question");
  if (!engine.ok) return { ok: false, reason: engine.reason === "counter-offer-failed" ? "model-failed" : engine.reason };
  const result = engine.value;
  if (result.ok) return { ok: true, value: result };
  if (result.reason === "invalid-question") return { ok: false, reason: `question-${result.problem}` };
  // The terms only, never the model's text.
  const terms = [...new Set(result.attempts.flatMap((a) => a.defects.map((d) => d.term)))];
  console.error(`[question] wording check failed after ${result.attempts.length} attempts: ${terms.join(", ")}`);
  return { ok: false, reason: "wording-failed" };
}

/**
 * Answers a question about a document in the signed-in buyer's library, and
 * saves the question with the answer shown. The text is loaded under
 * row-level security, so only the owner's own document can be asked about.
 * If the model or the save fails, nothing is saved and nothing is shown.
 */
export async function askSavedDocument(documentId: unknown, question: unknown): Promise<AskQuestionResult> {
  if (!isSupabaseConfigured()) return { ok: false, reason: "accounts-off" };
  if (typeof documentId !== "string" || !UUID.test(documentId)) return { ok: false, reason: "invalid" };
  const checked = checkQuestion(question);
  if (!checked.ok) return { ok: false, reason: `question-${checked.problem}` };
  if (!isModelConfigured()) return { ok: false, reason: "model-off" };

  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const supabase = await createServerSupabase();
  const { data: doc, error: loadError } = await supabase.from("documents").select("id, body").eq("id", documentId).maybeSingle();
  if (loadError) return { ok: false, reason: "model-failed" };
  if (!doc) return { ok: false, reason: "not-found" };

  const engine = await runAsk((client) => runSavedQuestion({ documentId, body: doc.body as string, question: checked.question, client }));
  if (!engine.ok) return engine;
  const { run } = engine.value;

  const { data: saved, error: saveError } = await supabase.from("questions").insert(run.insert).select("id, created_at").single();
  if (saveError || !saved) {
    console.error("[question] could not save the question", saveError?.code ?? "no row");
    return { ok: false, reason: "save-failed" };
  }

  return {
    ok: true,
    asked: { id: saved.id as string, question: run.question, result: run.answer, askedAt: new Date(saved.created_at as string).toISOString() },
  };
}

/**
 * Answers a question about a document kept only in the browser (signed out,
 * or no accounts on this server). The text is checked and normalised again
 * here, without trusting the browser, and nothing is saved.
 */
export async function askBrowserDocument(body: unknown, question: unknown): Promise<AskQuestionResult> {
  const text = checkDocumentText(body);
  if (!text.ok) return { ok: false, reason: "invalid" };
  const checked = checkQuestion(question);
  if (!checked.ok) return { ok: false, reason: `question-${checked.problem}` };

  const engine = await runAsk((client) => ask({ text: text.text, question: checked.question, client }));
  if (!engine.ok) return engine;
  const { value } = engine;
  return { ok: true, asked: { id: null, question: value.question, result: value.answer, askedAt: new Date().toISOString() } };
}

// ---------- Deleting a document ----------

export type DeleteDocumentFailure = "accounts-off" | "signed-out" | "invalid" | "not-found" | "delete-failed";

export type DeleteDocumentState = { kind: "idle" } | { kind: "error"; reason: DeleteDocumentFailure };

/**
 * Deletes a document from the signed-in buyer's library, with its analyses
 * and questions (the foreign keys cascade). The delete runs under row-level
 * security, so only the owner's own document can go; a document that isn't
 * theirs, or is already gone, deletes nothing. On success the buyer lands on
 * the library, which says the document was deleted.
 */
export async function deleteDocument(_prev: DeleteDocumentState, formData: FormData): Promise<DeleteDocumentState> {
  if (!isSupabaseConfigured()) return { kind: "error", reason: "accounts-off" };
  const documentId = formData.get("documentId");
  if (typeof documentId !== "string" || !UUID.test(documentId)) return { kind: "error", reason: "invalid" };

  const user = await getCurrentUser();
  if (!user) return { kind: "error", reason: "signed-out" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("documents").delete().eq("id", documentId).eq("user_id", user.id).select("id");
  if (error) {
    console.error("[library] could not delete a document", error.code);
    return { kind: "error", reason: "delete-failed" };
  }
  if (!data || data.length === 0) return { kind: "error", reason: "not-found" };

  revalidatePath("/library");
  redirect("/library?deleted=1");
}

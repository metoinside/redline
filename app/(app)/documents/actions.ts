"use server";

// Runs an analysis on the server, where the OpenRouter key lives. The browser
// calls these by reference and gets back only the analysis: the key, the
// model and the model's raw answer never leave the server.

import { checkDocumentText } from "@/lib/documents/new-document";
import { analyse } from "@/lib/engine/analyse";
import { ModelError } from "@/lib/engine/model";
import { createOpenRouterClient, isModelConfigured } from "@/lib/engine/openrouter";
import { WordingDefectsError } from "@/lib/engine/wording";
import type { Analysis, AnalysisDiagnostics, RedLine } from "@/lib/engine/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabase, getCurrentUser } from "@/lib/supabase/server";

export type AnalysisRun = { analysis: Analysis; ranAt: string };

export type RunAnalysisFailure =
  | "model-off"
  | "model-failed"
  /** The model's wording still hedged or compared with the market after a retry. Nothing is shown or saved. */
  | "wording-failed"
  | "accounts-off"
  | "signed-out"
  | "not-found"
  | "invalid"
  | "save-failed";

export type RunAnalysisResult = { ok: true; run: AnalysisRun } | { ok: false; reason: RunAnalysisFailure };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs the engine with the real model. Any model failure becomes a plain reason; nothing about it reaches the browser. */
async function runEngine(
  text: string,
  redLines: RedLine[],
): Promise<{ ok: true; analysis: Analysis; diagnostics: AnalysisDiagnostics } | { ok: false; reason: RunAnalysisFailure }> {
  if (!isModelConfigured()) return { ok: false, reason: "model-off" };
  try {
    const { analysis, diagnostics } = await analyse({ text, redLines, client: createOpenRouterClient() });
    return { ok: true, analysis, diagnostics };
  } catch (err) {
    if (err instanceof WordingDefectsError) {
      // The terms only, never the model's text.
      const terms = [...new Set(err.attempts.flatMap((a) => a.defects.map((d) => d.term)))];
      console.error(`[analysis] wording check failed after ${err.attempts.length} attempts: ${terms.join(", ")}`);
      return { ok: false, reason: "wording-failed" };
    }
    if (err instanceof ModelError) {
      // The kind and status only: messages are already free of the key and model id.
      console.error(`[analysis] model call failed: ${err.kind}${"status" in err ? ` ${String(err.status)}` : ""}`);
      return { ok: false, reason: err.kind === "not-configured" ? "model-off" : "model-failed" };
    }
    console.error("[analysis] failed", err instanceof Error ? err.name : typeof err);
    return { ok: false, reason: "model-failed" };
  }
}

/**
 * Analyses a document in the signed-in buyer's library and saves the result
 * with its run date. The text is loaded under row-level security, so only the
 * owner's own document can be analysed. If the model or the save fails,
 * nothing is saved and nothing is shown.
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

  // Red lines arrive with #10; until then every run uses none, and the snapshot says so.
  const redLines: RedLine[] = [];
  const result = await runEngine(doc.body as string, redLines);
  if (!result.ok) return result;

  const { data: saved, error: saveError } = await supabase
    .from("analyses")
    .insert({ document_id: documentId, result: result.analysis, red_lines: redLines })
    .select("created_at")
    .single();
  if (saveError || !saved) {
    console.error("[analysis] could not save the analysis", saveError?.code ?? "no row");
    return { ok: false, reason: "save-failed" };
  }

  return { ok: true, run: { analysis: result.analysis, ranAt: new Date(saved.created_at as string).toISOString() } };
}

/**
 * Analyses a document kept only in the browser (signed out, or no accounts on
 * this server). The text is checked and normalised again here, without
 * trusting the browser, and nothing is saved.
 */
export async function analyseBrowserDocument(body: unknown): Promise<RunAnalysisResult> {
  const checked = checkDocumentText(body);
  if (!checked.ok) return { ok: false, reason: "invalid" };

  const result = await runEngine(checked.text, []);
  if (!result.ok) return result;
  return { ok: true, run: { analysis: result.analysis, ranAt: new Date().toISOString() } };
}

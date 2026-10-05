// npm run smoke: runs the adhesion fixture through the real pipeline (the real
// analyse with the OpenRouter client) and prints each kept flag with its
// source sentence, then the diagnostics. Proves the request shape works
// against the real model. Never prints the key or the model id.

import { loadEnvConfig } from "@next/env";
import { analyse } from "@/lib/engine/analyse";
import { ModelError, ModelHttpError } from "@/lib/engine/model";
import { createOpenRouterClient } from "@/lib/engine/openrouter";
import { loadAdhesionContract } from "../tests/fixtures/index";

async function main(): Promise<number> {
  loadEnvConfig(process.cwd());

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("OPENROUTER_API_KEY is not set. Put it in .env.local and run again.");
    return 1;
  }
  if (!process.env.OPENROUTER_MODEL?.trim()) {
    console.error("OPENROUTER_MODEL is not set. Put it in .env.local and run again.");
    return 1;
  }

  const { text, sidecar } = loadAdhesionContract();
  console.log(`Analysing ${sidecar.document} (${text.length.toLocaleString("en-US")} characters)...`);

  const started = Date.now();
  let result;
  try {
    result = await analyse({ text, redLines: [], client: createOpenRouterClient() });
  } catch (err) {
    if (err instanceof ModelError) {
      console.error(`The model call failed (${err.kind}${err instanceof ModelHttpError ? ` ${err.status}` : ""}): ${err.message}`);
    } else {
      console.error("The analysis failed:", err instanceof Error ? err.message : err);
    }
    return 1;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const { analysis, diagnostics } = result;
  console.log(`\nFlags kept (${analysis.flags.length}), in ${seconds}s:`);
  for (const flag of analysis.flags) {
    const ok = text.slice(flag.citation.start, flag.citation.end) === flag.citation.text ? "verbatim" : "MISMATCH";
    console.log(`\n  ${flag.id} ${flag.clauseType} [${flag.citation.start}, ${flag.citation.end}) ${ok}`);
    console.log(`    "${flag.citation.text}"`);
  }
  if (analysis.flags.length === 0) console.log("  none");

  console.log("\nDiagnostics:");
  console.log(`  returned by the model: ${diagnostics.returned}`);
  console.log(`  kept: ${diagnostics.kept}`);
  console.log(`  dropped: ${diagnostics.dropped.length} ${JSON.stringify(diagnostics.droppedByReason)}`);
  for (const d of diagnostics.dropped) {
    const quote = d.quote === null ? "(no quote)" : `"${d.quote.length > 110 ? `${d.quote.slice(0, 107)}...` : d.quote}"`;
    console.log(`    #${d.index} ${d.reason} ${d.clauseType ?? "(no type)"} ${quote}`);
  }

  // How the model did against the fixture's labels, for the reader of this output.
  const labelled = sidecar.clauses.filter((c) => c.clauseType === "auto_renewal").map((c) => c.sentence);
  const found = new Set(analysis.flags.map((f) => f.citation.text));
  const missed = labelled.filter((s) => !found.has(s));
  console.log(`\nLabelled auto-renewal clauses found: ${labelled.length - missed.length} of ${labelled.length}`);
  for (const s of missed) console.log(`  missed: "${s}"`);

  return analysis.flags.every((f) => text.slice(f.citation.start, f.citation.end) === f.citation.text) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error("The smoke run crashed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

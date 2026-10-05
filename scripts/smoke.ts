// npm run smoke: runs the adhesion fixture through the real pipeline (the real
// analyse with the OpenRouter client) and prints each kept flag in ranked
// order with its tier, exposure, statement, readings and source sentence,
// then the diagnostics and how the result compares with the fixture's labels. Proves the request shape works
// against the real model. Never prints the key or the model id.

import { loadEnvConfig } from "@next/env";
import { analyse } from "@/lib/engine/analyse";
import { ModelError, ModelHttpError } from "@/lib/engine/model";
import { createOpenRouterClient } from "@/lib/engine/openrouter";
import { EXPOSURE_PARTS } from "@/lib/engine/types";
import { WordingDefectsError } from "@/lib/engine/wording";
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
    if (err instanceof WordingDefectsError) {
      console.error(`The analysis failed the wording check after ${err.attempts.length} attempts. Nothing would be shown or saved.`);
      for (const a of err.attempts) {
        console.error(`  attempt ${a.attempt}: ${a.defects.map((d) => `${d.field} "${d.term}"`).join("; ") || "clean"}`);
      }
      return 1;
    }
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
  const tierName = { negotiate: "Negotiate before signing", know: "Know before signing" } as const;
  for (const flag of analysis.flags) {
    const ok = text.slice(flag.citation.start, flag.citation.end) === flag.citation.text ? "verbatim" : "MISMATCH";
    console.log(`\n  ${flag.id} ${flag.clauseType} | ${tierName[flag.tier]} [${flag.citation.start}, ${flag.citation.end}) ${ok}`);
    const parts = EXPOSURE_PARTS.filter((p) => flag.exposure[p] !== undefined);
    if (parts.length === 0) console.log("    exposure: none cited");
    for (const p of parts) {
      const inCitation = flag.citation.text.includes(flag.exposure[p]!) ? "" : " NOT IN CITATION";
      console.log(`    exposure ${p}: "${flag.exposure[p]}"${p === "money" && flag.moneyAmount !== null ? ` (${flag.moneyAmount.toLocaleString("en-US")})` : ""}${inCitation}`);
    }
    console.log(`    statement: ${flag.statement}`);
    if (flag.readings.length === 2) flag.readings.forEach((r, i) => console.log(`    reading ${i + 1}: ${r}`));
    console.log(`    source: "${flag.citation.text}"`);
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
  console.log(`  exposure parts dropped: ${diagnostics.exposureDropped.length}`);
  for (const d of diagnostics.exposureDropped) console.log(`    #${d.index} ${d.part} ${d.reason} ${JSON.stringify(d.fragment)}`);
  for (const a of diagnostics.wording) {
    console.log(`  wording, attempt ${a.attempt}: ${a.defects.map((d) => `${d.field} "${d.term}"`).join("; ") || "clean"}`);
  }

  // How the model did against the fixture's labels, for the reader of this output.
  let found = 0;
  console.log("\nAgainst the fixture's labels:");
  for (const clause of sidecar.clauses) {
    const flag = analysis.flags.find((f) => f.citation.text === clause.sentence && f.clauseType === clause.clauseType);
    if (flag) found++;
    const verdict = !flag ? "MISSED" : flag.tier === clause.expectedTier ? "tier as labelled" : `tier ${flag.tier}, labelled ${clause.expectedTier}`;
    console.log(`  ${clause.id} ${clause.clauseType}: ${verdict}`);
  }
  console.log(`Labelled clauses found: ${found} of ${sidecar.clauses.length}`);

  return analysis.flags.every((f) => text.slice(f.citation.start, f.citation.end) === f.citation.text) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error("The smoke run crashed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

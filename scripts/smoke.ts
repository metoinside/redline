// npm run smoke: runs the adhesion fixture through the real pipeline (the real
// analyse with the OpenRouter client) and prints the summary points and the
// notice obligations with their source sentences, then each kept flag in ranked
// order with its tier, exposure, statement, readings and source sentence,
// then each outside-terms notice, whether the result is clean (with its
// checklist when it is), the diagnostics and how the result compares with the
// fixture's labels, the notice obligations included. Proves the request shape works
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
  const verbatim = (c: { text: string; start: number; end: number }) => (text.slice(c.start, c.end) === c.text ? "verbatim" : "MISMATCH");
  console.log(`\nAnalysed in ${seconds}s.`);

  console.log(`\nSummary (${analysis.summary.length} points):`);
  for (const point of analysis.summary) {
    console.log(`\n  ${point.id} [${point.citation.start}, ${point.citation.end}) ${verbatim(point.citation)}`);
    console.log(`    point: ${point.text}`);
    console.log(`    source: "${point.citation.text}"`);
  }
  if (analysis.summary.length === 0) console.log("  none");

  console.log(`\nNotice obligations (${analysis.noticeObligations.length}):`);
  for (const o of analysis.noticeObligations) {
    console.log(`\n  ${o.id} [${o.citation.start}, ${o.citation.end}) ${verbatim(o.citation)}`);
    console.log(`    do: ${o.description}`);
    if (o.deadline.kind === "date") console.log(`    deadline (stated date): ${o.deadline.date}`);
    else console.log(`    deadline (rule): ${o.deadline.rule}\n    counted from: ${o.deadline.relativeTo}`);
    console.log(`    source: "${o.citation.text}"`);
  }
  if (analysis.noticeObligations.length === 0) console.log("  none");

  console.log(`\nFlags kept (${analysis.flags.length}):`);
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

  console.log(`\nOutside-terms notices (${analysis.outsideTerms.length}):`);
  for (const notice of analysis.outsideTerms) {
    const ok = text.slice(notice.citation.start, notice.citation.end) === notice.citation.text ? "verbatim" : "MISMATCH";
    console.log(`\n  ${notice.id} [${notice.citation.start}, ${notice.citation.end}) ${ok}`);
    console.log(`    add next: ${notice.document}`);
    console.log(`    source: "${notice.citation.text}"`);
  }
  if (analysis.outsideTerms.length === 0) console.log("  none");

  const { outcome } = analysis;
  if (outcome.clean) {
    console.log("\nClean result: yes (no Negotiate before signing flags, no outside-terms notices)");
    for (const entry of outcome.checklist) {
      const status =
        entry.status === "found_low_exposure"
          ? `found, low exposure (${entry.found.map((f) => `${f.flagId} [${f.citation.start}, ${f.citation.end})`).join(", ")})`
          : "we found none";
      console.log(`  ${entry.clauseType}: ${status}`);
    }
  } else {
    console.log(
      `\nClean result: no (${outcome.negotiateFlags} Negotiate before signing flag(s), ${outcome.outsideTermsNotices} outside-terms notice(s))`,
    );
  }

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
  console.log(`  outside terms returned by the model: ${diagnostics.outsideTermsReturned}`);
  console.log(`  outside terms dropped: ${diagnostics.outsideTermsDropped.length}`);
  for (const d of diagnostics.outsideTermsDropped) {
    const quote = d.quote === null ? "(no quote)" : `"${d.quote.length > 110 ? `${d.quote.slice(0, 107)}...` : d.quote}"`;
    console.log(`    #${d.index} ${d.reason} ${quote}`);
  }
  const printDropped = (label: string, returned: number, dropped: { index: number; reason: string; quote: string | null }[]) => {
    console.log(`  ${label} returned by the model: ${returned}`);
    console.log(`  ${label} dropped: ${dropped.length}`);
    for (const d of dropped) {
      const quote = d.quote === null ? "(no quote)" : `"${d.quote.length > 110 ? `${d.quote.slice(0, 107)}...` : d.quote}"`;
      console.log(`    #${d.index} ${d.reason} ${quote}`);
    }
  };
  printDropped("summary points", diagnostics.summaryReturned, diagnostics.summaryDropped);
  printDropped("notice obligations", diagnostics.noticeObligationsReturned, diagnostics.noticeObligationsDropped);
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
  let noticesFound = 0;
  for (const entry of sidecar.outsideTerms) {
    const hit = analysis.outsideTerms.some((n) => n.citation.text === entry.sentence);
    if (hit) noticesFound++;
    console.log(`  outside terms "${entry.document}": ${hit ? "shown as a notice" : "MISSED"}`);
  }
  console.log(`Labelled outside-terms sentences found: ${noticesFound} of ${sidecar.outsideTerms.length}`);
  let obligationsFound = 0;
  for (const entry of sidecar.noticeObligations) {
    const hit = analysis.noticeObligations.find((o) => o.citation.text === entry.sentence);
    if (hit) obligationsFound++;
    const labelled = entry.relativeTo === undefined ? `date "${entry.deadline}"` : `rule "${entry.deadline}" from "${entry.relativeTo}"`;
    const shown = !hit
      ? "MISSED"
      : hit.deadline.kind === "date"
        ? `shown with date "${hit.deadline.date}"`
        : `shown with rule "${hit.deadline.rule}" from "${hit.deadline.relativeTo}"`;
    console.log(`  notice obligation "${entry.description}": ${shown}; labelled ${labelled}`);
  }
  const unlabelled = analysis.noticeObligations.filter((o) => !sidecar.noticeObligations.some((n) => n.sentence === o.citation.text));
  for (const o of unlabelled) console.log(`  notice obligation not in the labels: ${o.id} "${o.description}"`);
  console.log(`Labelled notice obligations found: ${obligationsFound} of ${sidecar.noticeObligations.length}`);

  const cited = [...analysis.summary, ...analysis.noticeObligations, ...analysis.flags, ...analysis.outsideTerms];
  return cited.every((item) => text.slice(item.citation.start, item.citation.end) === item.citation.text) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error("The smoke run crashed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);

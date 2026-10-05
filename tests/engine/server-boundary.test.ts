import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The OpenRouter key lives on the server only. Follows every import from each
// client component ("use client") through the repo and fails if any path
// reaches the OpenRouter client or reads the key. `npm run build` plus a grep
// of .next/static checks the same thing in the built bundle.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_DIRS = ["app", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)]
    .filter((m) => !/^(?:import|export)\s+type\s/.test(m[0]))
    .map((m) => m[1]);
  return specs.map((s) => resolveImport(file, s)).filter((p): p is string => p !== null);
}

const isClient = (file: string) => /^\s*["']use client["']/.test(readFileSync(file, "utf8"));
const isServerAction = (file: string) => /^\s*["']use server["']/.test(readFileSync(file, "utf8"));

describe("the OpenRouter key never reaches browser code", () => {
  const files = SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)));
  const clientFiles = files.filter(isClient);

  it("finds the client components to check", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it.each(clientFiles.map((f) => relative(ROOT, f)))("%s cannot reach the OpenRouter client", (file) => {
    const seen = new Set<string>();
    const stack = [join(ROOT, file)];
    while (stack.length) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      // A server action is called from the browser by reference; its code stays on the server.
      if (current !== join(ROOT, file) && isServerAction(current)) continue;
      const source = readFileSync(current, "utf8");
      expect(source, `${relative(ROOT, current)} reads the key`).not.toMatch(/OPENROUTER_API_KEY/);
      expect(relative(ROOT, current)).not.toBe(join("lib", "engine", "openrouter.ts"));
      stack.push(...importsOf(current));
    }
  });

  it("no code reads the key or the model from a NEXT_PUBLIC_ variable", () => {
    for (const file of files) expect(readFileSync(file, "utf8"), relative(ROOT, file)).not.toMatch(/NEXT_PUBLIC_OPENROUTER/);
  });
});

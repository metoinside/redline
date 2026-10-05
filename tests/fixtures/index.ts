import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ClauseType =
  | "auto_renewal"
  | "notice_window"
  | "early_termination_fee"
  | "rollover"
  | "multi_year_term";

export const CLAUSE_TYPES: readonly ClauseType[] = [
  "auto_renewal",
  "notice_window",
  "early_termination_fee",
  "rollover",
  "multi_year_term",
];

export type ExpectedTier = "negotiate" | "know";

export interface FixtureExposure {
  money?: string;
  lockIn?: string;
  exitDifficulty?: string;
}

export interface FixtureClause {
  id: string;
  clauseType: ClauseType;
  sentence: string;
  /** What the sentence does, in plain words: what the model should say about it. */
  statement: string;
  expectedTier: ExpectedTier;
  exposure: FixtureExposure;
  /** Present only for a clause that reads two ways. */
  readings?: [string, string];
  why: string;
}

export interface FixtureNoticeObligation {
  sentence: string;
  description: string;
  deadline: string;
}

export interface FixtureOutsideTerms {
  sentence: string;
  document: string;
}

export interface FixtureDecoy {
  sentence: string;
  why: string;
}

export type FixtureQuestion =
  | { question: string; answerable: true; sentence: string; answer: string }
  | { question: string; answerable: false };

export interface FixtureSidecar {
  document: string;
  clauses: FixtureClause[];
  noticeObligations: FixtureNoticeObligation[];
  outsideTerms: FixtureOutsideTerms[];
  decoys: FixtureDecoy[];
  questions: FixtureQuestion[];
}

export type FixtureName = "adhesion-contract" | "clean-document";

export const FIXTURE_NAMES: readonly FixtureName[] = ["adhesion-contract", "clean-document"];

const here = dirname(fileURLToPath(import.meta.url));

export function loadSidecar(name: FixtureName): FixtureSidecar {
  return JSON.parse(readFileSync(join(here, `${name}.json`), "utf8")) as FixtureSidecar;
}

export function loadDocumentText(name: FixtureName): string {
  return readFileSync(join(here, loadSidecar(name).document), "utf8");
}

export function loadFixture(name: FixtureName): { text: string; sidecar: FixtureSidecar } {
  const sidecar = loadSidecar(name);
  return { text: readFileSync(join(here, sidecar.document), "utf8"), sidecar };
}

export const loadAdhesionContract = () => loadFixture("adhesion-contract");
export const loadCleanDocument = () => loadFixture("clean-document");

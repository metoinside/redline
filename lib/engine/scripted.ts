// A model client for tests. It answers each request with the next step of its
// script and records every request it received. It stands in for the model
// only: the verifier, the clause-type rule and analyse run for real around it.

import type { ModelClient, ModelRequest } from "./model";

/** A payload to return, an Error to throw, or a function of the request that returns either. */
export type ScriptStep = unknown | Error | ((request: ModelRequest) => unknown);

export class ScriptedModelClient implements ModelClient {
  readonly requests: ModelRequest[] = [];
  private readonly steps: ScriptStep[];

  constructor(steps: ScriptStep[]) {
    this.steps = [...steps];
  }

  async complete(request: ModelRequest): Promise<unknown> {
    this.requests.push(structuredClone(request));
    if (this.steps.length === 0) {
      throw new Error(`The scripted model client has no answer left for request ${this.requests.length} (${request.task}).`);
    }
    const step = this.steps.shift();
    const value = typeof step === "function" ? (step as (r: ModelRequest) => unknown)(request) : step;
    if (value instanceof Error) throw value;
    // A copy, so the engine can't change what a test holds on to (and vice versa).
    return value === undefined ? undefined : structuredClone(value);
  }
}

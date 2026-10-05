// The only code that calls OpenRouter (docs/agents/build-brief.md, owner's
// answer 1). Server only: it refuses to run where `window` exists, and no
// client component imports it (tests/engine/server-boundary.test.ts). The key
// and the model are read from the environment at call time, never from a
// NEXT_PUBLIC_ variable, and no model id is written in code.

import {
  ModelHttpError,
  ModelNetworkError,
  ModelNotConfiguredError,
  ModelOutputError,
  ModelTimeoutError,
  type ModelClient,
  type ModelRequest,
} from "./model";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Long enough for a 300,000-character contract at low reasoning effort. */
export const DEFAULT_TIMEOUT_MS = 110_000;

export type OpenRouterOptions = {
  /** Stands in for the network in tests. */
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};

function refuseInBrowser() {
  if (typeof window !== "undefined") {
    throw new Error("The OpenRouter client runs on the server only.");
  }
}

function readConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  const model = process.env.OPENROUTER_MODEL?.trim() ?? "";
  const missing = [!apiKey && "OPENROUTER_API_KEY", !model && "OPENROUTER_MODEL"].filter((m): m is string => Boolean(m));
  if (missing.length) throw new ModelNotConfiguredError(missing);
  return { apiKey, model };
}

/** True when both variables are set. Says nothing about whether they work. */
export function isModelConfigured(): boolean {
  try {
    readConfig();
    return true;
  } catch {
    return false;
  }
}

/** Removes secrets from text that came back from the service. */
function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) if (secret) out = out.split(secret).join("[redacted]");
  return out.slice(0, 300);
}

function errorMessageOf(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

export function createOpenRouterClient(options: OpenRouterOptions = {}): ModelClient {
  refuseInBrowser();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async complete(request: ModelRequest): Promise<unknown> {
      refuseInBrowser();
      const { apiKey, model } = readConfig();
      const doFetch = options.fetch ?? globalThis.fetch;

      const body = {
        model,
        messages: request.messages,
        provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true },
        reasoning: { effort: "low" },
        response_format: {
          type: "json_schema",
          json_schema: { name: request.task, strict: true, schema: request.schema },
        },
      };

      const signal = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await doFetch(OPENROUTER_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (signal.aborted) throw new ModelTimeoutError(timeoutMs);
        throw new ModelNetworkError(err);
      }

      let raw: string;
      try {
        raw = await response.text();
      } catch (err) {
        if (signal.aborted) throw new ModelTimeoutError(timeoutMs);
        throw new ModelNetworkError(err);
      }

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (response.status !== 200) {
        throw new ModelHttpError(response.status, redact(errorMessageOf(parsed), [apiKey, model]));
      }
      if (parsed === null || typeof parsed !== "object") {
        throw new ModelOutputError("The model service's response was not JSON.");
      }
      const serviceError = errorMessageOf(parsed);
      if (serviceError) {
        throw new ModelOutputError(`The model service reported an error: ${redact(serviceError, [apiKey, model])}`);
      }

      const choice = (parsed as { choices?: unknown }).choices;
      const first = Array.isArray(choice) ? (choice[0] as { message?: { content?: unknown }; finish_reason?: unknown } | undefined) : undefined;
      if (!first) throw new ModelOutputError("The model service's response had no answer in it.");
      if (first.finish_reason === "length") throw new ModelOutputError("The model's answer was cut off before it finished.");
      const content = first.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        throw new ModelOutputError("The model's answer was empty.");
      }
      try {
        return JSON.parse(content) as unknown;
      } catch {
        throw new ModelOutputError("The model's answer was not valid JSON.");
      }
    },
  };
}

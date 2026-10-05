// The model client seam. The engine talks to a model only through
// ModelClient: the OpenRouter client in production, the scripted client in
// tests. Nothing here reads a key or calls the network.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** A JSON Schema object, as sent in response_format.json_schema.schema. */
export type JsonSchema = { [key: string]: unknown };

export interface ModelRequest {
  /** What the call is for ("analysis", later "answer"). Also names the JSON schema. */
  task: string;
  messages: ChatMessage[];
  /** The shape the answer must take. The model is asked for strict JSON in this shape. */
  schema: JsonSchema;
}

export interface ModelClient {
  /** Sends one request and returns the model's answer parsed from JSON. Throws a ModelError on failure. */
  complete(request: ModelRequest): Promise<unknown>;
}

export type ModelErrorKind = "not-configured" | "http" | "timeout" | "network" | "bad-output";

/** Every way a model call can fail. The message never contains the key or the model id. */
export class ModelError extends Error {
  readonly kind: ModelErrorKind;
  constructor(kind: ModelErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.kind = kind;
  }
}

/** OPENROUTER_API_KEY or OPENROUTER_MODEL is not set. Nothing was sent. */
export class ModelNotConfiguredError extends ModelError {
  readonly missing: string[];
  constructor(missing: string[]) {
    super("not-configured", `The model is not configured: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not set.`);
    this.missing = missing;
  }
}

/** The model service answered with a status other than 200. */
export class ModelHttpError extends ModelError {
  readonly status: number;
  /** The service's own error message, with the key and model id removed. */
  readonly detail: string;
  constructor(status: number, detail: string) {
    super("http", `The model service answered ${status}${detail ? `: ${detail}` : ""}`);
    this.status = status;
    this.detail = detail;
  }
}

/** No answer within the time limit. */
export class ModelTimeoutError extends ModelError {
  constructor(timeoutMs: number) {
    super("timeout", `The model did not answer within ${Math.round(timeoutMs / 1000)} seconds.`);
  }
}

/** The request never reached the model service. */
export class ModelNetworkError extends ModelError {
  constructor(cause: unknown) {
    super("network", "The model service could not be reached.", { cause });
  }
}

/** The answer came back but is not usable JSON in the requested shape. */
export class ModelOutputError extends ModelError {
  constructor(message: string) {
    super("bad-output", message);
  }
}

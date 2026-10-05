import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelHttpError,
  ModelNotConfiguredError,
  ModelOutputError,
  ModelTimeoutError,
  type ModelRequest,
} from "@/lib/engine/model";
import { OPENROUTER_URL, createOpenRouterClient } from "@/lib/engine/openrouter";

// The OpenRouter client, run against a fake fetch. The fake stands in for the
// network only: the client builds its real request and reads a real-shaped
// response. No key or model id appears here; the values below are stand-ins.

const KEY = "test-key-not-real";
const MODEL = "model-named-by-env";

const request: ModelRequest = {
  task: "analysis",
  messages: [
    { role: "system", content: "Find the clauses." },
    { role: "user", content: "The document." },
  ],
  schema: { type: "object", properties: { clauses: { type: "array" } }, required: ["clauses"], additionalProperties: false },
};

type Call = { url: string; init: RequestInit };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return respond(call);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls };
}

function completion(content: string, finish = "stop") {
  return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: finish }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", KEY);
  vi.stubEnv("OPENROUTER_MODEL", MODEL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the request sent to OpenRouter", () => {
  it("posts to the chat completions endpoint with the key, the model from the environment, the provider pin, low reasoning and a strict schema", async () => {
    const { fetch, calls } = fakeFetch(() => completion('{"clauses":[]}'));
    await createOpenRouterClient({ fetch }).complete(request);

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe(OPENROUTER_URL);
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${KEY}`);
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(MODEL);
    expect(body.messages).toEqual(request.messages);
    expect(body.provider).toEqual({ order: ["fireworks"], allow_fallbacks: false, require_parameters: true });
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "analysis", strict: true, schema: request.schema },
    });
    expect(body.stream).not.toBe(true);
  });

  it("reads the environment at call time, not when the client is made", async () => {
    const { fetch, calls } = fakeFetch(() => completion("{}"));
    const client = createOpenRouterClient({ fetch });
    vi.stubEnv("OPENROUTER_MODEL", "another-model-from-env");
    vi.stubEnv("OPENROUTER_API_KEY", "another-key");
    await client.complete(request);
    expect(JSON.parse(String(calls[0].init.body)).model).toBe("another-model-from-env");
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer another-key");
  });

  it("returns the parsed JSON the model wrote", async () => {
    const { fetch } = fakeFetch(() => completion('{"clauses":[{"clause_type":"auto_renewal","sentence":"x"}]}'));
    await expect(createOpenRouterClient({ fetch }).complete(request)).resolves.toEqual({
      clauses: [{ clause_type: "auto_renewal", sentence: "x" }],
    });
  });
});

describe("configuration", () => {
  it.each(["OPENROUTER_API_KEY", "OPENROUTER_MODEL"])("refuses to run without %s, and sends nothing", async (name) => {
    vi.stubEnv(name, "");
    const { fetch, calls } = fakeFetch(() => completion("{}"));
    const error = await createOpenRouterClient({ fetch })
      .complete(request)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelNotConfiguredError);
    expect((error as ModelNotConfiguredError).missing).toContain(name);
    expect(calls).toHaveLength(0);
  });

  it("refuses to run in a browser", async () => {
    vi.stubGlobal("window", {});
    try {
      const { fetch, calls } = fakeFetch(() => completion("{}"));
      expect(() => createOpenRouterClient({ fetch })).toThrow(/server/);
      expect(calls).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("failures", () => {
  it("throws a typed error with the status on a non-200 response, without the key in it", async () => {
    const { fetch } = fakeFetch(
      () => new Response(JSON.stringify({ error: { message: `Bad key ${KEY} for ${MODEL}` } }), { status: 401 }),
    );
    const error = (await createOpenRouterClient({ fetch })
      .complete(request)
      .catch((e: unknown) => e)) as ModelHttpError;
    expect(error).toBeInstanceOf(ModelHttpError);
    expect(error.status).toBe(401);
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain(MODEL);
    expect(error.detail).not.toContain(KEY);
    expect(error.detail).not.toContain(MODEL);
  });

  it.each([
    ["text that isn't JSON", completion("Here are the clauses: none")],
    ["an answer cut off at the length limit", completion('{"clauses":[', "length")],
    ["a response with no choices", new Response(JSON.stringify({ choices: [] }), { status: 200 })],
    ["a body that isn't JSON", new Response("<html>gateway</html>", { status: 200 })],
    [
      "an error inside a 200 response",
      new Response(JSON.stringify({ error: { message: "provider failed", code: 502 } }), { status: 200 }),
    ],
  ])("throws ModelOutputError for %s", async (_label, response) => {
    const { fetch } = fakeFetch(() => response);
    await expect(createOpenRouterClient({ fetch }).complete(request)).rejects.toBeInstanceOf(ModelOutputError);
  });

  it("gives up after its timeout", async () => {
    const { fetch } = fakeFetch(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    await expect(createOpenRouterClient({ fetch, timeoutMs: 20 }).complete(request)).rejects.toBeInstanceOf(ModelTimeoutError);
  });
});

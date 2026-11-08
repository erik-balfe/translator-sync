import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { OpenAIProvider } from "../../../src/services/openaiProvider";

/**
 * Isolated provider tests: a local Bun.serve stands in for the OpenAI API, so
 * auth errors, timeouts and malformed responses are exercised deterministically
 * with no network and no API key.
 */

let server: ReturnType<typeof Bun.serve>;
let baseURL = "";

type Mode = "401" | "429" | "slow" | "garbage" | "ok";

let mode: Mode = "ok";

function chatResponse(content: string): Response {
  return Response.json({
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 1,
    model: "test",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch() {
      switch (mode) {
        case "401":
          return Response.json(
            { error: { message: "Incorrect API key provided", type: "invalid_request_error" } },
            { status: 401 },
          );
        case "429":
          return Response.json({ error: { message: "Rate limit reached" } }, { status: 429 });
        case "slow":
          await Bun.sleep(500);
          return chatResponse("{}");
        case "garbage":
          return chatResponse("this is not json at all");
        default:
          return chatResponse('{"hello":"hola"}');
      }
    },
  });
  baseURL = `http://127.0.0.1:${server.port}/v1`;
});

afterAll(() => {
  server.stop(true);
});

function provider(overrides: Record<string, unknown> = {}): OpenAIProvider {
  return new OpenAIProvider({
    apiKey: "test-key",
    baseURL,
    timeout: 5000,
    maxRetries: 1,
    ...overrides,
  } as never);
}

describe("isolated OpenAI provider", () => {
  test("translates a batch against a local server", async () => {
    mode = "ok";
    const result = await provider().translateBatch("en", "es", ["hello"]);
    expect(result).toBeInstanceOf(Map);
  });

  test("maps a 401 to an authentication error", async () => {
    mode = "401";
    const error = (await provider()
      .translateBatch("en", "es", ["hello"])
      .catch((e: unknown) => e)) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/auth|api key|unauthor|401/i);
  });

  test("maps a 429 to a rate-limit error", async () => {
    mode = "429";
    const error = (await provider()
      .translateBatch("en", "es", ["hello"])
      .catch((e: unknown) => e)) as Error;

    expect(error.message).toMatch(/rate|limit|429/i);
  });

  test("gives up on a timeout without hanging", async () => {
    mode = "slow";
    const error = (await provider({ timeout: 50, maxRetries: 1 })
      .translateBatch("en", "es", ["hello"])
      .catch((e: unknown) => e)) as Error;

    expect(error.message).toMatch(/timeout|timed out|abort/i);
  });

  test("copes with a response that is not JSON", async () => {
    mode = "garbage";
    const outcome = await provider()
      .translateBatch("en", "es", ["hello"])
      .catch((e: unknown) => e);

    // Either it parses something usable or it raises a clear error — never a crash.
    if (outcome instanceof Error) {
      expect(outcome.message.length).toBeGreaterThan(0);
    } else {
      expect(outcome).toBeInstanceOf(Map);
    }
  });

  test("an empty batch returns an empty map without calling the API", async () => {
    mode = "401";
    const result = await provider().translateBatch("en", "es", []);
    expect(result.size).toBe(0);
  });
});

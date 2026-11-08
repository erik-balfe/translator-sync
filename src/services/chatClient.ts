/**
 * Minimal OpenAI-compatible chat client built on `fetch`.
 *
 * The `openai` SDK was only ever used for `chat.completions.create`. Shipping it
 * pulled a dependency tree into the build for one HTTP POST. This client keeps
 * the exact object shape the providers call (`client.chat.completions.create`),
 * so provider code and the tests that inject a mock client are unchanged.
 *
 * If `fetchImpl` is not supplied the global `fetch` is used: available in Node
 * 18+ and in Bun, so the published package still runs under both.
 */

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  choices: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface ChatClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export class ChatCompletionError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ChatCompletionError";
    this.status = status;
  }
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function joinUrl(baseURL: string, path: string): string {
  return `${baseURL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** Turns an HTTP failure into a message the providers' `handleError` understands. */
function describeFailure(status: number, body: string): string {
  const detail = body.slice(0, 300).trim();
  if (status === 401 || status === 403) {
    return `401 Unauthorized: authentication failed (${detail || "check the API key"})`;
  }
  if (status === 429) {
    return `429 Too Many Requests: rate limit exceeded (${detail || "retry later"})`;
  }
  if (status >= 500) {
    return `${status} Server error: the provider is unavailable (${detail})`;
  }
  return `${status} Bad request: ${detail || "the request was rejected"}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createChatClient(config: ChatClientConfig): {
  chat: { completions: { create: (req: ChatCompletionRequest) => Promise<ChatCompletionResponse> } };
} {
  const baseURL = config.baseURL ?? DEFAULT_BASE_URL;
  const timeout = config.timeout ?? 30_000;
  const maxRetries = config.maxRetries ?? 0;
  const doFetch = config.fetchImpl ?? fetch;

  async function create(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    let lastError: Error = new ChatCompletionError("request never ran");

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await doFetch(joinUrl(baseURL, "chat/completions"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          const error = new ChatCompletionError(
            describeFailure(response.status, body),
            response.status,
          );
          // Only 429 and 5xx are worth retrying.
          if (response.status !== 429 && response.status < 500) throw error;
          lastError = error;
        } else {
          return (await response.json()) as ChatCompletionResponse;
        }
      } catch (error) {
        if (error instanceof ChatCompletionError) {
          if (error.status !== undefined && error.status !== 429 && error.status < 500) {
            throw error;
          }
          lastError = error;
        } else if ((error as Error)?.name === "AbortError") {
          lastError = new ChatCompletionError(
            `Timeout: the request exceeded ${timeout}ms and was aborted`,
          );
        } else {
          lastError = new ChatCompletionError(
            `Network error: ${(error as Error)?.message ?? "unknown failure"}`,
          );
        }
      } finally {
        clearTimeout(timer);
      }

      if (attempt < maxRetries) await sleep(2 ** attempt * 1000);
    }

    throw lastError;
  }

  return { chat: { completions: { create } } };
}

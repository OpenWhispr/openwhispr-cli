import { authFailure, backendUnreachable, CliError, notFound } from "./errors.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  form?: FormData;
}

export interface HttpClientOptions {
  baseUrl: string;
  authToken: string;
  pathPrefix?: string;
  unreachableLabel: string;
  authLabel: string;
  serverErrorLabel: string;
  defaultTimeoutMs?: number;
}

export class HttpClient {
  constructor(private readonly opts: HttpClientOptions) {}

  async fetchRaw(req: HttpRequest, timeoutMs?: number): Promise<Response> {
    const prefix = this.opts.pathPrefix ?? "";
    const url = new URL(`${prefix}${req.path}`, this.opts.baseUrl);
    if (req.query) {
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const controller = new AbortController();
    const effectiveTimeout = timeoutMs ?? this.opts.defaultTimeoutMs ?? 15_000;
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      return await fetch(url, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${this.opts.authToken}`,
          ...(req.body && !req.form ? { "Content-Type": "application/json" } : {}),
        },
        body: req.form ?? (req.body ? JSON.stringify(req.body) : undefined),
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw backendUnreachable(`${this.opts.unreachableLabel}: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async request(req: HttpRequest, timeoutMs?: number): Promise<unknown> {
    const res = await this.fetchRaw(req, timeoutMs);
    if (res.status === 204) return undefined;

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (res.ok) return parsed;

    const { code, message = `HTTP ${res.status}` } = extractError(parsed);
    if (res.status === 401 || res.status === 403) {
      throw authFailure(`${this.opts.authLabel}: ${message}`);
    }
    if (res.status === 404) throw notFound(message);
    if (res.status >= 500) throw backendUnreachable(`${this.opts.serverErrorLabel}: ${message}`);
    throw new CliError(1, message, code);
  }
}

function extractError(parsed: unknown): { code?: string; message?: string } {
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed === "string") return { message: parsed };
  if (typeof parsed !== "object") return {};
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.error === "string") return { message: obj.error };
  if (obj.error && typeof obj.error === "object") {
    const inner = obj.error as Record<string, unknown>;
    if (typeof inner.message === "string") {
      return {
        code: typeof inner.code === "string" ? inner.code : undefined,
        message: inner.message,
      };
    }
  }
  if (typeof obj.message === "string") return { message: obj.message };
  return {};
}

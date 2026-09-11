import { spawnSync } from "node:child_process";
import { promises as fs, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { authFailure, CliError, notFound, userError } from "../lib/errors.js";
import { HttpClient } from "../lib/http.js";
import type {
  AddSnippetParams,
  Backend,
  CreateFolderParams,
  CreateNoteParams,
  DictionaryEntry,
  Folder,
  ListNotesParams,
  ListTranscriptionsParams,
  Note,
  Snippet,
  TranscribeParams,
  TranscribeResult,
  Transcription,
  UpdateNoteParams,
} from "./types.js";
import { unwrapV1, unwrapV1List } from "./v1-envelope.js";

const MAX_UPLOAD_BYTES = 4_000_000;
const CHUNK_SECONDS = 240;
const TRANSCRIBE_TIMEOUT_MS = 5 * 60_000;

const AUDIO_TYPES: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

interface RemoteTranscribeResponse {
  text: string;
  language?: string;
  duration_ms?: number;
  provider?: string;
  model?: string;
  beta?: boolean;
}

export class RemoteBackend implements Backend {
  readonly kind = "remote" as const;
  readonly description: string;
  private readonly http: HttpClient;

  constructor(apiBase: string, apiKey: string) {
    if (!apiKey) throw authFailure("No API key configured. Run `openwhispr auth login`.");
    this.description = `remote API (${apiBase})`;
    this.http = new HttpClient({
      baseUrl: apiBase,
      authToken: apiKey,
      pathPrefix: "/api/v1",
      unreachableLabel: "Remote API unreachable",
      authLabel: "Remote API auth failed",
      serverErrorLabel: "Remote API error",
      defaultTimeoutMs: 15_000,
    });
  }

  async ping(timeoutMs = 3000): Promise<boolean> {
    try {
      const res = await this.http.fetchRaw({ method: "GET", path: "/usage" }, timeoutMs);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async listNotes(params: ListNotesParams): Promise<Note[]> {
    return unwrapV1List<Note>(
      await this.http.request({
        method: "GET",
        path: "/notes/list",
        query: { folder_id: params.folderId, limit: params.limit },
      })
    );
  }

  async getNote(id: string): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({ method: "GET", path: `/notes/${encodeURIComponent(id)}` })
    );
  }

  async createNote(params: CreateNoteParams): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({
        method: "POST",
        path: "/notes/create",
        body: {
          content: params.content,
          title: params.title,
          folder_id: params.folderId,
        },
      })
    );
  }

  async updateNote(id: string, params: UpdateNoteParams): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({
        method: "PATCH",
        path: `/notes/${encodeURIComponent(id)}`,
        body: {
          content: params.content,
          title: params.title,
          folder_id: params.folderId,
        },
      })
    );
  }

  async deleteNote(id: string): Promise<void> {
    await this.http.request({ method: "DELETE", path: `/notes/${encodeURIComponent(id)}` });
  }

  async searchNotes(query: string, limit?: number): Promise<Note[]> {
    if (!query) throw userError("Search query is required.");
    return unwrapV1List<Note>(
      await this.http.request({
        method: "POST",
        path: "/notes/search",
        body: { query, limit },
      })
    );
  }

  async listFolders(): Promise<Folder[]> {
    return unwrapV1List<Folder>(await this.http.request({ method: "GET", path: "/folders/list" }));
  }

  async createFolder(params: CreateFolderParams): Promise<Folder> {
    return unwrapV1<Folder>(
      await this.http.request({
        method: "POST",
        path: "/folders/create",
        body: { name: params.name, sort_order: params.sortOrder },
      })
    );
  }

  async listTranscriptions(params: ListTranscriptionsParams): Promise<Transcription[]> {
    return unwrapV1List<Transcription>(
      await this.http.request({
        method: "GET",
        path: "/transcriptions/list",
        query: { limit: params.limit },
      })
    );
  }

  async getTranscription(id: string): Promise<Transcription> {
    return unwrapV1<Transcription>(
      await this.http.request({
        method: "GET",
        path: `/transcriptions/${encodeURIComponent(id)}`,
      })
    );
  }

  async deleteTranscription(id: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: `/transcriptions/${encodeURIComponent(id)}`,
    });
  }

  async deleteAudio(_transcriptionId: string): Promise<void> {
    throw userError(
      "Audio deletion is only supported with the local backend (the cloud API doesn't store audio)."
    );
  }

  async listDictionary(): Promise<DictionaryEntry[]> {
    return this.listAll<DictionaryEntry>("/dictionary/list");
  }

  async addDictionaryWords(words: string[]): Promise<DictionaryEntry[]> {
    return unwrapV1List<DictionaryEntry>(
      await this.http.request({ method: "POST", path: "/dictionary/create", body: { words } })
    );
  }

  async removeDictionaryWords(words: string[]): Promise<number> {
    const entries = await this.listDictionary();
    return this.deleteMatching("/dictionary", "Dictionary word", entries, (e) => e.word, words);
  }

  async listSnippets(): Promise<Snippet[]> {
    return this.listAll<Snippet>("/snippets/list");
  }

  async addSnippet(params: AddSnippetParams): Promise<Snippet> {
    return unwrapV1<Snippet>(
      await this.http.request({
        method: "POST",
        path: "/snippets/create",
        body: { trigger: params.trigger, replacement: params.replacement },
      })
    );
  }

  async removeSnippets(triggers: string[]): Promise<number> {
    const snippets = await this.listSnippets();
    return this.deleteMatching(
      "/snippets",
      "Snippet trigger",
      snippets,
      (s) => s.trigger,
      triggers
    );
  }

  async transcribe(params: TranscribeParams): Promise<TranscribeResult> {
    if (params.model) {
      throw userError(
        "--model only applies to local transcription. Drop --remote to use the desktop app's models, or drop --model to use the cloud default."
      );
    }
    const { size } = await fs.stat(params.path);
    if (size <= MAX_UPLOAD_BYTES) return this.transcribeUpload(params.path, params);

    if (spawnSync("ffmpeg", ["-version"]).status !== 0) {
      throw userError(
        "This file is over 4 MB, the cloud limit per request. Install ffmpeg so the CLI can split it into 4-minute chunks, or transcribe it locally with the desktop app running."
      );
    }
    const dir = await fs.mkdtemp(join(tmpdir(), "openwhispr-transcribe-"));
    const removeDir = (): void => rmSync(dir, { recursive: true, force: true });
    const onInterrupt = (): void => {
      removeDir();
      process.exit(130);
    };
    process.once("SIGINT", onInterrupt);
    try {
      const chunks = splitAudio(params.path, dir);
      const results: TranscribeResult[] = [];
      for (const [i, chunk] of chunks.entries()) {
        try {
          results.push(await this.transcribeUpload(chunk, params));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const exitCode = err instanceof CliError ? err.exitCode : 1;
          throw new CliError(exitCode, `Chunk ${i + 1} of ${chunks.length} failed: ${message}`);
        }
      }
      return {
        ...results[0],
        text: results
          .map((r) => r.text.trim())
          .filter(Boolean)
          .join(" "),
        durationMs: results.reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
      };
    } finally {
      process.off("SIGINT", onInterrupt);
      removeDir();
    }
  }

  private async transcribeUpload(
    filePath: string,
    params: Pick<TranscribeParams, "language" | "prompt">
  ): Promise<TranscribeResult> {
    const form = new FormData();
    const type = AUDIO_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    form.append("file", new Blob([await fs.readFile(filePath)], { type }), basename(filePath));
    if (params.language) form.append("language", params.language);
    if (params.prompt) form.append("prompt", params.prompt);
    const result = unwrapV1<RemoteTranscribeResponse>(
      await this.http.request({ method: "POST", path: "/transcribe", form }, TRANSCRIBE_TIMEOUT_MS)
    );
    return {
      text: result.text,
      language: result.language,
      durationMs: result.duration_ms,
      provider: result.provider,
      model: result.model,
      beta: result.beta,
    };
  }

  private async listAll<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const page = (await this.http.request({
        method: "GET",
        path,
        query: { limit: 500, cursor },
      })) as { has_more?: boolean; next_cursor?: string | null };
      items.push(...unwrapV1List<T>(page));
      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return items;
  }

  private async deleteMatching<T extends { id?: string }>(
    basePath: string,
    label: string,
    items: T[],
    keyOf: (item: T) => string,
    keys: string[]
  ): Promise<number> {
    const byKey = new Map(items.map((item) => [normalize(keyOf(item)), item]));
    // Dedupe so "remove foo Foo" deletes once instead of 404ing on the repeat.
    const requested = new Map(keys.map((key) => [normalize(key), key]));
    const missing: string[] = [];
    let removed = 0;
    for (const [normalized, key] of requested) {
      const match = byKey.get(normalized);
      if (!match?.id) {
        missing.push(key);
        continue;
      }
      await this.http.request({
        method: "DELETE",
        path: `${basePath}/${encodeURIComponent(match.id)}`,
      });
      removed++;
    }
    if (missing.length > 0) {
      throw notFound(`${label} not found: ${missing.join(", ")}`);
    }
    return removed;
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

// Mirrors the desktop app's splitAudioFile settings; 64 kbps mono keeps each chunk under ~2 MB.
function splitAudio(input: string, dir: string): string[] {
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-loglevel",
      "error",
      "-i",
      input,
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-c:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-ar",
      "16000",
      "-ac",
      "1",
      join(dir, "chunk-%03d.mp3"),
    ],
    { encoding: "utf8" }
  );
  if (ffmpeg.status !== 0) {
    throw userError(
      `ffmpeg could not split the audio file; check that it is a valid audio file. ffmpeg said: ${ffmpeg.stderr.trim()}`
    );
  }
  return readdirSync(dir)
    .filter((name) => name.startsWith("chunk-"))
    .sort()
    .map((name) => join(dir, name));
}

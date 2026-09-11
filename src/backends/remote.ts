import { authFailure, notFound, userError } from "../lib/errors.js";
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
  Transcription,
  UpdateNoteParams,
} from "./types.js";
import { unwrapV1, unwrapV1List } from "./v1-envelope.js";

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
    const missing: string[] = [];
    let removed = 0;
    for (const key of keys) {
      const match = byKey.get(normalize(key));
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

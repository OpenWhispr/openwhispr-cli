import type { BridgeFile } from "../lib/config.js";
import { userError } from "../lib/errors.js";
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

export class LocalBackend implements Backend {
  readonly kind = "local" as const;
  readonly description: string;
  private readonly http: HttpClient;

  constructor(bridge: BridgeFile) {
    this.description = `local desktop bridge (127.0.0.1:${bridge.port})`;
    this.http = new HttpClient({
      baseUrl: `http://127.0.0.1:${bridge.port}`,
      authToken: bridge.token,
      unreachableLabel: "Local desktop bridge unreachable",
      authLabel: "Local bridge auth failed",
      serverErrorLabel: "Local bridge error",
      defaultTimeoutMs: 10_000,
    });
  }

  async ping(timeoutMs = 1500): Promise<boolean> {
    try {
      const res = await this.http.fetchRaw({ method: "GET", path: "/v1/health" }, timeoutMs);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async listNotes(params: ListNotesParams): Promise<Note[]> {
    return unwrapV1List<Note>(
      await this.http.request({
        method: "GET",
        path: "/v1/notes/list",
        query: { folder_id: params.folderId, limit: params.limit },
      })
    );
  }

  async getNote(id: string): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({ method: "GET", path: `/v1/notes/${encodeURIComponent(id)}` })
    );
  }

  async createNote(params: CreateNoteParams): Promise<Note> {
    return unwrapV1<Note>(
      await this.http.request({
        method: "POST",
        path: "/v1/notes/create",
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
        path: `/v1/notes/${encodeURIComponent(id)}`,
        body: {
          content: params.content,
          title: params.title,
          folder_id: params.folderId,
        },
      })
    );
  }

  async deleteNote(id: string): Promise<void> {
    await this.http.request({ method: "DELETE", path: `/v1/notes/${encodeURIComponent(id)}` });
  }

  async searchNotes(query: string, limit?: number): Promise<Note[]> {
    if (!query) throw userError("Search query is required.");
    return unwrapV1List<Note>(
      await this.http.request({
        method: "GET",
        path: "/v1/notes/search",
        query: { q: query, limit },
      })
    );
  }

  async listFolders(): Promise<Folder[]> {
    return unwrapV1List<Folder>(
      await this.http.request({ method: "GET", path: "/v1/folders/list" })
    );
  }

  async createFolder(params: CreateFolderParams): Promise<Folder> {
    return unwrapV1<Folder>(
      await this.http.request({
        method: "POST",
        path: "/v1/folders/create",
        body: { name: params.name, sort_order: params.sortOrder },
      })
    );
  }

  async listTranscriptions(params: ListTranscriptionsParams): Promise<Transcription[]> {
    return unwrapV1List<Transcription>(
      await this.http.request({
        method: "GET",
        path: "/v1/transcriptions/list",
        query: { limit: params.limit },
      })
    );
  }

  async getTranscription(id: string): Promise<Transcription> {
    return unwrapV1<Transcription>(
      await this.http.request({
        method: "GET",
        path: `/v1/transcriptions/${encodeURIComponent(id)}`,
      })
    );
  }

  async deleteTranscription(id: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: `/v1/transcriptions/${encodeURIComponent(id)}`,
    });
  }

  async deleteAudio(transcriptionId: string): Promise<void> {
    await this.http.request({
      method: "DELETE",
      path: `/v1/transcriptions/${encodeURIComponent(transcriptionId)}/audio`,
    });
  }

  async listDictionary(): Promise<DictionaryEntry[]> {
    const words = unwrapV1List<string>(
      await this.http.request({ method: "GET", path: "/v1/dictionary/list" })
    );
    return words.map((word) => ({ word }));
  }

  async addDictionaryWords(words: string[]): Promise<DictionaryEntry[]> {
    const result = unwrapV1<{ words: string[] }>(
      await this.http.request({
        method: "POST",
        path: "/v1/dictionary/update",
        body: { add: words },
      })
    );
    return result.words.map((word) => ({ word }));
  }

  async removeDictionaryWords(words: string[]): Promise<number> {
    const result = unwrapV1<{ removed: number }>(
      await this.http.request({
        method: "POST",
        path: "/v1/dictionary/update",
        body: { remove: words },
      })
    );
    return result.removed;
  }

  async listSnippets(): Promise<Snippet[]> {
    return unwrapV1List<Snippet>(
      await this.http.request({ method: "GET", path: "/v1/snippets/list" })
    );
  }

  async addSnippet(params: AddSnippetParams): Promise<Snippet> {
    const result = unwrapV1<{ snippets: Snippet[] }>(
      await this.http.request({
        method: "POST",
        path: "/v1/snippets/update",
        body: { add: [params] },
      })
    );
    const trigger = params.trigger.trim().toLowerCase();
    return result.snippets.find((s) => s.trigger.trim().toLowerCase() === trigger) ?? params;
  }

  async removeSnippets(triggers: string[]): Promise<number> {
    const result = unwrapV1<{ removed: number }>(
      await this.http.request({
        method: "POST",
        path: "/v1/snippets/update",
        body: { remove: triggers },
      })
    );
    return result.removed;
  }
}

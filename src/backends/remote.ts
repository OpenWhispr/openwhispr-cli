import { authFailure, userError } from "../lib/errors.js";
import { HttpClient } from "../lib/http.js";
import type {
  Backend,
  CreateFolderParams,
  CreateNoteParams,
  Folder,
  ListNotesParams,
  ListTranscriptionsParams,
  Note,
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
}

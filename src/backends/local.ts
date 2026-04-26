import type { BridgeFile } from "../lib/config.js";
import { userError } from "../lib/errors.js";
import { HttpClient } from "../lib/http.js";
import type {
  Backend,
  CreateFolderParams,
  CreateNoteParams,
  FinalizeMeetingParams,
  FinalizeMeetingResult,
  Folder,
  ListNotesParams,
  ListTranscriptionsParams,
  Note,
  Transcription,
  UpdateNoteParams,
} from "./types.js";
import { unwrapV1, unwrapV1List } from "./v1-envelope.js";

interface LocalFinalizeResponse {
  success: boolean;
  dryRun?: boolean;
  note?: Note;
  transcriptionId?: string | number;
  folderId?: string | number;
  folderName?: string;
  title?: string;
  transcriptionDeleted?: boolean;
}

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
          source_transcription_id: params.sourceTranscriptionId,
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

  async finalizeMeeting(params: FinalizeMeetingParams): Promise<FinalizeMeetingResult> {
    const raw = unwrapV1<LocalFinalizeResponse>(
      await this.http.request({
        method: "POST",
        path: "/v1/meeting/finalize",
        body: {
          transcription_id: params.transcriptionId,
          folder_id: params.folderId,
          content: params.content,
          title: params.title,
          dry_run: params.dryRun ?? false,
        },
      })
    );
    return {
      dry_run: !!raw.dryRun,
      note_id: raw.note?.id ?? null,
      transcription_id: params.transcriptionId,
      folder_id: params.folderId,
      transcription_deleted: !!raw.transcriptionDeleted,
    };
  }
}

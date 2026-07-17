export type BackendKind = "local" | "remote";

export interface Note {
  id: number | string;
  title?: string | null;
  content?: string;
  enhanced_content?: string | null;
  transcript?: string | null;
  folder_id?: number | string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Folder {
  id: number | string;
  name: string;
  sort_order?: number | null;
}

export interface Transcription {
  id: number | string;
  text?: string;
  status?: string;
  created_at?: string;
  duration?: number | null;
}

export interface ListNotesParams {
  folderId?: string;
  limit?: number;
}

export interface CreateNoteParams {
  content: string;
  title?: string;
  folderId?: string;
}

export interface UpdateNoteParams {
  content?: string;
  title?: string;
  folderId?: string;
}

export interface CreateFolderParams {
  name: string;
  sortOrder?: number;
}

export interface ListTranscriptionsParams {
  limit?: number;
}

export interface Backend {
  readonly kind: BackendKind;
  readonly description: string;

  listNotes(params: ListNotesParams): Promise<Note[]>;
  getNote(id: string): Promise<Note>;
  createNote(params: CreateNoteParams): Promise<Note>;
  updateNote(id: string, params: UpdateNoteParams): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  searchNotes(query: string, limit?: number): Promise<Note[]>;

  listFolders(): Promise<Folder[]>;
  createFolder(params: CreateFolderParams): Promise<Folder>;

  listTranscriptions(params: ListTranscriptionsParams): Promise<Transcription[]>;
  getTranscription(id: string): Promise<Transcription>;
  deleteTranscription(id: string): Promise<void>;

  deleteAudio(transcriptionId: string): Promise<void>;
}

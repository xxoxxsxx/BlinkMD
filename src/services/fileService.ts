import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { DocumentModel } from "../state/documentStore";

type FileAction = "open" | "save";

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

type OpenFilePayload = {
  path: string;
  content: string;
};

type FileCommandErrorPayload = {
  code?: string;
  message?: string;
};

export class FileOperationCancelledError extends Error {
  constructor(action: FileAction) {
    super(`File ${action} was cancelled.`);
    this.name = "FileOperationCancelledError";
  }
}

export class FileOperationError extends Error {
  readonly code: string | null;

  constructor(action: FileAction, message: string, code: string | null = null) {
    super(`File ${action} failed: ${message}`);
    this.name = "FileOperationError";
    this.code = code;
  }
}

function isTauriRuntime(): boolean {
  return Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function getDisplayName(path: string | null): string {
  if (!path) {
    return "Untitled.md";
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "Untitled.md";
}

export function toFileOperationError(action: FileAction, error: unknown): FileOperationError {
  if (error instanceof FileOperationError) {
    return error;
  }

  if (error instanceof Error) {
    return new FileOperationError(action, error.message, null);
  }

  if (typeof error === "object" && error !== null) {
    const payload = error as FileCommandErrorPayload;
    if (typeof payload.message === "string") {
      const code = typeof payload.code === "string" ? payload.code : null;
      return new FileOperationError(action, payload.message, code);
    }
  }

  return new FileOperationError(action, "Unknown file operation error.", null);
}

async function openFileInBrowser(): Promise<DocumentModel> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt,text/markdown,text/plain";

  const selectedFile = await new Promise<File | null>((resolve) => {
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    input.click();
  });

  if (!selectedFile) {
    throw new FileOperationCancelledError("open");
  }

  const content = await selectedFile.text();
  return {
    path: selectedFile.name,
    content,
    isDirty: false,
    updatedAt: Date.now()
  };
}

async function saveFileInBrowser(fileName: string, content: string): Promise<string> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return fileName;
}

async function openFileInTauri(): Promise<DocumentModel> {
  const selectedPath = await open({
    multiple: false,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (!selectedPath || Array.isArray(selectedPath)) {
    throw new FileOperationCancelledError("open");
  }

  try {
    const payload = await invoke<OpenFilePayload>("open_file", { path: selectedPath });
    return {
      path: payload.path,
      content: payload.content,
      isDirty: false,
      updatedAt: Date.now()
    };
  } catch (error) {
    throw toFileOperationError("open", error);
  }
}

async function saveFileInTauri(path: string, content: string): Promise<string> {
  try {
    return await invoke<string>("save_file", { path, content });
  } catch (error) {
    throw toFileOperationError("save", error);
  }
}

async function saveFileAsInTauri(doc: DocumentModel): Promise<string> {
  const defaultPath = getDisplayName(doc.path);
  const selectedPath = await save({
    defaultPath,
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (!selectedPath) {
    throw new FileOperationCancelledError("save");
  }

  try {
    return await invoke<string>("save_file_as", { path: selectedPath, content: doc.content });
  } catch (error) {
    throw toFileOperationError("save", error);
  }
}

export async function openFile(): Promise<DocumentModel> {
  if (isTauriRuntime()) {
    return openFileInTauri();
  }
  return openFileInBrowser();
}

export async function saveFile(doc: DocumentModel): Promise<string> {
  if (isTauriRuntime()) {
    if (!doc.path) {
      return saveFileAs(doc);
    }
    return saveFileInTauri(doc.path, doc.content);
  }

  if (!doc.path) {
    return saveFileAs(doc);
  }
  return saveFileInBrowser(doc.path, doc.content);
}

export async function saveFileAs(doc: DocumentModel): Promise<string> {
  if (isTauriRuntime()) {
    return saveFileAsInTauri(doc);
  }

  const fallbackName = doc.path ?? "Untitled.md";
  const typedName = window.prompt("Save as file name:", fallbackName)?.trim();
  if (!typedName) {
    throw new FileOperationCancelledError("save");
  }
  return saveFileInBrowser(typedName, doc.content);
}

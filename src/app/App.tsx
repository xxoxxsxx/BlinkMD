import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorPane } from "../editor/EditorPane";
import { PreviewPane } from "../preview/PreviewPane";
import { getInitialDocumentState, type DocumentModel, type ViewMode } from "../state/documentStore";
import {
  FileOperationError,
  FileOperationCancelledError,
  openFile,
  openFileByPath,
  saveFile,
  saveFileAs
} from "../services/fileService";
import { resolveCloseRequest } from "./closeGuard";
import { resolveShortcutCommand } from "./shortcutKeymap";
import brandLogo from "../assets/logo-transparent.png";
import "./App.css";

const TAURI_SHORTCUT_EDIT_EVENT = "blinkmd://shortcut-edit-mode";
const TAURI_SHORTCUT_PREVIEW_EVENT = "blinkmd://shortcut-preview-mode";
const TAURI_SHORTCUT_SPLIT_EVENT = "blinkmd://shortcut-split-mode";
const PREVIEW_DEBOUNCE_MS = 120;
const LARGE_FILE_PREVIEW_DEBOUNCE_MS = 420;
const LARGE_FILE_THRESHOLD_BYTES = 1024 * 1024;
const CJK_CHAR_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const LATIN_CHAR_REGEX = /[\p{Script=Latin}]/u;
const DROP_SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt"];
const DROP_UNSUPPORTED_FILE_MESSAGE = "Drop ignored: only .md/.markdown/.txt are supported.";
let globalCloseGuardUnlisten: null | (() => void) = null;

function countWords(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) {
    return 0;
  }

  const cjkCharCount = (content.match(CJK_CHAR_REGEX) ?? []).length;
  const latinWordCount = content
    .split(/\s+/)
    .filter(Boolean)
    .reduce((count, token) => count + (LATIN_CHAR_REGEX.test(token) ? 1 : 0), 0);

  return cjkCharCount + latinWordCount;
}

function getFileName(path: string | null): string {
  if (!path) {
    return "Untitled.md";
  }
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "Untitled.md";
}

function getUtf8SizeInBytes(content: string): number {
  return new TextEncoder().encode(content).length;
}

function isSupportedDropPath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return DROP_SUPPORTED_EXTENSIONS.some((extension) => normalizedPath.endsWith(extension));
}

function isPointInsideRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isDropPositionInsideWorkspace(rect: DOMRect, position: { x: number; y: number }): boolean {
  const scale = window.devicePixelRatio || 1;
  if (isPointInsideRect(rect, position.x, position.y)) {
    return true;
  }
  if (scale <= 1) {
    return false;
  }
  return isPointInsideRect(rect, position.x / scale, position.y / scale);
}

export function App() {
  type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };
  const isTauriRuntime = Boolean((window as TauriWindow).__TAURI_INTERNALS__);

  const [documentState, setDocumentState] = useState<DocumentModel>(getInitialDocumentState());
  const [mode, setMode] = useState<ViewMode>("edit");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [previewContent, setPreviewContent] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const latestContentRef = useRef(documentState.content);
  const closeGuardActiveRef = useRef(false);
  const isDirtyRef = useRef(documentState.isDirty);
  const isBusyRef = useRef(isBusy);
  const onSaveRef = useRef(onSave);
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);

  const wordCount = useMemo(() => countWords(documentState.content), [documentState.content]);
  const contentSizeBytes = useMemo(
    () => getUtf8SizeInBytes(documentState.content),
    [documentState.content]
  );
  const isLargeDocument = contentSizeBytes > LARGE_FILE_THRESHOLD_BYTES;
  const previewDebounceMs = isLargeDocument ? LARGE_FILE_PREVIEW_DEBOUNCE_MS : PREVIEW_DEBOUNCE_MS;
  const dirtyStatusText = documentState.isDirty ? "Dirty ● Unsaved" : "Dirty ○ Saved";

  useEffect(() => {
    latestContentRef.current = documentState.content;
  }, [documentState.content]);

  useEffect(() => {
    isDirtyRef.current = documentState.isDirty;
  }, [documentState.isDirty]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Split 模式下编辑区与预览区滚动同步
  useEffect(() => {
    if (mode !== "split" || !workspaceRef.current) {
      return;
    }

    const editor = workspaceRef.current.querySelector<HTMLElement>(".cm-scroller");
    const preview = workspaceRef.current.querySelector<HTMLElement>(".preview-pane");
    if (!editor || !preview) {
      return;
    }

    let syncSource: "editor" | "preview" | null = null;

    function onEditorScroll() {
      if (syncSource === "preview") {
        return;
      }
      syncSource = "editor";
      const maxScroll = editor!.scrollHeight - editor!.clientHeight;
      const ratio = maxScroll > 0 ? editor!.scrollTop / maxScroll : 0;
      preview!.scrollTop = ratio * (preview!.scrollHeight - preview!.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    function onPreviewScroll() {
      if (syncSource === "editor") {
        return;
      }
      syncSource = "preview";
      const maxScroll = preview!.scrollHeight - preview!.clientHeight;
      const ratio = maxScroll > 0 ? preview!.scrollTop / maxScroll : 0;
      editor!.scrollTop = ratio * (editor!.scrollHeight - editor!.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    editor.addEventListener("scroll", onEditorScroll);
    preview.addEventListener("scroll", onPreviewScroll);
    return () => {
      editor.removeEventListener("scroll", onEditorScroll);
      preview.removeEventListener("scroll", onPreviewScroll);
    };
  }, [mode]);

  const switchMode = useCallback((nextMode: ViewMode, message?: string) => {
    if (nextMode === "preview" || nextMode === "split") {
      setPreviewContent(latestContentRef.current);
    }
    setMode(nextMode);
    if (message) {
      setStatusMessage(message);
    }
  }, []);

  const applyOpenedDocument = useCallback((nextDoc: DocumentModel, message: string = "File opened.") => {
    setDocumentState(nextDoc);
    switchMode("preview");
    setCursor({ line: 1, column: 1 });
    setStatusMessage(message);
  }, [switchMode]);

  const reportOpenError = useCallback((error: unknown) => {
    if (error instanceof FileOperationCancelledError) {
      setStatusMessage("Open cancelled.");
      return;
    }
    if (error instanceof FileOperationError) {
      setStatusMessage(error.message);
      return;
    }
    setStatusMessage("Open failed.");
  }, []);

  const confirmOpenWhenDirty = useCallback(async (): Promise<boolean> => {
    if (!isDirtyRef.current) {
      return true;
    }

    if (isTauriRuntime) {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return ask("You have unsaved changes. Continue opening another file?", {
        title: "Unsaved Changes",
        kind: "warning",
        okLabel: "Continue",
        cancelLabel: "Cancel"
      });
    }

    return window.confirm("You have unsaved changes. Continue opening another file?");
  }, [isTauriRuntime]);

  const onOpenDroppedPath = useCallback(async (path: string, ignoredFileCount: number) => {
    if (isBusyRef.current) {
      setStatusMessage("Drop ignored because another operation is running.");
      return;
    }

    const shouldContinue = await confirmOpenWhenDirty();
    if (!shouldContinue) {
      setStatusMessage("Open cancelled.");
      return;
    }

    setIsBusy(true);
    try {
      const nextDoc = await openFileByPath(path);
      const status =
        ignoredFileCount > 0
          ? `File opened. Ignored ${ignoredFileCount} additional dropped file(s).`
          : "File opened.";
      applyOpenedDocument(nextDoc, status);
    } catch (error) {
      reportOpenError(error);
    } finally {
      setIsBusy(false);
    }
  }, [applyOpenedDocument, confirmOpenWhenDirty, reportOpenError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewContent(documentState.content);
    }, previewDebounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [documentState.content, previewDebounceMs]);

  useEffect(() => {
    if (isTauriRuntime) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!documentState.isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [documentState.isDirty, isTauriRuntime]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const command = resolveShortcutCommand(event);
      if (!command) {
        return;
      }

      event.preventDefault();
      if (command === "open") {
        if (!isBusy) {
          void onOpen();
        }
      } else if (command === "saveAs") {
        if (!isBusy) {
          void onSaveAs();
        }
      } else if (command === "save") {
        if (!isBusy) {
          void onSave();
        }
      } else if (command === "edit") {
        switchMode("edit", "Switched to edit mode.");
      } else if (command === "preview") {
        switchMode("preview", "Switched to preview mode.");
      } else if (command === "split") {
        switchMode("split", "Switched to split mode.");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isBusy, onOpen, onSave, onSaveAs, switchMode]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenEdit: null | (() => void) = null;
    let unlistenPreview: null | (() => void) = null;
    let unlistenSplit: null | (() => void) = null;

    async function setupTauriShortcutListeners() {
      const { listen } = await import("@tauri-apps/api/event");
      const offEdit = await listen(TAURI_SHORTCUT_EDIT_EVENT, () => {
        switchMode("edit", "Switched to edit mode.");
      });
      if (disposed) {
        offEdit();
        return;
      }
      unlistenEdit = offEdit;

      const offPreview = await listen(TAURI_SHORTCUT_PREVIEW_EVENT, () => {
        switchMode("preview", "Switched to preview mode.");
      });
      if (disposed) {
        offPreview();
        return;
      }
      unlistenPreview = offPreview;

      const offSplit = await listen(TAURI_SHORTCUT_SPLIT_EVENT, () => {
        switchMode("split", "Switched to split mode.");
      });
      if (disposed) {
        offSplit();
        return;
      }
      unlistenSplit = offSplit;
    }

    void setupTauriShortcutListeners();

    return () => {
      disposed = true;
      unlistenEdit?.();
      unlistenPreview?.();
      unlistenSplit?.();
    };
  }, [isTauriRuntime, switchMode]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenClose: null | (() => void) = null;

    async function setupCloseGuard() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      globalCloseGuardUnlisten?.();
      globalCloseGuardUnlisten = null;

      const offClose = await appWindow.onCloseRequested(async (event) => {
        const isProgrammaticClose = closeGuardActiveRef.current;
        const decision = resolveCloseRequest({
          isDirty: isDirtyRef.current,
          forceCloseOnce: isProgrammaticClose
        });
        closeGuardActiveRef.current = decision.nextForceCloseOnce;

        if (decision.shouldBlock) {
          event.preventDefault();
          setCloseConfirmVisible(true);
          return;
        }

        if (isProgrammaticClose) {
          return;
        }

        event.preventDefault();
        try {
          await closeWindow();
        } catch {
          setStatusMessage("Close failed.");
        }
      });

      if (disposed) {
        offClose();
        return;
      }
      globalCloseGuardUnlisten = offClose;
      unlistenClose = () => {
        if (globalCloseGuardUnlisten === offClose) {
          globalCloseGuardUnlisten = null;
        }
        offClose();
      };
    }

    void setupCloseGuard();

    return () => {
      disposed = true;
      unlistenClose?.();
      closeGuardActiveRef.current = false;
    };
  }, [isTauriRuntime]);

  useEffect(() => {
    if (!isTauriRuntime) {
      return;
    }

    let disposed = false;
    let unlistenDragDrop: null | (() => void) = null;

    function isInsideWorkspace(position: { x: number; y: number }): boolean {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return false;
      }
      const rect = workspace.getBoundingClientRect();
      return isDropPositionInsideWorkspace(rect, position);
    }

    async function setupTauriDropListeners() {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const currentWebview = getCurrentWebview();
      const offDragDrop = await currentWebview.onDragDropEvent((event) => {
        if (event.payload.type === "leave") {
          setIsDragActive(false);
          return;
        }

        const inWorkspace = isInsideWorkspace(event.payload.position);
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragActive(inWorkspace);
          return;
        }

        setIsDragActive(false);
        if (!inWorkspace) {
          return;
        }

        const droppedPaths = event.payload.paths;
        const selectedPath = droppedPaths.find((path) => isSupportedDropPath(path));
        if (!selectedPath) {
          setStatusMessage(DROP_UNSUPPORTED_FILE_MESSAGE);
          return;
        }

        const ignoredFileCount = droppedPaths.length - 1;
        void onOpenDroppedPath(selectedPath, ignoredFileCount);
      });

      if (disposed) {
        offDragDrop();
        return;
      }
      unlistenDragDrop = offDragDrop;
    }

    void setupTauriDropListeners();

    return () => {
      disposed = true;
      unlistenDragDrop?.();
    };
  }, [isTauriRuntime, onOpenDroppedPath]);

  async function onOpen() {
    const shouldContinue = await confirmOpenWhenDirty();
    if (!shouldContinue) {
      return;
    }

    setIsBusy(true);
    try {
      const nextDoc = await openFile();
      applyOpenedDocument(nextDoc);
    } catch (error) {
      reportOpenError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function onSave(): Promise<boolean> {
    setIsBusy(true);
    try {
      const savedPath = await saveFile(documentState);
      setDocumentState((prev) => ({
        ...prev,
        path: savedPath,
        isDirty: false,
        updatedAt: Date.now()
      }));
      setStatusMessage("Saved.");
      return true;
    } catch (error) {
      if (error instanceof FileOperationCancelledError) {
        setStatusMessage("Save cancelled.");
        return false;
      }
      if (error instanceof FileOperationError) {
        setStatusMessage(error.message);
        return false;
      }
      setStatusMessage("Save failed.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  async function onSaveAs(): Promise<boolean> {
    setIsBusy(true);
    try {
      const savedPath = await saveFileAs(documentState);
      setDocumentState((prev) => ({
        ...prev,
        path: savedPath,
        isDirty: false,
        updatedAt: Date.now()
      }));
      setStatusMessage("Saved as new file.");
      return true;
    } catch (error) {
      if (error instanceof FileOperationCancelledError) {
        setStatusMessage("Save As cancelled.");
        return false;
      }
      if (error instanceof FileOperationError) {
        setStatusMessage(error.message);
        return false;
      }
      setStatusMessage("Save As failed.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }

  function onContentChange(content: string) {
    latestContentRef.current = content;
    setDocumentState((prev) => ({
      ...prev,
      content,
      isDirty: true,
      updatedAt: Date.now()
    }));
  }

  async function closeWindow() {
    const { invoke } = await import("@tauri-apps/api/core");
    closeGuardActiveRef.current = true;
    try {
      await invoke("exit_app");
    } catch (error) {
      closeGuardActiveRef.current = false;
      throw error;
    }
  }

  async function onCloseConfirmSave() {
    setCloseConfirmVisible(false);
    const saved = await onSave();
    if (saved) {
      try {
        await closeWindow();
      } catch {
        setStatusMessage("Close failed.");
      }
    } else {
      setStatusMessage("Close cancelled because save did not complete.");
    }
  }

  async function onCloseConfirmDiscard() {
    setCloseConfirmVisible(false);
    try {
      await closeWindow();
    } catch {
      setStatusMessage("Close failed.");
    }
  }

  function onCloseConfirmCancel() {
    setCloseConfirmVisible(false);
  }

  function onCursorChange(nextCursor: { line: number; column: number }) {
    setCursor(nextCursor);
  }

  const workspaceClassName = [
    "workspace",
    mode === "split" ? "workspace-split" : "",
    isDragActive ? "is-drag-active" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div className="topbar-left">
          <img src={brandLogo} alt="BlinkMD logo" className="brand-logo" />
          <span>BlinkMD</span>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={onOpen} disabled={isBusy}>
            {isBusy ? "Working..." : "Open"}
          </button>
          <button type="button" onClick={() => void onSave()} disabled={isBusy}>
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              const next = mode === "edit" ? "split" : mode === "split" ? "preview" : "edit";
              switchMode(next);
            }}
            disabled={isBusy}
          >
            {mode === "edit" ? "Split" : mode === "split" ? "Preview" : "Edit"}
          </button>
        </div>
      </header>

      <main ref={workspaceRef} className={workspaceClassName} role="main">
        {mode === "edit" && (
          <EditorPane
            content={documentState.content}
            onContentChange={onContentChange}
            onCursorChange={onCursorChange}
          />
        )}
        {mode === "split" && (
          <>
            <EditorPane
              content={documentState.content}
              onContentChange={onContentChange}
              onCursorChange={onCursorChange}
            />
            <PreviewPane content={previewContent} />
          </>
        )}
        {mode === "preview" && (
          <PreviewPane content={previewContent} />
        )}
      </main>

      <footer className="statusbar" role="contentinfo">
        <span
          className={documentState.isDirty ? "status-dirty is-dirty" : "status-dirty is-clean"}
          aria-label={dirtyStatusText}
        >
          {dirtyStatusText}
        </span>
        <span>{getFileName(documentState.path)}</span>
        <span>Words {wordCount}</span>
        {isLargeDocument ? <span>Large File Mode</span> : null}
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span className="status-message" aria-live="polite">
          {statusMessage}
        </span>
      </footer>

      {closeConfirmVisible && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Unsaved changes">
          <div className="modal-box">
            <p className="modal-message">You have unsaved changes.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn modal-btn-primary" onClick={() => void onCloseConfirmSave()}>
                Save
              </button>
              <button type="button" className="modal-btn modal-btn-danger" onClick={() => void onCloseConfirmDiscard()}>
                Don&apos;t Save
              </button>
              <button type="button" className="modal-btn" onClick={onCloseConfirmCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

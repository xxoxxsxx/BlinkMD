import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ViewMode } from "../state/documentStore";

const PREVIEW_DEBOUNCE_MS = 120;
const LARGE_FILE_PREVIEW_DEBOUNCE_MS = 420;
const LARGE_FILE_THRESHOLD_BYTES = 1024 * 1024;

// 单例 TextEncoder，避免每次调用时重新分配
const textEncoder = new TextEncoder();

function getUtf8SizeInBytes(content: string): number {
  return textEncoder.encode(content).length;
}

type UsePreviewSyncInput = {
  content: string;
  mode: ViewMode;
  workspaceRef: RefObject<HTMLElement | null>;
};

type UsePreviewSyncResult = {
  previewContent: string;
  isLargeDocument: boolean;
  refreshPreview: (content?: string) => void;
};

export function usePreviewSync({
  content,
  mode,
  workspaceRef
}: UsePreviewSyncInput): UsePreviewSyncResult {
  const [previewContent, setPreviewContent] = useState("");
  // 用于跟踪是否刚刚通过 refreshPreview 设置了即时内容
  const immediateContentRef = useRef<string | null>(null);

  const contentSizeBytes = useMemo(() => getUtf8SizeInBytes(content), [content]);
  const isLargeDocument = contentSizeBytes > LARGE_FILE_THRESHOLD_BYTES;
  const previewDebounceMs = isLargeDocument ? LARGE_FILE_PREVIEW_DEBOUNCE_MS : PREVIEW_DEBOUNCE_MS;

  // 立即刷新预览内容（绕过 debounce），用于打开文件等场景
  // 如果不传参数，则使用当前 content
  const refreshPreview = useCallback((nextContent?: string) => {
    const effectiveContent = nextContent ?? content;
    immediateContentRef.current = effectiveContent;
    setPreviewContent(effectiveContent);
  }, [content]);

  useEffect(() => {
    // 如果刚刚通过 refreshPreview 设置了即时内容，跳过这次 debounce 更新
    if (immediateContentRef.current === content) {
      immediateContentRef.current = null;
      return;
    }

    const timer = window.setTimeout(() => {
      setPreviewContent(content);
    }, previewDebounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [content, previewDebounceMs]);

  useEffect(() => {
    if (mode !== "split" || !workspaceRef.current) {
      return;
    }

    const editor = workspaceRef.current.querySelector<HTMLElement>(".cm-scroller");
    const preview = workspaceRef.current.querySelector<HTMLElement>(".preview-pane");
    if (!editor || !preview) {
      return;
    }
    const editorElement = editor;
    const previewElement = preview;

    let syncSource: "editor" | "preview" | null = null;

    function onEditorScroll() {
      if (syncSource === "preview") {
        return;
      }
      syncSource = "editor";
      const maxScroll = editorElement.scrollHeight - editorElement.clientHeight;
      const ratio = maxScroll > 0 ? editorElement.scrollTop / maxScroll : 0;
      previewElement.scrollTop =
        ratio * (previewElement.scrollHeight - previewElement.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    function onPreviewScroll() {
      if (syncSource === "editor") {
        return;
      }
      syncSource = "preview";
      const maxScroll = previewElement.scrollHeight - previewElement.clientHeight;
      const ratio = maxScroll > 0 ? previewElement.scrollTop / maxScroll : 0;
      editorElement.scrollTop = ratio * (editorElement.scrollHeight - editorElement.clientHeight);
      requestAnimationFrame(() => {
        syncSource = null;
      });
    }

    editorElement.addEventListener("scroll", onEditorScroll);
    previewElement.addEventListener("scroll", onPreviewScroll);
    return () => {
      editorElement.removeEventListener("scroll", onEditorScroll);
      previewElement.removeEventListener("scroll", onPreviewScroll);
    };
  }, [mode, workspaceRef]);

  return {
    previewContent,
    isLargeDocument,
    refreshPreview
  };
}

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, type ViewUpdate } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { blinkEditorTheme } from "./editorTheme";

type EditorPaneProps = {
  content: string;
  onContentChange: (content: string) => void;
  onCursorChange: (cursor: { line: number; column: number }) => void;
};

function getCursorFromState(state: EditorState): { line: number; column: number } {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return {
    line: line.number,
    column: head - line.from + 1
  };
}

export function EditorPane({ content, onContentChange, onCursorChange }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onContentChangeRef = useRef(onContentChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const syncingExternalContentRef = useRef(false);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
    onCursorChangeRef.current = onCursorChange;
  }, [onContentChange, onCursorChange]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          markdown(),
          lineNumbers(),
          EditorView.lineWrapping,
          blinkEditorTheme,
          EditorView.updateListener.of((update: ViewUpdate) => {
            if (update.docChanged && !syncingExternalContentRef.current) {
              onContentChangeRef.current(update.state.doc.toString());
            }
            if (update.docChanged || update.selectionSet) {
              onCursorChangeRef.current(getCursorFromState(update.state));
            }
          })
        ]
      }),
      parent: containerRef.current
    });

    viewRef.current = view;
    onCursorChangeRef.current(getCursorFromState(view.state));

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentContent = view.state.doc.toString();
    if (currentContent === content) {
      return;
    }

    const nextHead = Math.min(view.state.selection.main.head, content.length);
    syncingExternalContentRef.current = true;
    view.dispatch({
      changes: { from: 0, to: currentContent.length, insert: content },
      selection: { anchor: nextHead }
    });
    syncingExternalContentRef.current = false;
    onCursorChangeRef.current(getCursorFromState(view.state));
  }, [content]);

  return <div ref={containerRef} className="editor-pane" aria-label="markdown-editor" />;
}

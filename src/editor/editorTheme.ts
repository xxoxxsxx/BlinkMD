import { EditorView } from "@codemirror/view";

export const blinkEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "#f7f9fc",
    color: "#1b2d3f"
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "\"SF Pro Text\", \"Segoe UI\", sans-serif",
    fontSize: "15px",
    lineHeight: "1.65"
  },
  ".cm-content": {
    padding: "20px",
    caretColor: "#12324a"
  },
  ".cm-gutters": {
    border: "none",
    backgroundColor: "#eff3f9",
    color: "#6a7d90"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 12px"
  },
  ".cm-activeLine": {
    backgroundColor: "#edf4ff"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e3eefc",
    color: "#2d4a67"
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#12324a"
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "#cfe3ff"
  }
});

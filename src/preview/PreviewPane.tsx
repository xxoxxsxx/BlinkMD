import { useMemo } from "react";
import { renderMarkdown } from "../services/renderService";

type PreviewPaneProps = {
  content: string;
};

export function PreviewPane({ content }: PreviewPaneProps) {
  const renderedHtml = useMemo(() => renderMarkdown(content), [content]);

  return (
    <section className="preview-pane" aria-label="markdown-preview">
      <div
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </section>
  );
}

import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
  async: false
});

const FORBIDDEN_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form"
]);
const URI_ATTRS = new Set(["href", "src", "xlink:href", "formaction", "action"]);

function hasUnsafeUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text/html") ||
    normalized.startsWith("data:application")
  );
}

function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const elements = template.content.querySelectorAll("*");

  elements.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (FORBIDDEN_TAGS.has(tag)) {
      element.remove();
      return;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;

      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "style") {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (URI_ATTRS.has(name) && hasUnsafeUrl(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  return template.innerHTML;
}

export function renderMarkdown(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return "<p>Preview will appear here.</p>";
  }
  const rawHtml = marked.parse(trimmed) as string;
  return sanitizeHtml(rawHtml);
}

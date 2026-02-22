import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./renderService";

describe("renderMarkdown", () => {
  // --- 基本渲染 ---

  it("returns placeholder HTML for empty content", () => {
    expect(renderMarkdown("")).toBe("<p>Preview will appear here.</p>");
    expect(renderMarkdown("   ")).toBe("<p>Preview will appear here.</p>");
  });

  it("renders GFM table correctly", () => {
    const md = `| Name | Age |
| --- | --- |
| Alice | 30 |`;
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<td>Alice</td>");
  });

  it("renders task list checkboxes", () => {
    const md = `- [x] Done
- [ ] Todo`;
    const html = renderMarkdown(md);
    expect(html).toContain('type="checkbox"');
    // checked item
    expect(html).toMatch(/checked/);
  });

  it("renders fenced code block", () => {
    const md = "```js\nconsole.log('hi');\n```";
    const html = renderMarkdown(md);
    expect(html).toContain("<pre>");
    expect(html).toContain("<code");
  });

  it("renders inline code", () => {
    const md = "Use `foo()` here.";
    const html = renderMarkdown(md);
    expect(html).toContain("<code>foo()</code>");
  });

  // --- XSS 净化 ---

  it("removes <script> tags", () => {
    const md = '<script>alert("xss")</script>Hello';
    const html = renderMarkdown(md);
    expect(html).not.toContain("<script");
    expect(html).toContain("Hello");
  });

  it("strips onclick event handlers", () => {
    const md = '<div onclick="alert(1)">Click</div>';
    const html = renderMarkdown(md);
    expect(html).not.toContain("onclick");
    expect(html).toContain("Click");
  });

  it("removes javascript: URLs", () => {
    const md = '<a href="javascript:alert(1)">link</a>';
    const html = renderMarkdown(md);
    expect(html).not.toContain("javascript:");
  });

  it("removes <iframe>, <object>, <embed> tags", () => {
    const md = '<iframe src="x"></iframe><object data="y"></object><embed src="z">';
    const html = renderMarkdown(md);
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<object");
    expect(html).not.toContain("<embed");
  });

  it("strips style attributes", () => {
    const md = '<div style="color:red">Styled</div>';
    const html = renderMarkdown(md);
    expect(html).not.toContain("style=");
    expect(html).toContain("Styled");
  });
});

import { describe, expect, it } from "vitest";
import { resolveShortcutCommand } from "./shortcutKeymap";

describe("resolveShortcutCommand", () => {
  it("maps cmd/ctrl+\\ to split", () => {
    const command = resolveShortcutCommand({
      key: "\\",
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      shiftKey: false
    });

    expect(command).toBe("split");
  });

  it("maps cmd/ctrl+e and cmd/ctrl+r to edit/preview", () => {
    const edit = resolveShortcutCommand({
      key: "e",
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: false
    });
    const preview = resolveShortcutCommand({
      key: "r",
      metaKey: false,
      ctrlKey: true,
      altKey: false,
      shiftKey: false
    });

    expect(edit).toBe("edit");
    expect(preview).toBe("preview");
  });

  it("returns null without primary modifier", () => {
    const command = resolveShortcutCommand({
      key: "\\",
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false
    });

    expect(command).toBeNull();
  });
});

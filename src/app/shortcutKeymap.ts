export type ShortcutCommand = "open" | "save" | "saveAs" | "edit" | "preview" | "split";

type ShortcutKeyEvent = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export function resolveShortcutCommand(event: ShortcutKeyEvent): ShortcutCommand | null {
  const hasPrimaryModifier = event.metaKey || event.ctrlKey;
  if (!hasPrimaryModifier || event.altKey) {
    return null;
  }

  const pressedKey = event.key.toLowerCase();
  if (pressedKey === "o") {
    return "open";
  }
  if (pressedKey === "s" && event.shiftKey) {
    return "saveAs";
  }
  if (pressedKey === "s") {
    return "save";
  }
  if (pressedKey === "e") {
    return "edit";
  }
  if (pressedKey === "r") {
    return "preview";
  }
  if (event.key === "\\") {
    return "split";
  }

  return null;
}

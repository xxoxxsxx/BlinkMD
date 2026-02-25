import { describe, it, expect } from "vitest";
import {
  FileOperationCancelledError,
  FileOperationError,
  getDisplayName,
  openFileByPath,
  toFileOperationError
} from "./fileService";

// --- FileOperationCancelledError ---

describe("FileOperationCancelledError", () => {
  it("has correct name and message for open", () => {
    const err = new FileOperationCancelledError("open");
    expect(err.name).toBe("FileOperationCancelledError");
    expect(err.message).toBe("File open was cancelled.");
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct message for save", () => {
    const err = new FileOperationCancelledError("save");
    expect(err.message).toBe("File save was cancelled.");
  });
});

// --- FileOperationError ---

describe("FileOperationError", () => {
  it("has correct name, message, and code", () => {
    const err = new FileOperationError("open", "not found", "FILE_NOT_FOUND");
    expect(err.name).toBe("FileOperationError");
    expect(err.message).toBe("File open failed: not found");
    expect(err.code).toBe("FILE_NOT_FOUND");
  });

  it("defaults code to null", () => {
    const err = new FileOperationError("save", "oops");
    expect(err.code).toBeNull();
  });
});

// --- toFileOperationError ---

describe("toFileOperationError", () => {
  it("passes through FileOperationError as-is", () => {
    const original = new FileOperationError("open", "test", "CODE");
    const result = toFileOperationError("save", original);
    expect(result).toBe(original);
  });

  it("converts plain Error", () => {
    const err = new Error("boom");
    const result = toFileOperationError("open", err);
    expect(result).toBeInstanceOf(FileOperationError);
    expect(result.message).toBe("File open failed: boom");
    expect(result.code).toBeNull();
  });

  it("converts object with message and code", () => {
    const payload = { message: "disk full", code: "DISK_FULL" };
    const result = toFileOperationError("save", payload);
    expect(result).toBeInstanceOf(FileOperationError);
    expect(result.message).toBe("File save failed: disk full");
    expect(result.code).toBe("DISK_FULL");
  });

  it("converts object with message only (no code)", () => {
    const payload = { message: "generic error" };
    const result = toFileOperationError("open", payload);
    expect(result.code).toBeNull();
  });

  it("handles unknown error types", () => {
    const result = toFileOperationError("save", 42);
    expect(result).toBeInstanceOf(FileOperationError);
    expect(result.message).toContain("Unknown file operation error");
    expect(result.code).toBeNull();
  });

  it("handles null error", () => {
    const result = toFileOperationError("open", null);
    expect(result).toBeInstanceOf(FileOperationError);
    expect(result.message).toContain("Unknown file operation error");
  });
});

// --- getDisplayName ---

describe("getDisplayName", () => {
  it("extracts filename from Unix path", () => {
    expect(getDisplayName("/home/user/docs/readme.md")).toBe("readme.md");
  });

  it("extracts filename from Windows path", () => {
    expect(getDisplayName("C:\\Users\\docs\\file.md")).toBe("file.md");
  });

  it("returns Untitled.md for null", () => {
    expect(getDisplayName(null)).toBe("Untitled.md");
  });

  it("returns Untitled.md for empty string", () => {
    expect(getDisplayName("")).toBe("Untitled.md");
  });

  it("handles filename without directory", () => {
    expect(getDisplayName("notes.md")).toBe("notes.md");
  });
});

describe("openFileByPath", () => {
  it("throws when called outside tauri runtime", async () => {
    await expect(openFileByPath("/tmp/sample.md")).rejects.toMatchObject({
      name: "FileOperationError",
      message: "File open failed: Opening by path is only available in Tauri runtime."
    });
  });
});

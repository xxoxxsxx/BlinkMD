import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { openFile } from "../services/fileService";

vi.mock("../services/fileService", async () => {
  const actual = await vi.importActual<typeof import("../services/fileService")>(
    "../services/fileService"
  );
  return {
    ...actual,
    openFile: vi.fn()
  };
});

describe("App", () => {
  const mockedOpenFile = vi.mocked(openFile);

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedOpenFile.mockReset();
  });

  it("defaults to edit mode on initial render", () => {
    render(<App />);

    expect(screen.getByLabelText("markdown-editor")).toBeTruthy();
    expect(screen.queryByLabelText("markdown-preview")).toBeNull();
  });

  it("switches to preview mode after opening a file", async () => {
    mockedOpenFile.mockResolvedValue({
      path: "/tmp/sample.md",
      content: "# Title",
      isDirty: false,
      updatedAt: Date.now()
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await waitFor(() => {
      expect(mockedOpenFile).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("markdown-preview")).toBeTruthy();
      expect(screen.queryByLabelText("markdown-editor")).toBeNull();
    });
  });
});

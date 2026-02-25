import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { openFile, openFileByPath } from "../services/fileService";

type DragDropPayload =
  | { type: "enter"; paths: string[]; position: { x: number; y: number } }
  | { type: "over"; position: { x: number; y: number } }
  | { type: "drop"; paths: string[]; position: { x: number; y: number } }
  | { type: "leave" };

type DragDropHandler = (event: { payload: DragDropPayload }) => void;

const hoisted = vi.hoisted(() => ({
  dragDropHandlers: [] as DragDropHandler[],
  askMock: vi.fn()
}));

vi.mock("../services/fileService", async () => {
  const actual = await vi.importActual<typeof import("../services/fileService")>(
    "../services/fileService"
  );
  return {
    ...actual,
    openFile: vi.fn(),
    openFileByPath: vi.fn()
  };
});

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (handler: DragDropHandler) => {
      hoisted.dragDropHandlers.push(handler);
      return () => {
        const index = hoisted.dragDropHandlers.indexOf(handler);
        if (index >= 0) {
          hoisted.dragDropHandlers.splice(index, 1);
        }
      };
    }
  })
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: hoisted.askMock
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: async () => () => {}
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async () => () => {}
  })
}));

function enableTauriRuntime() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true
  });
}

function disableTauriRuntime() {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function emitDragDrop(payload: DragDropPayload) {
  for (const handler of [...hoisted.dragDropHandlers]) {
    handler({ payload });
  }
}

function mockWorkspaceRect() {
  const workspace = screen.getByRole("main");
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 480,
    bottom: 360,
    width: 480,
    height: 360,
    toJSON: () => ({})
  } as DOMRect);
}

describe("App", () => {
  const mockedOpenFile = vi.mocked(openFile);
  const mockedOpenFileByPath = vi.mocked(openFileByPath);

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    disableTauriRuntime();
  });

  beforeEach(() => {
    mockedOpenFile.mockReset();
    mockedOpenFileByPath.mockReset();
    hoisted.askMock.mockReset();
    hoisted.dragDropHandlers.length = 0;
    disableTauriRuntime();
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

  it("opens the first supported dropped markdown file in tauri runtime", async () => {
    enableTauriRuntime();
    mockedOpenFileByPath.mockResolvedValue({
      path: "/tmp/second.md",
      content: "# Dropped",
      isDirty: false,
      updatedAt: Date.now()
    });
    render(<App />);

    await waitFor(() => {
      expect(hoisted.dragDropHandlers.length).toBe(1);
    });
    mockWorkspaceRect();

    emitDragDrop({
      type: "drop",
      paths: ["/tmp/image.png", "/tmp/second.md"],
      position: { x: 120, y: 80 }
    });

    await waitFor(() => {
      expect(mockedOpenFileByPath).toHaveBeenCalledWith("/tmp/second.md");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("markdown-preview")).toBeTruthy();
    });
    expect(screen.getByText("File opened. Ignored 1 additional dropped file(s).")).toBeTruthy();
  });

  it("shows drop highlight on enter and clears it on leave", async () => {
    enableTauriRuntime();
    render(<App />);

    await waitFor(() => {
      expect(hoisted.dragDropHandlers.length).toBe(1);
    });
    mockWorkspaceRect();

    emitDragDrop({
      type: "enter",
      paths: ["/tmp/note.md"],
      position: { x: 100, y: 100 }
    });

    await waitFor(() => {
      expect(screen.getByRole("main").className).toContain("is-drag-active");
    });

    emitDragDrop({ type: "leave" });

    await waitFor(() => {
      expect(screen.getByRole("main").className).not.toContain("is-drag-active");
    });
  });

  it("ignores unsupported dropped files", async () => {
    enableTauriRuntime();
    render(<App />);

    await waitFor(() => {
      expect(hoisted.dragDropHandlers.length).toBe(1);
    });
    mockWorkspaceRect();

    emitDragDrop({
      type: "drop",
      paths: ["/tmp/image.png"],
      position: { x: 120, y: 80 }
    });

    await waitFor(() => {
      expect(screen.getByText("Drop ignored: only .md/.markdown/.txt are supported.")).toBeTruthy();
    });
    expect(mockedOpenFileByPath).not.toHaveBeenCalled();
  });
});

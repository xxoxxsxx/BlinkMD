import { describe, it, expect } from "vitest";
import { getInitialDocumentState } from "./documentStore";

describe("getInitialDocumentState", () => {
  it("returns correct default values", () => {
    const state = getInitialDocumentState();
    expect(state.path).toBeNull();
    expect(state.content).toBe("");
    expect(state.isDirty).toBe(false);
  });

  it("has path defaulting to null", () => {
    expect(getInitialDocumentState().path).toBeNull();
  });

  it("has isDirty defaulting to false", () => {
    expect(getInitialDocumentState().isDirty).toBe(false);
  });

  it("has content defaulting to empty string", () => {
    expect(getInitialDocumentState().content).toBe("");
  });

  it("has updatedAt as a reasonable timestamp", () => {
    const before = Date.now();
    const state = getInitialDocumentState();
    const after = Date.now();
    expect(state.updatedAt).toBeGreaterThanOrEqual(before);
    expect(state.updatedAt).toBeLessThanOrEqual(after);
  });
});

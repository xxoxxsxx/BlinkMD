import { describe, expect, it } from "vitest";
import { resolveCloseRequest } from "./closeGuard";

describe("resolveCloseRequest", () => {
  it("blocks close when document is dirty and no force-close flag", () => {
    const result = resolveCloseRequest({ isDirty: true, forceCloseOnce: false });

    expect(result).toEqual({ shouldBlock: true, nextForceCloseOnce: false });
  });

  it("allows close when document is clean", () => {
    const result = resolveCloseRequest({ isDirty: false, forceCloseOnce: false });

    expect(result).toEqual({ shouldBlock: false, nextForceCloseOnce: false });
  });

  it("allows one forced close and consumes the force-close flag", () => {
    const result = resolveCloseRequest({ isDirty: true, forceCloseOnce: true });

    expect(result).toEqual({ shouldBlock: false, nextForceCloseOnce: false });
  });
});

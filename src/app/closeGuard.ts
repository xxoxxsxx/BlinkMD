export type CloseRequestInput = {
  isDirty: boolean;
  forceCloseOnce: boolean;
};

export type CloseRequestDecision = {
  shouldBlock: boolean;
  nextForceCloseOnce: boolean;
};

export function resolveCloseRequest(input: CloseRequestInput): CloseRequestDecision {
  if (input.forceCloseOnce) {
    return {
      shouldBlock: false,
      nextForceCloseOnce: false
    };
  }

  if (input.isDirty) {
    return {
      shouldBlock: true,
      nextForceCloseOnce: false
    };
  }

  return {
    shouldBlock: false,
    nextForceCloseOnce: false
  };
}

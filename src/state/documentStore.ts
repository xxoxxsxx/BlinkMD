export type ViewMode = "edit" | "preview" | "split";

export type DocumentModel = {
  path: string | null;
  content: string;
  isDirty: boolean;
  updatedAt: number;
};

export function getInitialDocumentState(): DocumentModel {
  return {
    path: null,
    content: "",
    isDirty: false,
    updatedAt: Date.now()
  };
}

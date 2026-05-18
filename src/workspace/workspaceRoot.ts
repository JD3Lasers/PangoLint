export interface WorkspaceFolderLike {
  uri: {
    scheme: string;
    fsPath: string;
  };
}

export function firstFileWorkspaceFolderPath(workspaceFolders: readonly WorkspaceFolderLike[] | undefined): string {
  return workspaceFolders?.find((folder) => folder.uri.scheme === "file")?.uri.fsPath ?? "";
}

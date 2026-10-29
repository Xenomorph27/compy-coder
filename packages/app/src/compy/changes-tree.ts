export type FileChange = {
  file: string
  additions: number
  deletions: number
  status: "added" | "deleted" | "modified"
}

export type ChangeNode =
  | { type: "file"; name: string; path: string; change: FileChange }
  | { type: "folder"; name: string; path: string; additions: number; deletions: number; children: ChangeNode[] }

/**
 * Folds changed file paths into a folder tree. Each folder carries the line totals of everything below it, a chain of
 * folders with a single subfolder collapses into one row ("src/compy"), and folders sort before files.
 */
export function changeTree(changes: readonly FileChange[]): ChangeNode[] {
  const root: ChangeNode[] = []

  for (const change of changes) {
    const parts = change.file.split(/[\\/]/).filter(Boolean)
    const folders = parts.slice(0, -1)

    const level = folders.reduce((children, name, index) => {
      const path = folders.slice(0, index + 1).join("/")
      const found = children.find((node) => node.type === "folder" && node.name === name)
      const folder =
        found?.type === "folder"
          ? found
          : { type: "folder" as const, name, path, additions: 0, deletions: 0, children: [] as ChangeNode[] }

      if (!found) children.push(folder)
      folder.additions += change.additions
      folder.deletions += change.deletions

      return folder.children
    }, root)

    level.push({ type: "file", name: parts.at(-1) ?? change.file, path: parts.join("/"), change })
  }

  return arrange(root)
}

function arrange(nodes: ChangeNode[]): ChangeNode[] {
  return nodes
    .map((node) => (node.type === "folder" ? compact({ ...node, children: arrange(node.children) }) : node))
    .toSorted((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1))
}

function compact(folder: Extract<ChangeNode, { type: "folder" }>): ChangeNode {
  const only = folder.children.length === 1 ? folder.children[0] : undefined

  if (only?.type !== "folder") return folder

  return { ...only, name: `${folder.name}/${only.name}` }
}

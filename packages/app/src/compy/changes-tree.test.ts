import { describe, expect, test } from "bun:test"
import { changeTree, type FileChange } from "./changes-tree"

const change = (file: string, additions: number, deletions: number): FileChange => ({
  file,
  additions,
  deletions,
  status: "modified",
})

describe("changeTree", () => {
  test("a folder shows the line totals of every file below it", () => {
    const [src] = changeTree([change("src/a.py", 50, 0), change("src/lib/b.py", 3, 20), change("src/lib/c.py", 1, 1)])

    expect(src).toMatchObject({ type: "folder", name: "src", additions: 54, deletions: 21 })
  })

  test("single-child folder chains collapse into one row", () => {
    const [node] = changeTree([change("packages/app/src/main.ts", 2, 0)])

    expect(node).toMatchObject({ type: "folder", name: "packages/app/src", additions: 2 })
    expect(node.type === "folder" && node.children[0]).toMatchObject({ type: "file", name: "main.ts" })
  })

  test("folders come before files, each sorted by name", () => {
    const names = changeTree([change("z.ts", 1, 0), change("b/x.ts", 1, 0), change("a.ts", 1, 0), change("a/y.ts", 1, 0)]).map(
      (node) => node.name,
    )

    expect(names).toEqual(["a", "b", "a.ts", "z.ts"])
  })

  test("Windows separators group like forward slashes", () => {
    const [node] = changeTree([change("src\\one.py", 1, 0), change("src/two.py", 0, 4)])

    expect(node).toMatchObject({ type: "folder", name: "src", additions: 1, deletions: 4 })
  })
})

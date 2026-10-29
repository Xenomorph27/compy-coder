import { describe, expect, test } from "bun:test"
import { builderDone, collabPrompt, DONE_MARKER, reviewVerdict } from "./collab-prompts"

describe("reviewVerdict", () => {
  test("reads the last verdict line", () => {
    expect(reviewVerdict("Looks fine.\nVERDICT: APPROVE")).toBe("approve")
    expect(reviewVerdict("Earlier I said VERDICT: APPROVE\nbut on reflection\n**Verdict: changes**")).toBe("changes")
  })

  test("a review without a clear approval asks for changes, so the run never finishes on silence", () => {
    expect(reviewVerdict("Seems ok I guess")).toBe("changes")
    expect(reviewVerdict("VERDICT: APPROVE or CHANGES")).toBe("changes")
  })
})

describe("builderDone", () => {
  test("only a line of its own marks the task complete, even with markdown around it", () => {
    expect(builderDone(`All checkpoints built.\n**${DONE_MARKER}**`)).toBe(true)
    expect(builderDone(`I will write ${DONE_MARKER} when finished.`)).toBe(false)
  })
})

describe("collabPrompt.review", () => {
  test("hands the validator the builder's report and every changed file with its line counts", () => {
    const prompt = collabPrompt.review({
      task: "Add login",
      checkpoint: 2,
      summary: "BUILDER-REPORT",
      files: [{ file: "app/login.py", additions: 50, deletions: 20, status: "modified" }],
    })

    expect(prompt).toContain("BUILDER-REPORT")
    expect(prompt).toContain("app/login.py (+50 -20, modified)")
    expect(prompt).toContain("Do not change any files.")
  })
})

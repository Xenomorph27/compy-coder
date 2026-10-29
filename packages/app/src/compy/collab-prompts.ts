import type { FileChange } from "./changes-tree"

/** The builder ends its reply with this line once the whole task is built. */
export const DONE_MARKER = "COLLAB-DONE"

/*
 * What Collab sends the builder and the validator. Like the debate prompts these are model instructions, so they stay in
 * English whatever the interface language is. The builder works in checkpoints and stops at each one; the validator
 * reviews the project as it stands, read-only, and its verdict decides whether the run can finish.
 */
export const collabPrompt = {
  start(task: string) {
    return [
      task,
      "",
      "You are the builder in a pair. A second agent, the validator, reviews your work at every checkpoint.",
      "Split the task into small checkpoints. Build only the next checkpoint now, then stop and reply with:",
      "1. What you built and why, briefly.",
      "2. How to check it.",
      "3. What the next checkpoint will be.",
      `If the whole task is complete, end your reply with a line containing only ${DONE_MARKER}.`,
    ].join("\n")
  },

  review(input: { task: string; checkpoint: number; summary: string; files: readonly FileChange[] }) {
    return [
      `You are the validator in a pair. The builder has reached checkpoint ${input.checkpoint} of this task:`,
      "",
      "<task>",
      input.task,
      "</task>",
      "",
      "Its report:",
      "",
      "<builder-report>",
      input.summary,
      "</builder-report>",
      "",
      "Files changed so far:",
      ...(input.files.length > 0
        ? input.files.map((file) => `- ${file.file} (+${file.additions} -${file.deletions}, ${file.status})`)
        : ["- none"]),
      "",
      "Read the changed files and check the work against the task. Do not change any files. Reply with the problems",
      "that must be fixed (most important first), then any smaller suggestions. End with a line that reads exactly",
      "VERDICT: APPROVE if this checkpoint is sound, or VERDICT: CHANGES if something must be fixed first.",
    ].join("\n")
  },

  feedback(input: { checkpoint: number; review: string; approved: boolean }) {
    return [
      `The validator reviewed checkpoint ${input.checkpoint}:`,
      "",
      "<validator-review>",
      input.review,
      "</validator-review>",
      "",
      input.approved
        ? "It approved the checkpoint. Apply any suggestions you agree with, then build the next checkpoint and stop again."
        : "It asked for changes. Fix every problem it raised first, then continue with the next checkpoint and stop again.",
      `Reply in the same format as before, and end with ${DONE_MARKER} once the whole task is complete.`,
    ].join("\n")
  },
}

/** The validator's verdict, from the last `VERDICT:` line of its review; anything unclear counts as changes requested. */
export function reviewVerdict(review: string) {
  const line = review
    .split("\n")
    .findLast((item) => /verdict\s*:/i.test(item))
    ?.toUpperCase()

  return line?.includes("APPROVE") && !line.includes("CHANGES") ? ("approve" as const) : ("changes" as const)
}

/** Whether the builder says the whole task is complete. */
export function builderDone(reply: string) {
  return reply.split("\n").some((line) => line.trim().replace(/[*`_]/g, "") === DONE_MARKER)
}

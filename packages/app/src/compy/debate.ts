import type { CompyStep } from "./state"

/*
 * What Compy sends each agent at every debate step. These are model instructions, not interface copy, so they stay
 * in English whatever the interface language is. Agents propose independently first, so neither anchors on the other,
 * then each sees the other's plan only through these prompts.
 */
export function debatePrompt(step: CompyStep, input: { topic: string; other: string }) {
  if (step === "propose")
    return [
      input.topic,
      "",
      "You are one of two agents working on this in parallel. Another agent is planning it independently, and you will",
      "compare plans afterwards. Propose your plan now: the approach, the concrete steps, and the risks or open",
      "questions. Read the project as much as you need, but do not change any files yet.",
    ].join("\n")

  if (step === "critique")
    return [
      "Here is the other agent's plan for the same task:",
      "",
      "<other-plan>",
      input.other,
      "</other-plan>",
      "",
      "Critique it honestly: what it does better than your plan, and what is wrong, risky or missing. Then write your",
      "revised plan, adopting the stronger ideas from both. Do not change any files yet.",
    ].join("\n")

  return [
    "Here is the other agent's revised plan:",
    "",
    "<other-plan>",
    input.other,
    "</other-plan>",
    "",
    "Converge: write the single final plan you both should follow, as numbered steps. Then list any point where you",
    "still disagree with the other agent, and why. Do not change any files yet.",
  ].join("\n")
}

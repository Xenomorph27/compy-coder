import type { CompyStep } from "./state"

const NO_FILES = "Do not change any files yet."

// Wraps the other agent's latest reply, so each agent can tell its own words from the other's.
const quote = (label: string, text: string) => [`Here is the other agent's ${label}:`, "", "<other-agent>", text, "</other-agent>", ""]

/*
 * What Compy sends each agent at every debate step. These are model instructions, not interface copy, so they stay
 * in English whatever the interface language is. Agents propose independently first, so neither anchors on the other,
 * then each sees the other's latest reply only through these prompts.
 */
export function debatePrompt(step: CompyStep, input: { topic: string; other: string }) {
  if (step === "propose")
    return [
      input.topic,
      "",
      "You are one of two agents working on this in parallel. Another agent is planning it independently, and you will",
      "compare plans afterwards. Propose your plan now: the approach, the concrete steps, and the risks or open",
      `questions. Read the project as much as you need. ${NO_FILES}`,
    ].join("\n")

  if (step === "discuss")
    return [
      ...quote("plan for the same task", input.other),
      "Discuss the two plans. Where do they agree, and where do they differ in approach? For each difference, say which",
      "way you lean and why, and ask the other agent anything its plan leaves unclear. Do not rewrite your plan yet.",
      NO_FILES,
    ].join("\n")

  if (step === "critique")
    return [
      ...quote("side of the discussion", input.other),
      "Now critique the other agent's plan honestly and specifically: what is wrong, risky, over-built or missing, and",
      "what it does better than yours. Answer any question it asked you. Do not rewrite your plan yet.",
      NO_FILES,
    ].join("\n")

  if (step === "revamp")
    return [
      ...quote("critique of your plan", input.other),
      "Revamp your plan. Address every point of that critique: fix what it got right, and say plainly where you disagree",
      `and why. Adopt the stronger ideas from the other agent's plan. Write the full revised plan. ${NO_FILES}`,
    ].join("\n")

  return [
    ...quote("revamped plan", input.other),
    "Converge: write the single final plan you both should follow, as numbered steps. Then list any point where you",
    `still disagree with the other agent, and why. ${NO_FILES}`,
  ].join("\n")
}

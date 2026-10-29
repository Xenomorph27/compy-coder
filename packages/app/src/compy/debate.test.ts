import { describe, expect, test } from "bun:test"
import { debatePrompt } from "./debate"
import { COMPY_STEPS } from "./state"

const input = { topic: "Add dark mode", other: "OTHER-AGENT-REPLY" }

describe("debatePrompt", () => {
  test("the first step is independent: it carries the topic and never the other agent's reply", () => {
    const prompt = debatePrompt("propose", input)

    expect(prompt).toContain("Add dark mode")
    expect(prompt).not.toContain("OTHER-AGENT-REPLY")
  })

  test("every later step hands each agent the other's latest reply", () => {
    for (const step of COMPY_STEPS.slice(1)) expect(debatePrompt(step, input)).toContain("OTHER-AGENT-REPLY")
  })

  test("no step lets an agent change files while they are still planning", () => {
    for (const step of COMPY_STEPS) expect(debatePrompt(step, input)).toContain("Do not change any files yet.")
  })

  test("each step asks for something different", () => {
    expect(new Set(COMPY_STEPS.map((step) => debatePrompt(step, input))).size).toBe(COMPY_STEPS.length)
  })
})

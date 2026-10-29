import type { SessionMessageInfo } from "@opencode/client/promise"
import { describe, expect, test } from "bun:test"
import { contextUsage, latestFailure, latestReply, promptReplies } from "./usage"

const model = { id: "m", providerID: "p" }

const user = (id: string, text = "do it"): SessionMessageInfo => ({ id, type: "user", text, time: { created: 0 } })

const step = (id: string, input: number, cached: number, output: number, text = ""): SessionMessageInfo => ({
  id,
  type: "assistant",
  agent: "plan",
  model,
  content: text ? [{ type: "text", text }] : [],
  tokens: { input, output, reasoning: 0, cache: { read: cached, write: 0 } },
  time: { created: 0, completed: 1 },
})

const idle = (id: string, outcome: "succeeded" | "failed", message?: string): SessionMessageInfo => ({
  id,
  type: "idle",
  outcome,
  error: message ? { type: "provider", message } : undefined,
  time: { created: 0 },
})

const compaction = (id: string): SessionMessageInfo => ({
  id,
  type: "compaction",
  status: "completed",
  reason: "auto",
  summary: "summary",
  time: { created: 0 },
})

describe("contextUsage", () => {
  test.each([
    { name: "no steps yet", messages: [user("u1")], expected: undefined },
    {
      name: "one step: everything read is the base",
      messages: [user("u1"), step("a1", 1_000, 9_000, 500)],
      expected: { used: 10_500, base: 10_000, conversation: 0, reply: 500, free: 89_500 },
    },
    {
      name: "later steps grow the conversation over the first step's base",
      messages: [user("u1"), step("a1", 1_000, 9_000, 500), user("u2"), step("a2", 2_000, 13_000, 800)],
      expected: { used: 15_800, base: 10_000, conversation: 5_000, reply: 800, free: 84_200 },
    },
    {
      name: "a compaction starts a new base",
      messages: [step("a1", 1_000, 50_000, 500), compaction("c1"), step("a2", 4_000, 0, 300)],
      expected: { used: 4_300, base: 4_000, conversation: 0, reply: 300, free: 95_700 },
    },
  ])("$name", ({ messages, expected }) => {
    const usage = contextUsage(messages, 100_000)

    if (!expected) return expect(usage).toBeUndefined()
    expect(usage?.used).toBe(expected.used)
    expect(Object.fromEntries(usage!.segments.map((segment) => [segment.key, segment.tokens]))).toEqual({
      base: expected.base,
      conversation: expected.conversation,
      reply: expected.reply,
      free: expected.free,
    })
  })
})

// The workspace advances a debate step only on these: both agents replied, and neither turn failed.
describe("latest turn", () => {
  test.each([
    { name: "reply after the last prompt", messages: [user("u1"), step("a1", 1, 0, 1, "plan A")], reply: "plan A" },
    {
      name: "an earlier round's reply is not this round's",
      messages: [user("u1"), step("a1", 1, 0, 1, "plan A"), user("u2")],
      reply: "",
    },
    {
      name: "a failed turn reports its error",
      messages: [user("u1"), idle("i1", "failed", "Free usage limit reached")],
      reply: "",
      failure: "Free usage limit reached",
    },
    {
      name: "a failure before the latest prompt no longer counts",
      messages: [user("u1"), idle("i1", "failed", "boom"), user("u2"), step("a2", 1, 0, 1, "plan B"), idle("i2", "succeeded")],
      reply: "plan B",
    },
  ])("$name", ({ messages, reply, failure }) => {
    expect(latestReply(messages)).toBe(reply)
    expect(latestFailure(messages)).toBe(failure)
  })
})

describe("promptReplies", () => {
  test("pairs each prompt with the text of every step that answered it", () => {
    const messages = [
      user("u1"),
      step("a1", 1, 0, 1, "reading files"),
      step("a2", 1, 0, 1, "checkpoint 1 built"),
      idle("i1", "succeeded"),
      user("u2"),
      step("a3", 1, 0, 1),
      user("u3"),
    ]

    expect(promptReplies(messages)).toEqual(["reading files\n\ncheckpoint 1 built", "", ""])
  })
})

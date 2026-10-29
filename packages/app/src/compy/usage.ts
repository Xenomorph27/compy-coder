import type { SessionMessageAssistant, SessionMessageInfo, TokenUsageInfo } from "@opencode/client/promise"

export type ContextSegmentKey = "base" | "conversation" | "reply" | "free"

export type ContextUsage = {
  used: number
  limit: number
  segments: { key: ContextSegmentKey; tokens: number }[]
}

const prompt = (tokens: TokenUsageInfo) => tokens.input + tokens.cache.read + tokens.cache.write

export const totalTokens = (tokens: TokenUsageInfo) =>
  tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write

/**
 * How full an agent's context window is after its latest step. The newest step's prompt (input plus cached tokens) is
 * everything the model just read, and its reply joins the context on the next step. The first step's prompt since the
 * last compaction is the fixed base: system prompt, tool definitions and the opening message. Everything between is
 * conversation that grew since.
 */
export function contextUsage(messages: readonly SessionMessageInfo[], limit: number): ContextUsage | undefined {
  if (limit <= 0) return
  const compacted = messages.findLastIndex((message) => message.type === "compaction" && message.status === "completed")

  const steps = messages
    .slice(compacted + 1)
    .filter(
      (message): message is SessionMessageAssistant & { tokens: TokenUsageInfo } =>
        message.type === "assistant" && !!message.tokens && prompt(message.tokens) > 0,
    )

  const first = steps[0]
  const last = steps.at(-1)
  if (!first || !last) return
  const current = prompt(last.tokens)
  const base = Math.min(prompt(first.tokens), current)
  const used = current + last.tokens.output

  return {
    used,
    limit,
    segments: [
      { key: "base", tokens: base },
      { key: "conversation", tokens: current - base },
      { key: "reply", tokens: last.tokens.output },
      { key: "free", tokens: Math.max(0, limit - used) },
    ],
  }
}

/** Why the agent's latest turn failed: its error message, "" when it gave none, undefined when it did not fail. */
export function latestFailure(messages: readonly SessionMessageInfo[]) {
  const start = messages.findLastIndex((message) => message.type === "user")
  const idle = messages.slice(start + 1).findLast((message) => message.type === "idle")

  if (idle?.type !== "idle" || idle.outcome !== "failed") return

  return idle.error?.message ?? ""
}

/** The text of the latest prompt the agent was sent, so a failed turn can be sent again unchanged. */
export function latestPrompt(messages: readonly SessionMessageInfo[]) {
  const user = messages.findLast((message) => message.type === "user")

  return user?.type === "user" ? user.text : undefined
}

/** The agent's answer to its latest prompt: every text part it wrote after the last user message. */
export function latestReply(messages: readonly SessionMessageInfo[]) {
  const start = messages.findLastIndex((message) => message.type === "user")

  return messages
    .slice(start + 1)
    .flatMap((message) =>
      message.type === "assistant" ? message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])) : [],
    )
    .join("\n\n")
    .trim()
}

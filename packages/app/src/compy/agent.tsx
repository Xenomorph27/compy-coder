import type { SessionMessageAssistantTool, SessionMessageInfo } from "@opencode/client/promise"
import { Markdown } from "@opencode/session-ui/markdown"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Select } from "@opencode/ui/select"
import { Spinner } from "@opencode/ui/spinner"
import { Tooltip } from "@opencode/ui/tooltip"
import { useNavigate } from "@solidjs/router"
import { createEffect, createMemo, For, Match, on, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { useData, useServer } from "@/runtime/server/current"
import { showToast } from "@/shell/notifications/toast"
import { sessionHref } from "@/shell/routes/session"
import type { ArenaController } from "./arena"
import { ChangesNavigator } from "./changes"
import { ContextMeter } from "./context-meter"
import { agentLabelKey, useCompy, type CompySide } from "./state"
import { contextUsage, totalTokens } from "./usage"

// The most telling string argument of a tool call, shown next to its name.
const TOOL_SUMMARY_KEYS = ["description", "filePath", "path", "pattern", "command", "url", "query"] as const

function toolSummary(tool: SessionMessageAssistantTool) {
  const input = tool.state.input

  if (!input || typeof input !== "object") return ""

  for (const key of TOOL_SUMMARY_KEYS) {
    const value = (input as Record<string, unknown>)[key]

    if (typeof value === "string" && value) return value
  }

  return ""
}

/** Everything the agent views read about one side: its label, model, transcript, subagents and usage. */
export function useAgent(arena: ArenaController, side: () => CompySide) {
  const compy = useCompy()
  const language = useLanguage()
  const data = useData()

  const sessionID = () => arena.sessionID(side())
  const model = () => arena.model(side())
  const messages = () => arena.messages(side())

  const subagents = createMemo(() => {
    const id = sessionID()

    return id ? data.session.list().filter((session) => session.parentID === id) : []
  })

  return {
    label: () => language.t(agentLabelKey(compy.arena()?.kind ?? "compete", side())),
    sessionID,
    model,
    messages,
    running: () => arena.running(side()),
    subagents,
    usage: createMemo(() => contextUsage(messages(), model()?.limit.context ?? 0)),
    totals: createMemo(() => {
      const id = sessionID()
      const session = arena.session(side())

      return {
        tokens: [session, ...subagents()].reduce((sum, item) => sum + (item ? totalTokens(item.tokens) : 0), 0),
        cost: id ? data.session.cost(id) : 0,
      }
    }),
  }
}

export type AgentView = ReturnType<typeof useAgent>

/** One agent's column in Compy: header, transcript, changed files, subagents and context. */
export function AgentPanel(props: { side: CompySide; arena: ArenaController }) {
  const language = useLanguage()
  const agent = useAgent(props.arena, () => props.side)

  return (
    <section data-slot="compy-panel" data-side={props.side} aria-label={agent.label()} class="flex min-h-0 flex-col">
      <AgentHeader side={props.side} arena={props.arena} agent={agent} />
      <Transcript messages={agent.messages()} running={agent.running()} sessionID={agent.sessionID()} />
      <ChangesNavigator
        sessionID={agent.sessionID()}
        messages={agent.messages()}
        running={agent.running()}
        title={language.t("compy.changes.title")}
      />
      <Subagents agent={agent} />
      <ContextMeter
        usage={agent.usage()}
        limit={agent.model()?.limit.context ?? 0}
        tokens={agent.totals().tokens}
        cost={agent.totals().cost}
      />
    </section>
  )
}

/** The agent's name, whether it is working, a link to its session and its model picker. */
export function AgentHeader(props: { side: CompySide; arena: ArenaController; agent: AgentView }) {
  const language = useLanguage()
  const server = useServer()
  const navigate = useNavigate()

  return (
    <header data-slot="compy-agent-header">
      <div class="flex h-7 items-center gap-2">
        <span data-slot="compy-agent-mark" aria-hidden="true" />
        <h2 class="text-[14px] font-medium leading-[var(--line-height-base)] text-v2-text-text-base">
          {props.agent.label()}
        </h2>
        <Show
          when={props.agent.running()}
          fallback={
            <span data-slot="compy-agent-status" data-state="idle">
              {language.t("compy.agent.idle")}
            </span>
          }
        >
          <span data-slot="compy-agent-status" data-state="running">
            <Spinner class="size-3.5" />
            {language.t("compy.agent.working")}
          </span>
        </Show>
        <div class="flex-1" />
        <Show when={props.agent.sessionID()}>
          {(id) => (
            <Tooltip placement="bottom" value={language.t("compy.agent.open")}>
              <IconButton
                icon={<Icon name="arrow-up-right" size="small" />}
                variant="ghost"
                size="small"
                aria-label={language.t("compy.agent.open")}
                onClick={() => navigate(sessionHref(server.key, id()))}
              />
            </Tooltip>
          )}
        </Show>
      </div>
      <Select
        options={props.arena.models()}
        current={props.agent.model()}
        value={(item) => `${item.provider.id}/${item.id}`}
        label={(item) => item.name}
        groupBy={(item) => item.provider.name}
        placeholder={language.t("compy.agent.modelPlaceholder")}
        onSelect={(item) => {
          if (!item) return
          props.arena.setModel(props.side, item).catch(() =>
            showToast({ variant: "error", title: language.t("compy.workspace.sendFailed", { agent: props.agent.label() }) }),
          )
        }}
      />
    </header>
  )
}

/** The agent's subagents, each with its tokens and cost. */
export function Subagents(props: { agent: AgentView }) {
  const language = useLanguage()
  const data = useData()

  const compact = createMemo(
    () => new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
  )

  const money = createMemo(
    () => new Intl.NumberFormat(language.intl(), { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  )

  return (
    <section data-slot="compy-subagents" aria-label={language.t("compy.subagents.title")}>
      <div class="flex items-center gap-2">
        <h3 data-slot="compy-eyebrow">{language.t("compy.subagents.title")}</h3>
        <Show when={props.agent.subagents().length > 0}>
          <span data-slot="compy-count">{props.agent.subagents().length}</span>
        </Show>
      </div>
      <Show
        when={props.agent.subagents().length > 0}
        fallback={<p class="text-[12px] text-v2-text-text-muted">{language.t("compy.subagents.empty")}</p>}
      >
        <ul data-scrollable class="flex max-h-[132px] min-h-0 flex-col gap-0.5 overflow-y-auto">
          <For each={props.agent.subagents()}>
            {(child) => (
              <li data-slot="compy-subagent">
                <Show
                  when={data.session.status(child.id) === "running"}
                  fallback={<span data-slot="compy-subagent-dot" aria-hidden="true" />}
                >
                  <Spinner class="size-3.5 shrink-0" />
                </Show>
                <span class="min-w-0 flex-1 truncate text-v2-text-text-base">{child.title ?? child.agent}</span>
                <span class="font-mono tabular-nums">
                  {language.t("compy.usage.tokens", { tokens: compact().format(totalTokens(child.tokens)) })}
                </span>
                <span class="font-mono tabular-nums text-v2-text-text-base">{money().format(child.cost)}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}

export function Transcript(props: {
  messages: readonly SessionMessageInfo[]
  running: boolean
  sessionID?: string
  empty?: string
}) {
  const language = useLanguage()
  let scroller: HTMLDivElement | undefined
  let pinned = true

  // Follow new output while the reader is at the bottom; leave them alone once they scroll up.
  createEffect(
    on(
      () => {
        const last = props.messages.at(-1)

        const grown =
          last?.type === "assistant"
            ? last.content.reduce((sum, part) => sum + (part.type === "tool" ? 1 : part.text.length), 0)
            : 0

        return props.messages.length * 1_000_000 + grown
      },
      () => {
        if (!scroller || !pinned) return
        requestAnimationFrame(() => scroller?.scrollTo({ top: scroller.scrollHeight }))
      },
    ),
  )

  return (
    <div
      ref={scroller}
      data-slot="compy-transcript"
      data-scrollable
      class="min-h-0 flex-1 overflow-y-auto"
      onScroll={(event) => {
        const el = event.currentTarget
        pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 48
      }}
    >
      <Show
        when={props.messages.some((message) => message.type === "user" || message.type === "assistant")}
        fallback={<p data-slot="compy-empty">{props.empty ?? language.t("compy.agent.empty")}</p>}
      >
        <For each={props.messages}>
          {(message) => (
            <Switch>
              <Match when={message.type === "user" && message}>
                {(user) => <div data-slot="compy-user">{user().text}</div>}
              </Match>
              <Match when={message.type === "idle" && message.outcome === "failed" ? message : undefined}>
                {(idle) => (
                  <p data-slot="compy-error" role="status">
                    <Icon name="circle-exclamation" size="small" />
                    <span>{idle().error?.message || language.t("compy.agent.failed")}</span>
                  </p>
                )}
              </Match>
              <Match when={message.type === "assistant" && message}>
                {(assistant) => (
                  <For each={assistant().content}>
                    {(part, index) => (
                      <Switch>
                        <Match when={part.type === "text" && part.text.trim() ? part : undefined}>
                          {(text) => (
                            <Markdown
                              data-slot="compy-reply"
                              text={text().text}
                              cacheKey={`compy:${props.sessionID}:${assistant().id}:${index()}`}
                              streaming={props.running && !assistant().time.completed}
                            />
                          )}
                        </Match>
                        <Match when={part.type === "tool" && part}>
                          {(tool) => (
                            <div data-slot="compy-tool" data-status={tool().state.status}>
                              <Icon name="outline-console" size="small" />
                              <code>{tool().name}</code>
                              <span class="min-w-0 truncate">{toolSummary(tool())}</span>
                            </div>
                          )}
                        </Match>
                      </Switch>
                    )}
                  </For>
                )}
              </Match>
            </Switch>
          )}
        </For>
      </Show>
    </div>
  )
}

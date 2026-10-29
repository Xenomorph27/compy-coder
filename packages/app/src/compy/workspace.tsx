import { Markdown } from "@opencode/session-ui/markdown"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { getFilename } from "@opencode/util/path"
import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { showToast } from "@/shell/notifications/toast"
import type { ArenaController, ArenaProject } from "./arena"
import { debatePrompt } from "./debate"
import { COMPY_SIDES, COMPY_STEPS, useCompy, type CompySide } from "./state"

const STEP_LABELS = {
  propose: "compy.workspace.step.propose",
  critique: "compy.workspace.step.critique",
  converge: "compy.workspace.step.converge",
} as const

const ACTION_LABELS = {
  propose: "compy.workspace.action.propose",
  critique: "compy.workspace.action.critique",
  converge: "compy.workspace.action.converge",
} as const

const other = (side: CompySide): CompySide => (side === "left" ? "right" : "left")

export function CompyWorkspace(props: {
  arena: ArenaController
  directory: string
  project?: ArenaProject
}) {
  const compy = useCompy()
  const language = useLanguage()
  // The route only renders the workspace while an arena is open.
  const open = () => compy.arena()!

  const agentLabel = (side: CompySide) => language.t(side === "left" ? "compy.agent.left" : "compy.agent.right")
  const next = () => COMPY_STEPS[open().step]
  const busy = () => COMPY_SIDES.some((side) => props.arena.running(side))
  const modelsReady = () => COMPY_SIDES.every((side) => !!props.arena.model(side))

  const failed = () => COMPY_SIDES.filter((side) => props.arena.failure(side) !== undefined)

  // A step only advances once both agents have answered the previous one; a failed turn is retried, not skipped.
  const blocked = createMemo(() => {
    if (busy()) return "busy" as const

    if (failed().length > 0) return "failed" as const

    if (open().step > 0 && COMPY_SIDES.some((side) => !props.arena.reply(side))) return "busy" as const

    if (!next()) return "done" as const

    if (!modelsReady()) return "models" as const

    if (open().step === 0 && !open().topic.trim()) return "topic" as const
  })

  const notify = (side: CompySide) => () =>
    showToast({ variant: "error", title: language.t("compy.workspace.sendFailed", { agent: agentLabel(side) }) })

  const retry = () => {
    for (const side of failed()) props.arena.retry(side).catch(notify(side))
  }

  const advance = () => {
    const step = next()

    if (!step || blocked()) return
    // Read both replies before sending, so each agent gets the other's answer from the same round.
    const replies = { left: props.arena.reply("left"), right: props.arena.reply("right") }
    compy.setStep(open().step + 1)

    for (const side of COMPY_SIDES)
      props.arena
        .send(side, debatePrompt(step, { topic: open().topic.trim(), other: replies[other(side)] }))
        .catch(notify(side))
  }

  return (
    <section data-slot="compy-panel" data-side="center" aria-label={language.t("compy.workspace.title")}>
      <header class="flex items-center gap-2">
        <h2 data-slot="compy-title">{language.t("compy.workspace.title")}</h2>
        <div class="min-w-0 flex-1" />
        <span data-slot="compy-project" title={props.directory}>
          <Icon name="folder" size="small" />
          <span class="truncate">{props.project?.name || getFilename(props.directory)}</span>
        </span>
        <Button variant="ghost" size="small" icon="outline-arrow-left" onClick={() => compy.close()}>
          {language.t("compy.workspace.action.arenas")}
        </Button>
      </header>

      <ol data-slot="compy-ribbon">
        <For each={COMPY_STEPS}>
          {(step, index) => (
            <li
              data-state={
                index() < open().step
                  ? index() === open().step - 1 && busy()
                    ? "running"
                    : "done"
                  : index() === open().step
                    ? "next"
                    : "pending"
              }
            >
              <span data-slot="compy-ribbon-dot" aria-hidden="true" />
              <span>{language.t(STEP_LABELS[step])}</span>
            </li>
          )}
        </For>
      </ol>

      <label class="flex flex-col gap-1.5">
        <span data-slot="compy-eyebrow">{language.t("compy.workspace.topic")}</span>
        <textarea
          data-slot="compy-topic"
          rows={4}
          value={open().topic}
          disabled={open().step > 0}
          placeholder={language.t("compy.workspace.topicPlaceholder")}
          onInput={(event) => compy.setTopic(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) advance()
          }}
        />
      </label>

      <div class="flex items-center gap-3">
        <p class="min-w-0 flex-1 text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
          <Show when={blocked() === "done"}>{language.t("compy.workspace.done")}</Show>
          <Show when={blocked() === "models"}>{language.t("compy.workspace.needModels")}</Show>
          <Show when={blocked() === "busy"}>{language.t("compy.workspace.waiting")}</Show>
          <Show when={blocked() === "failed"}>{language.t("compy.workspace.failed")}</Show>
        </p>
        <Show
          when={blocked() !== "failed"}
          fallback={
            <Button data-slot="compy-advance" variant="contrast" icon="reset" onClick={retry}>
              {language.t("compy.workspace.action.retry")}
            </Button>
          }
        >
          <Show when={next()}>
            {(step) => (
              <Button data-slot="compy-advance" variant="contrast" disabled={!!blocked()} onClick={advance}>
                {language.t(ACTION_LABELS[step()])}
              </Button>
            )}
          </Show>
        </Show>
      </div>

      <section data-slot="compy-plans" aria-label={language.t("compy.workspace.plans")} class="flex min-h-0 flex-1 flex-col gap-2">
        <h3 data-slot="compy-eyebrow">{language.t("compy.workspace.plans")}</h3>
        <div class="grid min-h-0 flex-1 grid-cols-2 gap-2">
          <For each={COMPY_SIDES}>
            {(side) => (
              <article data-slot="compy-plan" data-side={side}>
                <h4>
                  <span data-slot="compy-agent-mark" aria-hidden="true" />
                  {agentLabel(side)}
                </h4>
                <div data-scrollable class="min-h-0 flex-1 overflow-y-auto">
                  <Show
                    when={props.arena.reply(side)}
                    fallback={<p data-slot="compy-empty">{language.t("compy.workspace.noPlan")}</p>}
                  >
                    {(text) => (
                      <Markdown
                        text={text()}
                        cacheKey={`compy:plan:${side}:${props.arena.sessionID(side)}:${open().step}`}
                        streaming={props.arena.running(side)}
                      />
                    )}
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
    </section>
  )
}

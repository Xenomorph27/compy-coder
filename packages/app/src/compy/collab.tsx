import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { Spinner } from "@opencode/ui/spinner"
import { getFilename } from "@opencode/util/path"
import { createEffect, createMemo, For, Match, Show, Switch, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { showToast } from "@/shell/notifications/toast"
import { AgentHeader, Subagents, Transcript, useAgent } from "./agent"
import type { ArenaController, ArenaProject } from "./arena"
import { ChangesNavigator } from "./changes"
import { builderDone, collabPrompt, reviewVerdict } from "./collab-prompts"
import { ContextMeter } from "./context-meter"
import { agentLabelKey, COMPY_SIDES, useCompy, type CompySide } from "./state"
import { promptReplies } from "./usage"

// The run holds for the user after this many checkpoints in a row, so a loop that never converges stops spending.
const AUTO_LIMIT = 10

/**
 * Collab: the builder builds one checkpoint at a time and stops; the validator reviews the project read-only; its
 * review goes back to the builder, which fixes and builds the next checkpoint. The hand-offs run on their own until the
 * validator approves a checkpoint the builder marked as the last one. The builder gets the main section, the validator
 * a slim column at the right, and both context windows sit in one strip along the bottom.
 */
export function CollabWorkspace(props: { arena: ArenaController; directory: string; project?: ArenaProject }) {
  const compy = useCompy()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  // The route only renders the workspace while an arena is open.
  const open = () => compy.arena()!
  const builder = useAgent(props.arena, () => "left")
  const validator = useAgent(props.arena, () => "right")

  // `sent` is each agent's prompt count just before Compy last sent to it: a reply only counts once a newer prompt has
  // landed. `passes` lets a user-resumed run go past the automatic hold.
  const [flow, setFlow] = createStore({ sending: false, sent: { left: -1, right: -1 }, passes: 0 })

  const label = (side: CompySide) => language.t(agentLabelKey("collab", side))
  const prompts = (side: CompySide) => props.arena.messages(side).filter((message) => message.type === "user").length
  const failed = () => COMPY_SIDES.filter((side) => props.arena.failure(side) !== undefined)
  const busy = () => flow.sending || COMPY_SIDES.some((side) => props.arena.running(side))

  const settled = (side: CompySide) =>
    !flow.sending &&
    !props.arena.running(side) &&
    props.arena.failure(side) === undefined &&
    prompts(side) > flow.sent[side] &&
    !!props.arena.reply(side)

  const checkpoints = createMemo(() => {
    const builds = promptReplies(props.arena.messages("left"))
    const reviews = promptReplies(props.arena.messages("right"))

    return Array.from({ length: open().step }, (_, index) => {
      const review = reviews[index]

      return {
        number: index + 1,
        summary: builds[index] ?? "",
        state: review ? reviewVerdict(review) : ("reviewing" as const),
      }
    })
  })

  const notify = (side: CompySide) => () =>
    showToast({ variant: "error", title: language.t("compy.workspace.sendFailed", { agent: label(side) }) })

  const send = (side: CompySide, text: string) => {
    setFlow({ sending: true, sent: { ...flow.sent, [side]: prompts(side) } })

    return props.arena
      .send(side, text)
      .catch(notify(side))
      .finally(() => setFlow("sending", false))
  }

  const start = () => {
    if (!open().topic.trim() || !COMPY_SIDES.every((side) => props.arena.model(side))) return
    compy.setPhase("build", 0)
    void send("left", collabPrompt.start(open().topic.trim()))
  }

  // The builder stopped at a checkpoint: hand its report and the files it changed to the validator.
  const review = async () => {
    const checkpoint = open().step + 1
    const summary = props.arena.reply("left")
    const sessionID = props.arena.sessionID("left")
    const users = props.arena.messages("left").filter((message) => message.type === "user")

    setFlow("sending", true)
    const files =
      sessionID && users[0]
        ? await serverSDK.api.session
            .diff({ sessionID, from: users[0].id, to: users.at(-1)?.id, context: 0 })
            .catch(() => [])
        : []

    compy.setPhase("review", checkpoint)
    await send("right", collabPrompt.review({ task: open().topic.trim(), checkpoint, summary, files }))
  }

  // The validator answered: finish, hold, or send its review back to the builder.
  const feedback = () => {
    const text = props.arena.reply("right")
    const approved = reviewVerdict(text) === "approve"

    if (approved && builderDone(props.arena.reply("left"))) return compy.setPhase("done")

    if (open().step % AUTO_LIMIT === 0 && flow.passes === 0) return compy.setPaused(true)
    setFlow("passes", Math.max(0, flow.passes - 1))
    compy.setPhase("build")
    void send("left", collabPrompt.feedback({ checkpoint: open().step, review: text, approved }))
  }

  createEffect(() => {
    const current = open()

    if (current.paused || failed().length > 0) return

    if (current.phase === "build" && settled("left")) return untrack(() => void review())

    if (current.phase === "review" && settled("right")) untrack(feedback)
  })

  const resume = () => {
    setFlow("passes", 1)
    compy.setPaused(false)
  }

  const retry = () => {
    for (const side of failed()) {
      setFlow("sent", side, prompts(side))
      props.arena.retry(side).catch(notify(side))
    }
  }

  const status = createMemo(() => {
    if (failed().length > 0) return "failed" as const

    if (open().phase === "done") return "done" as const

    if (open().phase === "idle") return COMPY_SIDES.every((side) => props.arena.model(side)) ? "ready" : "models"

    if (open().paused && !busy()) return "paused" as const

    return open().phase === "build" ? ("building" as const) : ("reviewing" as const)
  })

  const verdict = () =>
    props.arena.reply("right") && !props.arena.running("right") ? reviewVerdict(props.arena.reply("right")) : undefined

  return (
    <div data-slot="collab-layout" class="grid min-h-0 flex-1 gap-2">
      <section
        data-slot="compy-panel"
        data-side="left"
        data-role="main"
        aria-label={language.t("collab.workspace.title")}
      >
        <header class="flex items-center gap-2">
          <h2 data-slot="compy-title">{language.t("collab.workspace.title")}</h2>
          <div class="min-w-0 flex-1" />
          <span data-slot="compy-project" title={props.directory}>
            <Icon name="folder" size="small" />
            <span class="truncate">{props.project?.name || getFilename(props.directory)}</span>
          </span>
          <Button variant="ghost" size="small" icon="outline-arrow-left" onClick={() => compy.close()}>
            {language.t("collab.workspace.all")}
          </Button>
        </header>

        <div data-slot="collab-brief">
          <label class="flex min-w-0 flex-col gap-1.5">
            <span data-slot="compy-eyebrow">{language.t("collab.workspace.task")}</span>
            <textarea
              data-slot="compy-topic"
              rows={4}
              value={open().topic}
              disabled={open().phase !== "idle"}
              placeholder={language.t("collab.workspace.taskPlaceholder")}
              onInput={(event) => compy.setTopic(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) start()
              }}
            />
          </label>
          <div data-slot="collab-builder">
            <AgentHeader side="left" arena={props.arena} agent={builder} />
            <p data-slot="collab-status" data-state={status()}>
              <Show when={status() === "building" || status() === "reviewing"}>
                <Spinner class="size-3.5 shrink-0" />
              </Show>
              <span class="min-w-0">
                {language.t(`collab.status.${status()}`, {
                  checkpoint: open().phase === "build" ? open().step + 1 : open().step,
                  builder: label("left"),
                  validator: label("right"),
                })}
              </span>
            </p>
            <div class="mt-auto flex flex-wrap items-center justify-end gap-2">
              <Switch>
                <Match when={status() === "failed"}>
                  <Button data-slot="compy-advance" variant="contrast" icon="reset" onClick={retry}>
                    {language.t("compy.workspace.action.retry")}
                  </Button>
                </Match>
                <Match when={open().phase === "idle"}>
                  <Button
                    data-slot="compy-advance"
                    variant="contrast"
                    disabled={status() !== "ready" || !open().topic.trim() || flow.sending}
                    onClick={start}
                  >
                    {language.t("collab.action.start")}
                  </Button>
                </Match>
                <Match when={open().phase !== "done"}>
                  <Button variant="ghost" size="small" onClick={() => compy.setPhase("done")}>
                    {language.t("collab.action.finish")}
                  </Button>
                  <Show
                    when={open().paused}
                    fallback={
                      <Button variant="outline" onClick={() => compy.setPaused(true)}>
                        {language.t("collab.action.pause")}
                      </Button>
                    }
                  >
                    <Button data-slot="compy-advance" variant="contrast" onClick={resume}>
                      {language.t("collab.action.resume")}
                    </Button>
                  </Show>
                </Match>
              </Switch>
            </div>
          </div>
        </div>

        <Show when={checkpoints().length > 0}>
          <ol data-slot="collab-checkpoints" aria-label={language.t("collab.workspace.checkpoints")}>
            <For each={checkpoints()}>
              {(item) => (
                <li data-state={item.state} title={item.summary.slice(0, 280)}>
                  <span data-slot="collab-checkpoint-dot" aria-hidden="true" />
                  {language.t("collab.checkpoint.label", { checkpoint: item.number })}
                  <span data-slot="collab-checkpoint-state">{language.t(`collab.checkpoint.${item.state}`)}</span>
                </li>
              )}
            </For>
          </ol>
        </Show>

        <div data-slot="collab-body">
          <Transcript
            messages={builder.messages()}
            running={builder.running()}
            sessionID={builder.sessionID()}
            empty={language.t("collab.workspace.builderEmpty")}
          />
          <aside data-scrollable class="flex min-h-0 flex-col gap-5 overflow-y-auto">
            <ChangesNavigator
              sessionID={builder.sessionID()}
              messages={builder.messages()}
              running={builder.running()}
              title={language.t("compy.changes.title")}
            />
            <Subagents agent={builder} />
          </aside>
        </div>
      </section>

      <section data-slot="compy-panel" data-side="right" data-role="reviewer" aria-label={validator.label()}>
        <AgentHeader side="right" arena={props.arena} agent={validator} />
        <Show when={verdict()}>
          {(state) => (
            <span data-slot="collab-verdict" data-state={state()}>
              {language.t(`collab.checkpoint.${state()}`)}
            </span>
          )}
        </Show>
        <Transcript
          messages={validator.messages()}
          running={validator.running()}
          sessionID={validator.sessionID()}
          empty={language.t("collab.workspace.reviewerEmpty")}
        />
        <Subagents agent={validator} />
      </section>

      <section data-slot="collab-context" aria-label={language.t("compy.context.title")}>
        <For each={[builder, validator]}>
          {(agent) => (
            <ContextMeter
              usage={agent.usage()}
              limit={agent.model()?.limit.context ?? 0}
              tokens={agent.totals().tokens}
              cost={agent.totals().cost}
              label={agent.label()}
              model={agent.model()?.name}
            />
          )}
        </For>
      </section>
    </div>
  )
}

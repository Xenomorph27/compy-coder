import { createEffect, createMemo, on, Show } from "solid-js"
import { useLocal } from "@/providers/models/selection"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { AgentPanel } from "./agent"
import { CollabWorkspace } from "./collab"
import { agentLabelKey, COMPY_SIDES, useCompy, type CompySide } from "./state"
import { latestFailure, latestPrompt, latestReply } from "./usage"
import { CompyWorkspace } from "./workspace"

/** What the arena needs from a project in the server's project list. */
export type ArenaProject = { worktree: string; name?: string }

export type CompyModel = ReturnType<ReturnType<typeof useLocal>["model"]["list"]>[number]

export type ArenaController = ReturnType<typeof createArenaController>

/** One place that owns both agents' sessions, so the panels and the workspace read and send through the same paths. */
function createArenaController(directory: string) {
  const compy = useCompy()
  const data = useData()
  const serverSDK = useServerSDK()
  const local = useLocal()
  const language = useLanguage()

  const models = createMemo(() =>
    local.model.list().filter((item) => local.model.visible({ providerID: item.provider.id, modelID: item.id })),
  )

  const agent = (side: CompySide) => compy.arena()?.[side]
  const sessionID = (side: CompySide) => agent(side)?.sessionID

  // Both agents start on the model Normal mode uses, so an arena works before anyone picks.
  createEffect(() => {
    const current = local.model.current()

    const open = compy.arena()

    if (!open || !current) return

    for (const side of COMPY_SIDES)
      if (!open[side].modelID) compy.setModel(side, { providerID: current.provider.id, modelID: current.id })
  })

  for (const side of COMPY_SIDES)
    createEffect(
      on(
        () => sessionID(side),
        (id) => {
          if (!id) return
          void data.session.sync(id, { children: true }).catch(() => undefined)
          void data.session.message.sync(id).catch(() => undefined)
        },
      ),
    )

  const controller = {
    models,
    sessionID,
    model(side: CompySide) {
      const chosen = agent(side)

      return local.model.list().find((item) => item.provider.id === chosen?.providerID && item.id === chosen?.modelID)
    },
    session(side: CompySide) {
      const id = sessionID(side)

      return id ? data.session.get(id) : undefined
    },
    messages(side: CompySide) {
      const id = sessionID(side)

      return id ? data.session.message.list(id) : []
    },
    running(side: CompySide) {
      const id = sessionID(side)

      return !!id && data.session.status(id) === "running"
    },
    reply(side: CompySide) {
      return latestReply(controller.messages(side))
    },
    failure(side: CompySide) {
      return latestFailure(controller.messages(side))
    },
    /** Sends a failed agent its last prompt again. */
    retry(side: CompySide) {
      const text = latestPrompt(controller.messages(side))

      return text ? controller.send(side, text) : Promise.resolve()
    },
    async setModel(side: CompySide, item: CompyModel) {
      compy.setModel(side, { providerID: item.provider.id, modelID: item.id })
      const id = sessionID(side)

      if (id) await serverSDK.api.session.switchModel({ sessionID: id, model: { id: item.id, providerID: item.provider.id } })
    },
    /**
     * Sends to an agent, creating its session first. Debaters and the collab validator run the read-only plan agent
     * when it exists; the collab builder runs the build agent, so it can change files.
     */
    send(side: CompySide, text: string) {
      const model = controller.model(side)

      if (!model) return Promise.reject(new Error("No model selected"))
      const existing = sessionID(side)

      if (existing) return data.session.prompt({ sessionID: existing, text })

      const agents = local.agent.list()
      const kind = compy.arena()?.kind ?? "compete"
      const role = kind === "collab" && side === "left" ? "build" : "plan"

      const created = data.session.create({
        agent: (agents.find((item) => item.name === role) ?? local.agent.current())?.name,
        title: language.t(agentLabelKey(kind, side)),
        model: { id: model.id, providerID: model.provider.id },
        location: { directory },
      })

      compy.setSession(side, created.id)

      return data.session.prompt({ sessionID: created.id, text, gate: created.request })
    },
  }

  return controller
}

export function CompyArena(props: { directory: string; project?: ArenaProject }) {
  const compy = useCompy()
  const arena = createArenaController(props.directory)
  const collab = () => compy.arena()?.kind === "collab"

  return (
    <div data-slot="compy-arena" data-kind={collab() ? "collab" : "compete"} class="grid min-h-0 flex-1 gap-2">
      <AgentPanel side="left" arena={arena} />
      <Show
        when={collab()}
        fallback={<CompyWorkspace arena={arena} directory={props.directory} project={props.project} />}
      >
        <CollabWorkspace arena={arena} directory={props.directory} project={props.project} />
      </Show>
      {/* The validator changes nothing itself, so its navigator follows the builder's changes under review. */}
      <AgentPanel side="right" arena={arena} changes={collab() ? "left" : "right"} />
    </div>
  )
}

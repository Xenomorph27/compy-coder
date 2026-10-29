import { createEffect, createMemo, on } from "solid-js"
import { useLocal } from "@/providers/models/selection"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { useData } from "@/runtime/server/current"
import { AgentPanel } from "./agent"
import { COMPY_SIDES, useCompy, type CompySide } from "./state"
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

  const sessionID = (side: CompySide) => compy.state[side].sessionID

  // Both agents start on the model Normal mode uses, so an arena works before anyone picks.
  createEffect(() => {
    const current = local.model.current()

    if (!compy.ready() || !current) return

    for (const side of COMPY_SIDES)
      if (!compy.state[side].modelID) compy.setModel(side, { providerID: current.provider.id, modelID: current.id })
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
      const agent = compy.state[side]

      return local.model.list().find((item) => item.provider.id === agent.providerID && item.id === agent.modelID)
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
    /** Sends to an agent, creating its session first. Debate sessions run the read-only plan agent when it exists. */
    send(side: CompySide, text: string) {
      const model = controller.model(side)

      if (!model) return Promise.reject(new Error("No model selected"))
      const existing = sessionID(side)

      if (existing) return data.session.prompt({ sessionID: existing, text })

      const agents = local.agent.list()

      const created = data.session.create({
        agent: (agents.find((item) => item.name === "plan") ?? local.agent.current())?.name,
        title: language.t(side === "left" ? "compy.agent.left" : "compy.agent.right"),
        model: { id: model.id, providerID: model.provider.id },
        location: { directory },
      })

      compy.setSession(side, created.id)

      return data.session.prompt({ sessionID: created.id, text, gate: created.request })
    },
  }

  return controller
}

export function CompyArena(props: { directory: string; projects: () => readonly ArenaProject[] }) {
  const arena = createArenaController(props.directory)

  return (
    <div data-slot="compy-arena" class="grid min-h-0 flex-1 gap-2">
      <AgentPanel side="left" arena={arena} />
      <CompyWorkspace arena={arena} directory={props.directory} projects={props.projects} />
      <AgentPanel side="right" arena={arena} />
    </div>
  )
}

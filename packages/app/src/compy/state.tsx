import { createSimpleContext } from "@opencode/ui/context"
import { useLocation, useNavigate } from "@solidjs/router"
import { Schema } from "effect"
import { createEffect, createMemo } from "solid-js"
import { Persistence } from "@/runtime/persistence/schema"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { setCompyRetainedSessions } from "./retained"

export type CompySide = "left" | "right"

export const COMPY_SIDES = ["left", "right"] as const satisfies readonly CompySide[]

/** The debate steps sent to both agents, in order. An arena's `step` counts how many have been sent. */
export const COMPY_STEPS = ["propose", "discuss", "critique", "revamp", "converge"] as const

export type CompyStep = (typeof COMPY_STEPS)[number]

const Agent = Persistence.struct({
  providerID: Persistence.optional(Schema.String),
  modelID: Persistence.optional(Schema.String),
  sessionID: Persistence.optional(Schema.String),
})

type Agent = typeof Agent.Type

const ArenaRecord = Persistence.struct({
  id: Schema.String,
  server: Schema.String,
  directory: Schema.String,
  topic: Persistence.fallback(Schema.String, () => ""),
  left: Persistence.fallback(Agent, () => ({})),
  right: Persistence.fallback(Agent, () => ({})),
  step: Persistence.fallback(Schema.Number, () => 0),
  created: Schema.Number,
  updated: Schema.Number,
})

export type CompyArena = typeof ArenaRecord.Type

const Store = Persistence.struct({
  arenas: Persistence.array(ArenaRecord),
  /** The open arena; none means the lobby, where previous arenas are listed. */
  current: Persistence.optional(Schema.String),
  /** Where Normal mode was when the user switched to Compy, so switching back returns there. */
  returnTo: Persistence.optional(Schema.String),
})

export const { use: useCompy, provider: CompyProvider } = createSimpleContext({
  name: "Compy",
  // The whole shell sits inside this provider, so it must not wait for the stored arenas; callers check `ready`.
  gate: false,
  init: () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [store, setStore, , ready] = persisted(Persist.global("compy.arenas"), Store, { arenas: [] })

    const active = () => location.pathname === "/compy"
    const index = () => store.arenas.findIndex((arena) => arena.id === store.current)
    const arena = createMemo(() => store.arenas[index()])
    const arenas = createMemo(() => store.arenas.toSorted((a, b) => b.updated - a.updated))

    // Only the open arena's agents stay loaded; a resumed arena loads its transcripts again.
    createEffect(() => {
      const open = arena()

      setCompyRetainedSessions(
        open ? COMPY_SIDES.flatMap((side) => (open[side].sessionID ? [open[side].sessionID] : [])) : [],
      )
    })

    const update = (fn: (arena: CompyArena) => Partial<CompyArena>) => {
      const at = index()

      if (at < 0) return
      setStore("arenas", at, { ...fn(store.arenas[at]), updated: Date.now() })
    }

    // A new arena starts with the models of the most recent one, so a favourite pairing carries over.
    const lastModels = (side: CompySide): Agent => {
      const latest = arenas()[0]?.[side]

      return latest ? { providerID: latest.providerID, modelID: latest.modelID } : {}
    }

    return {
      ready,
      active,
      arena,
      arenas,
      enter() {
        if (active()) return
        setStore({ returnTo: `${location.pathname}${location.search}`, current: undefined })
        navigate("/compy")
      },
      leave() {
        if (!active()) return
        navigate(store.returnTo ?? "/")
      },
      start(server: string, directory: string) {
        const now = Date.now()
        const id = `arena_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`

        setStore("arenas", store.arenas.length, {
          id,
          server,
          directory,
          topic: "",
          left: lastModels("left"),
          right: lastModels("right"),
          step: 0,
          created: now,
          updated: now,
        })
        setStore("current", id)
      },
      resume(id: string) {
        setStore("current", id)
      },
      /** Back to the lobby; the arena stays in the list. */
      close() {
        setStore("current", undefined)
      },
      remove(id: string) {
        setStore({
          arenas: store.arenas.filter((item) => item.id !== id),
          current: store.current === id ? undefined : store.current,
        })
      },
      setModel(side: CompySide, model: { providerID: string; modelID: string }) {
        update((open) => ({ [side]: { ...open[side], ...model } }))
      },
      setSession(side: CompySide, sessionID: string) {
        update((open) => ({ [side]: { ...open[side], sessionID } }))
      },
      setTopic(topic: string) {
        update(() => ({ topic }))
      },
      setStep(step: number) {
        update(() => ({ step }))
      },
    }
  },
})

import { createSimpleContext } from "@opencode/ui/context"
import { useLocation, useNavigate } from "@solidjs/router"
import { Schema } from "effect"
import { createEffect } from "solid-js"
import { setCompyRetainedSessions } from "./retained"
import { Persistence } from "@/runtime/persistence/schema"
import { Persist, persisted } from "@/runtime/persistence/storage"

export type CompySide = "left" | "right"

export const COMPY_SIDES = ["left", "right"] as const satisfies readonly CompySide[]

/** The debate steps sent to both agents, in order. `step` in the arena counts how many have been sent. */
export const COMPY_STEPS = ["propose", "critique", "converge"] as const

export type CompyStep = (typeof COMPY_STEPS)[number]

const Agent = Persistence.struct({
  providerID: Persistence.optional(Schema.String),
  modelID: Persistence.optional(Schema.String),
  sessionID: Persistence.optional(Schema.String),
})

const Arena = Persistence.struct({
  server: Persistence.optional(Schema.String),
  directory: Persistence.optional(Schema.String),
  topic: Persistence.fallback(Schema.String, () => ""),
  left: Persistence.fallback(Agent, () => ({})),
  right: Persistence.fallback(Agent, () => ({})),
  step: Persistence.fallback(Schema.Number, () => 0),
  /** Where Normal mode was when the user switched to Compy, so switching back returns there. */
  returnTo: Persistence.optional(Schema.String),
})

export const { use: useCompy, provider: CompyProvider } = createSimpleContext({
  name: "Compy",
  // The whole shell sits inside this provider, so it must not wait for the stored arena; callers check `ready`.
  gate: false,
  init: () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [state, setState, , ready] = persisted(Persist.global("compy.arena"), Arena, {
      topic: "",
      left: {},
      right: {},
      step: 0,
    })

    const active = () => location.pathname === "/compy"

    createEffect(() =>
      setCompyRetainedSessions(COMPY_SIDES.flatMap((side) => (state[side].sessionID ? [state[side].sessionID] : []))),
    )

    return {
      state,
      ready,
      active,
      enter() {
        if (active()) return
        setState("returnTo", `${location.pathname}${location.search}`)
        navigate("/compy")
      },
      leave() {
        if (!active()) return
        navigate(state.returnTo ?? "/")
      },
      /** A different project starts a fresh arena: sessions belong to the project they were created in. */
      setProject(server: string, directory: string) {
        if (state.server === server && state.directory === directory) return
        setState({
          server,
          directory,
          step: 0,
          left: { ...state.left, sessionID: undefined },
          right: { ...state.right, sessionID: undefined },
        })
      },
      setModel(side: CompySide, model: { providerID: string; modelID: string }) {
        setState(side, model)
      },
      setSession(side: CompySide, sessionID: string) {
        setState(side, "sessionID", sessionID)
      },
      setTopic(topic: string) {
        setState("topic", topic)
      },
      setStep(step: number) {
        setState("step", step)
      },
      reset() {
        setState({
          topic: "",
          step: 0,
          left: { ...state.left, sessionID: undefined },
          right: { ...state.right, sessionID: undefined },
        })
      },
    }
  },
})

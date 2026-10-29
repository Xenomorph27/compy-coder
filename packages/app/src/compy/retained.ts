import { createSignal } from "solid-js"

// The arena's agent sessions are not tabs, so transcript retention would otherwise evict them whenever the session
// list changes. Compy publishes their IDs here and the server runtime keeps them alongside open tabs.
const [retained, setRetained] = createSignal<readonly string[]>([])

export const compyRetainedSessions = retained

export const setCompyRetainedSessions = setRetained

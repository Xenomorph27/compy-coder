import { createMemo, Show } from "solid-js"
import { ModelsProvider } from "@/providers/models/models"
import { ServerProvider } from "@/runtime/server/current"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { SessionUIProvider } from "@/shell/routes/session-ui-provider"
import { LocationProvider } from "@/workspaces/location"
import { CompyArena } from "./arena"
import { CompyLobby } from "./lobby"
import { useCompy } from "./state"
import "./compy.css"

export function CompyRoute() {
  const global = useGlobal()
  const compy = useCompy()

  // The open arena's own server, once it is reachable.
  const conn = createMemo(() => {
    const open = compy.arena()

    if (!open) return

    return global.servers
      .list()
      .find(
        (item) =>
          ServerConnection.key(item) === open.server && global.servers.health[ServerConnection.key(item)]?.healthy,
      )
  })

  const projects = createMemo(() => {
    const value = conn()

    return value ? global.ensureServerCtx(value).projects.list() : []
  })

  return (
    <div
      data-component="compy"
      data-kind={compy.kind() ?? "compete"}
      class="relative flex size-full min-h-0 flex-col px-[var(--shell-inline-inset,8px)] pb-[var(--shell-bottom-inset,8px)] pt-[var(--shell-top-inset,8px)]"
    >
      <Show when={compy.arena() && conn() ? compy.arena()!.id : undefined} keyed fallback={<CompyLobby />}>
        {(id) => {
          const open = compy.arenas().find((item) => item.id === id)!

          return (
            <ServerProvider conn={conn()!}>
              <ModelsProvider directory={open.directory}>
                <LocationProvider directory={open.directory}>
                  <SessionUIProvider directory={open.directory} server={open.server as ServerConnection.Key}>
                    <CompyArena
                      directory={open.directory}
                      project={projects().find((item) => item.worktree === open.directory)}
                    />
                  </SessionUIProvider>
                </LocationProvider>
              </ModelsProvider>
            </ServerProvider>
          )
        }}
      </Show>
    </div>
  )
}

import { createEffect, createMemo, Show } from "solid-js"
import { ModelsProvider } from "@/providers/models/models"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerProvider } from "@/runtime/server/current"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { SessionUIProvider } from "@/shell/routes/session-ui-provider"
import { LocationProvider } from "@/workspaces/location"
import { CompyArena } from "./arena"
import { useCompy } from "./state"
import "./compy.css"

export function CompyRoute() {
  const global = useGlobal()
  const compy = useCompy()
  const language = useLanguage()

  // The saved server, else the first one that is reachable and signed in.
  const conn = createMemo(() => {
    const list = global.servers.list()
    const healthy = (item: ServerConnection.Any) => !!global.servers.health[ServerConnection.key(item)]?.healthy

    return (
      list.find((item) => ServerConnection.key(item) === compy.state.server && healthy(item)) ??
      list.find(healthy) ??
      list[0]
    )
  })

  const projects = createMemo(() => {
    const value = conn()

    return value ? global.ensureServerCtx(value).projects : undefined
  })

  const directory = createMemo(() => {
    const value = conn()

    if (value && compy.state.server === ServerConnection.key(value) && compy.state.directory)
      return compy.state.directory

    return projects()?.last()?.worktree ?? projects()?.list()[0]?.worktree
  })

  // Start in the last project used in Normal mode, and remember it once the stored arena has loaded.
  createEffect(() => {
    const value = conn()
    const dir = directory()

    if (!compy.ready() || !value || !dir || compy.state.directory) return
    compy.setProject(ServerConnection.key(value), dir)
  })

  return (
    <div
      data-component="compy"
      class="relative flex size-full min-h-0 flex-col px-[var(--shell-inline-inset,8px)] pb-[var(--shell-bottom-inset,8px)] pt-[var(--shell-top-inset,8px)]"
    >
      <Show
        when={conn() && directory() ? `${ServerConnection.key(conn()!)}\0${directory()}` : undefined}
        keyed
        fallback={
          <div data-slot="compy-panel" class="flex flex-1 items-center justify-center p-8 text-center">
            <p class="max-w-[360px] text-[14px] leading-[var(--line-height-base)] text-v2-text-text-muted">
              {language.t("compy.workspace.noProject")}
            </p>
          </div>
        }
      >
        {(target) => {
          const [server, dir] = target.split("\0")

          return (
            <ServerProvider conn={conn()!}>
              <ModelsProvider directory={dir}>
                <LocationProvider directory={dir}>
                  <SessionUIProvider directory={dir} server={server as ServerConnection.Key}>
                    <CompyArena directory={dir} projects={() => projects()?.list() ?? []} />
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

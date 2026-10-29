import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Select } from "@opencode/ui/select"
import { Tooltip } from "@opencode/ui/tooltip"
import { getFilename } from "@opencode/util/path"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"
import { getRelativeTime } from "@/shell/time"
import { CompyHero } from "./hero"
import { COMPY_STEPS, useCompy, type CompyArena } from "./state"

type ProjectChoice = { server: string; directory: string; name: string }

const STEP_LABELS = {
  propose: "compy.workspace.step.propose",
  discuss: "compy.workspace.step.discuss",
  critique: "compy.workspace.step.critique",
  revamp: "compy.workspace.step.revamp",
  converge: "compy.workspace.step.converge",
} as const

/** Where Compy mode opens: start a new arena or resume a previous one. */
export function CompyLobby() {
  const compy = useCompy()
  const global = useGlobal()
  const language = useLanguage()

  // Projects on every reachable server, most recently used first within each server.
  const projects = createMemo(() =>
    global.servers.list().flatMap((conn): ProjectChoice[] => {
      const server = ServerConnection.key(conn)

      if (!global.servers.health[server]?.healthy) return []
      const ctx = global.ensureServerCtx(conn).projects
      const last = ctx.last()?.worktree

      return ctx
        .list()
        .toSorted((a, b) => Number(b.worktree === last) - Number(a.worktree === last))
        .map((project) => ({ server, directory: project.worktree, name: project.name || getFilename(project.worktree) }))
    }),
  )

  const [picked, setPicked] = createSignal<ProjectChoice>()
  const choice = () => picked() ?? projects()[0]

  const projectName = (arena: CompyArena) =>
    projects().find((item) => item.server === arena.server && item.directory === arena.directory)?.name ??
    getFilename(arena.directory)

  const collab = () => compy.kind() === "collab"
  // Collab and Compy share the lobby; only the copy differs.
  const copy = (name: "new" | "newDescription" | "start" | "previous" | "empty" | "untitled") =>
    language.t(collab() ? `collab.lobby.${name}` : `compy.lobby.${name}`)

  const progress = (arena: CompyArena) => {
    if (arena.kind === "collab")
      return arena.phase === "done"
        ? language.t("collab.lobby.done")
        : arena.phase === "idle"
          ? language.t("collab.lobby.notStarted")
          : language.t("collab.lobby.checkpoint", { checkpoint: Math.max(1, arena.step) })

    return arena.step >= COMPY_STEPS.length
      ? language.t("compy.lobby.finished")
      : language.t("compy.lobby.step", {
          step: arena.step + 1,
          total: COMPY_STEPS.length,
          name: language.t(STEP_LABELS[COMPY_STEPS[arena.step]]),
        })
  }

  const finished = (arena: CompyArena) =>
    arena.kind === "collab" ? arena.phase === "done" : arena.step >= COMPY_STEPS.length

  return (
    <div data-slot="compy-lobby" data-scrollable class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-6 pb-16 pt-[10vh]">
        <CompyHero tagline={collab() ? "collab" : "arena"} />

        <section data-slot="compy-panel" data-side="center" aria-label={copy("new")}>
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex min-w-[200px] flex-1 flex-col gap-1">
              <h2 data-slot="compy-title">{copy("new")}</h2>
              <p class="text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
                {copy("newDescription")}
              </p>
            </div>
            <div class="w-[240px] min-w-0">
              <Select
                options={projects()}
                current={choice()}
                value={(item) => `${item.server}\0${item.directory}`}
                label={(item) => item.name}
                placeholder={language.t("compy.workspace.projectPlaceholder")}
                onSelect={(item) => item && setPicked(item)}
              />
            </div>
            <Button
              data-slot="compy-advance"
              variant="contrast"
              icon="plus"
              disabled={!choice()}
              onClick={() => {
                const target = choice()

                if (target) compy.start(target.server, target.directory)
              }}
            >
              {copy("start")}
            </Button>
          </div>
          <Show when={projects().length === 0}>
            <p class="text-[13px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
              {language.t("compy.workspace.noProject")}
            </p>
          </Show>
        </section>

        <section class="flex flex-col gap-3" aria-label={copy("previous")}>
          <h2 data-slot="compy-eyebrow">{copy("previous")}</h2>
          <Show
            when={compy.arenas().length > 0}
            fallback={<p data-slot="compy-empty">{copy("empty")}</p>}
          >
            <ul class="flex flex-col gap-1">
              <For each={compy.arenas()}>
                {(arena) => (
                  <li data-slot="compy-arena-row">
                    <button
                      type="button"
                      data-slot="compy-arena-open"
                      onClick={() => compy.resume(arena.id)}
                    >
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[14px] font-medium leading-[var(--line-height-base)] text-v2-text-text-base">
                          {arena.topic.trim() || copy("untitled")}
                        </span>
                        <span class="flex min-w-0 items-center gap-2 text-[12px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
                          <Icon name="folder" size="small" />
                          <span class="truncate">{projectName(arena)}</span>
                          <span aria-hidden="true">·</span>
                          <span class="truncate font-mono">
                            {arena.left.modelID ?? "–"} / {arena.right.modelID ?? "–"}
                          </span>
                        </span>
                      </span>
                      <span data-slot="compy-arena-progress" data-finished={finished(arena) || undefined}>
                        {progress(arena)}
                      </span>
                      <span class="w-[72px] shrink-0 text-end font-mono text-[12px] tabular-nums text-v2-text-text-muted">
                        {getRelativeTime(new Date(arena.updated).toISOString(), language.t)}
                      </span>
                      <span data-slot="compy-arena-resume">
                        {language.t("compy.lobby.resume")}
                        <Icon name="outline-arrow-right" size="small" />
                      </span>
                    </button>
                    <Tooltip placement="top" value={language.t("compy.lobby.delete")}>
                      <IconButton
                        variant="ghost"
                        size="small"
                        icon={<Icon name="outline-trash" size="small" />}
                        aria-label={language.t("compy.lobby.delete")}
                        onClick={() => compy.remove(arena.id)}
                      />
                    </Tooltip>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </div>
    </div>
  )
}

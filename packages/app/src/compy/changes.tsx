import type { FileDiffInfo, SessionMessageInfo } from "@opencode/client/promise"
import { Icon } from "@opencode/ui/icon"
import { createEffect, createMemo, For, on, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { changeTree, type ChangeNode } from "./changes-tree"

/**
 * The files an agent's session changed, as a folder tree with green and red line counts. The diff spans the session's
 * first prompt to its latest one, and reloads as the agent's tools finish, so a running agent's counts move live.
 */
export function ChangesNavigator(props: {
  sessionID?: string
  messages: readonly SessionMessageInfo[]
  running: boolean
  title: string
}) {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const [state, setState] = createStore({ files: [] as readonly FileDiffInfo[], closed: {} as Record<string, boolean> })

  const range = createMemo(() => {
    const users = props.messages.filter((message) => message.type === "user")

    return { from: users[0]?.id, to: users.at(-1)?.id }
  })

  // Changes when a prompt lands, a tool finishes or the agent stops: the moments the working tree can have moved.
  const progress = () =>
    props.messages.reduce(
      (sum, message) =>
        sum +
        1 +
        (message.type === "assistant"
          ? message.content.filter((part) => part.type === "tool" && part.state.status === "completed").length
          : 0),
      props.running ? 0.5 : 0,
    )

  let timer: ReturnType<typeof setTimeout> | undefined
  let request = 0
  onCleanup(() => clearTimeout(timer))

  createEffect(
    on([() => props.sessionID, () => range().from, () => range().to, progress], ([sessionID, from, to]) => {
      clearTimeout(timer)

      if (!sessionID || !from) return setState("files", [])
      const id = ++request

      timer = setTimeout(() => {
        serverSDK.api.session
          .diff({ sessionID, from, to, context: 0 })
          .then((files) => id === request && setState("files", files))
          .catch(() => undefined)
      }, 500)
    }),
  )

  const tree = createMemo(() => changeTree(state.files))
  const totals = createMemo(() =>
    state.files.reduce((sum, file) => ({ add: sum.add + file.additions, del: sum.del + file.deletions }), { add: 0, del: 0 }),
  )

  return (
    <section data-slot="compy-changes" aria-label={props.title}>
      <div class="flex items-center gap-2">
        <h3 data-slot="compy-eyebrow">{props.title}</h3>
        <Show when={state.files.length > 0}>
          <span data-slot="compy-count">{state.files.length}</span>
          <div class="flex-1" />
          <LineCounts additions={totals().add} deletions={totals().del} />
        </Show>
      </div>
      <Show
        when={state.files.length > 0}
        fallback={<p class="text-[12px] text-v2-text-text-muted">{language.t("compy.changes.empty")}</p>}
      >
        <ul data-scrollable role="tree" class="flex max-h-[168px] min-h-0 flex-col overflow-y-auto">
          <Nodes
            nodes={tree()}
            depth={0}
            closed={state.closed}
            toggle={(path) => setState("closed", path, !state.closed[path])}
          />
        </ul>
      </Show>
    </section>
  )
}

function Nodes(props: {
  nodes: ChangeNode[]
  depth: number
  closed: Record<string, boolean>
  toggle: (path: string) => void
}) {
  return (
    <For each={props.nodes}>
      {(node) => (
        <Show
          when={node.type === "folder" ? node : undefined}
          fallback={<FileRow node={node as Extract<ChangeNode, { type: "file" }>} depth={props.depth} />}
        >
          {(folder) => (
            <li role="treeitem" aria-expanded={!props.closed[folder().path]}>
              <button
                type="button"
                data-slot="compy-change-row"
                style={{ "--depth": props.depth }}
                onClick={() => props.toggle(folder().path)}
              >
                <Icon
                  name="chevron-down"
                  size="small"
                  data-slot="compy-change-chevron"
                  data-closed={props.closed[folder().path] || undefined}
                />
                <Icon name="folder" size="small" />
                <span class="min-w-0 flex-1 truncate text-start">{folder().name}</span>
                <LineCounts additions={folder().additions} deletions={folder().deletions} />
              </button>
              <Show when={!props.closed[folder().path]}>
                <ul role="group">
                  <Nodes nodes={folder().children} depth={props.depth + 1} closed={props.closed} toggle={props.toggle} />
                </ul>
              </Show>
            </li>
          )}
        </Show>
      )}
    </For>
  )
}

function FileRow(props: { node: Extract<ChangeNode, { type: "file" }>; depth: number }) {
  const language = useLanguage()

  return (
    <li role="treeitem" data-slot="compy-change-row" data-status={props.node.change.status} style={{ "--depth": props.depth }} title={props.node.path}>
      <span data-slot="compy-change-chevron" aria-hidden="true" />
      <Icon name="file-document" size="small" />
      <span class="min-w-0 flex-1 truncate">{props.node.name}</span>
      <Show when={props.node.change.status !== "modified"}>
        <span data-slot="compy-change-status">
          {language.t(props.node.change.status === "added" ? "compy.changes.added" : "compy.changes.deleted")}
        </span>
      </Show>
      <LineCounts additions={props.node.change.additions} deletions={props.node.change.deletions} />
    </li>
  )
}

function LineCounts(props: { additions: number; deletions: number }) {
  return (
    <span class="flex shrink-0 items-center gap-1.5 font-mono text-[11px] tabular-nums">
      <Show when={props.additions > 0}>
        <span class="text-v2-state-fg-success">+{props.additions}</span>
      </Show>
      <Show when={props.deletions > 0}>
        <span class="text-v2-state-fg-danger">-{props.deletions}</span>
      </Show>
    </span>
  )
}

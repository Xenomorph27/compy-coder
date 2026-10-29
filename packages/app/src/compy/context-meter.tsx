import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import type { ContextSegmentKey, ContextUsage } from "./usage"

const LABELS = {
  base: "compy.context.base",
  conversation: "compy.context.conversation",
  reply: "compy.context.reply",
  free: "compy.context.free",
} as const satisfies Record<ContextSegmentKey, string>

// One cell per 2.5% of the window, laid out in a single row like a horizontal Claude Code context grid.
const CELLS = 40

/**
 * How full an agent's context window is, after the Claude Code context panel but horizontal: a row of cells coloured by
 * what fills them, a legend with each part's tokens and share, and the session's running totals. Before the first
 * reply it already shows the whole window as free space, so the breakdown is never missing.
 */
export function ContextMeter(props: {
  usage?: ContextUsage
  limit: number
  tokens: number
  cost: number
  label?: string
  model?: string
}) {
  const language = useLanguage()

  const format = createMemo(() => ({
    tokens: new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
    percent: new Intl.NumberFormat(language.intl(), { style: "percent", maximumFractionDigits: 1 }),
    cost: new Intl.NumberFormat(language.intl(), { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  }))

  const usage = createMemo((): ContextUsage | undefined => {
    if (props.usage) return props.usage

    if (props.limit <= 0) return
    return {
      used: 0,
      limit: props.limit,
      segments: [
        { key: "base", tokens: 0 },
        { key: "conversation", tokens: 0 },
        { key: "reply", tokens: 0 },
        { key: "free", tokens: props.limit },
      ],
    }
  })

  // Each cell takes the part that fills the middle of its slice of the window.
  const cells = createMemo(() => {
    const value = usage()

    if (!value) return []
    const ends = value.segments.reduce<number[]>((sum, segment) => [...sum, (sum.at(-1) ?? 0) + segment.tokens], [])

    return Array.from({ length: CELLS }, (_, index) => {
      const at = ((index + 0.5) / CELLS) * value.limit
      const found = ends.findIndex((end) => at < end)

      return value.segments[found < 0 ? value.segments.length - 1 : found].key
    })
  })

  return (
    <section data-slot="compy-context" aria-label={language.t("compy.context.title")}>
      <div class="flex min-w-0 items-baseline gap-2">
        <h3 data-slot="compy-eyebrow">{language.t("compy.context.title")}</h3>
        <Show when={props.label}>
          <span class="text-[13px] font-medium leading-[var(--line-height-compact)] text-v2-text-text-base">
            {props.label}
          </span>
        </Show>
        <Show when={props.model}>
          <span class="min-w-0 truncate font-mono text-[12px] text-v2-text-text-muted">{props.model}</span>
        </Show>
        <Show
          when={usage()}
          fallback={<span class="ms-auto text-[12px] text-v2-text-text-muted">{language.t("compy.context.empty")}</span>}
        >
          {(value) => (
            <span class="ms-auto shrink-0 font-mono text-[12px] tabular-nums text-v2-text-text-muted">
              {language.t("compy.context.summary", {
                used: format().tokens.format(value().used),
                limit: format().tokens.format(value().limit),
                percent: format().percent.format(value().used / value().limit),
              })}
            </span>
          )}
        </Show>
      </div>
      <Show when={usage()}>
        {(value) => (
          <>
            <div data-slot="compy-context-cells" role="presentation">
              <For each={cells()}>{(key) => <span data-slot="compy-context-cell" data-key={key} />}</For>
            </div>
            <ul data-slot="compy-context-legend">
              <For each={value().segments}>
                {(segment) => (
                  <li>
                    <span data-slot="compy-context-swatch" data-key={segment.key} aria-hidden="true" />
                    <span class="truncate">{language.t(LABELS[segment.key])}</span>
                    <span class="font-mono tabular-nums text-v2-text-text-base">
                      {format().tokens.format(segment.tokens)}
                    </span>
                    <span class="font-mono tabular-nums">{format().percent.format(segment.tokens / value().limit)}</span>
                  </li>
                )}
              </For>
            </ul>
          </>
        )}
      </Show>
      <div class="flex items-center gap-2 text-[12px] leading-[var(--line-height-compact)] text-v2-text-text-muted">
        <span>{language.t("compy.context.session")}</span>
        <span class="ms-auto font-mono tabular-nums">
          {language.t("compy.usage.tokens", { tokens: format().tokens.format(props.tokens) })}
        </span>
        <span class="font-mono tabular-nums text-v2-text-text-base">{format().cost.format(props.cost)}</span>
      </div>
    </section>
  )
}

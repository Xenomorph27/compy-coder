import { createMemo, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import type { ContextSegmentKey, ContextUsage } from "./usage"

const LABELS = {
  base: "compy.context.base",
  conversation: "compy.context.conversation",
  reply: "compy.context.reply",
  free: "compy.context.free",
} as const satisfies Record<ContextSegmentKey, string>

/** A horizontal read-out of how full an agent's context window is, plus the session's running totals. */
export function ContextMeter(props: { usage?: ContextUsage; tokens: number; cost: number }) {
  const language = useLanguage()

  const format = createMemo(() => ({
    tokens: new Intl.NumberFormat(language.intl(), { notation: "compact", maximumFractionDigits: 1 }),
    percent: new Intl.NumberFormat(language.intl(), { style: "percent", maximumFractionDigits: 1 }),
    cost: new Intl.NumberFormat(language.intl(), { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  }))

  const share = (tokens: number) => (props.usage ? tokens / props.usage.limit : 0)

  return (
    <section data-slot="compy-context" aria-label={language.t("compy.context.title")}>
      <div class="flex items-baseline gap-2">
        <h3 data-slot="compy-eyebrow">{language.t("compy.context.title")}</h3>
        <Show
          when={props.usage}
          fallback={<span class="text-[12px] text-v2-text-text-muted">{language.t("compy.context.empty")}</span>}
        >
          {(usage) => (
            <>
              <span class="text-[13px] font-medium leading-[var(--line-height-compact)] text-v2-text-text-base">
                {language.t("compy.context.used", { percent: format().percent.format(usage().used / usage().limit) })}
              </span>
              <span class="ms-auto font-mono text-[12px] tabular-nums text-v2-text-text-muted">
                {language.t("compy.context.total", {
                  used: format().tokens.format(usage().used),
                  limit: format().tokens.format(usage().limit),
                })}
              </span>
            </>
          )}
        </Show>
      </div>
      <div data-slot="compy-context-bar" role="presentation">
        <For each={props.usage?.segments ?? []}>
          {(segment) => (
            <Show when={segment.tokens > 0}>
              <span
                data-slot="compy-context-segment"
                data-key={segment.key}
                style={{ "flex-grow": segment.tokens, "flex-basis": "0" }}
              />
            </Show>
          )}
        </For>
      </div>
      <Show when={props.usage}>
        {(usage) => (
          <ul data-slot="compy-context-legend">
            <For each={usage().segments}>
              {(segment) => (
                <li>
                  <span data-slot="compy-context-swatch" data-key={segment.key} aria-hidden="true" />
                  <span class="truncate">{language.t(LABELS[segment.key])}</span>
                  <span class="font-mono tabular-nums text-v2-text-text-base">
                    {format().tokens.format(segment.tokens)}
                  </span>
                  <span class="font-mono tabular-nums">{format().percent.format(share(segment.tokens))}</span>
                </li>
              )}
            </For>
          </ul>
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

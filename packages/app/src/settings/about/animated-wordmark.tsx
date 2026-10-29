import { createEffect, For, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { prefersReducedMotion } from "@opencode/ui/motion"

const target = ["c", "o", "m", "p", "y", "c", "o", "d", "e"] as const

const choices = ["c", "o", "m", "p", "y", "d", "e"] as const

// The wide "m" sets each slot's width; scrambled letters are centred in their slot.
const slots = target.reduce<{ x: number; w: number }[]>((acc, letter) => {
  const prev = acc.at(-1)
  return [...acc, { x: prev ? prev.x + prev.w + 6 : 0, w: letter === "m" ? 30 : 24 }]
}, [])

export function AnimatedWordmark(props: { active: boolean }) {
  const [state, setState] = createStore({ letters: [...target] })
  const timers = new Set<ReturnType<typeof setTimeout>>()

  createEffect(
    on(
      () => props.active,
      (active) => {
        timers.forEach(clearTimeout)
        timers.clear()

        if (!active || prefersReducedMotion()) {
          setState("letters", [...target])

          return
        }

        const starts = target.map(() => choices[Math.floor(Math.random() * choices.length)])
        const settles = target.map(() => 6 + Math.floor(Math.random() * 8))
        const last = Math.max(...settles)
        setState("letters", starts)

        Array.from({ length: last }, (_, index) => index + 1).forEach((tick) => {
          const timer = setTimeout(() => {
            setState(
              "letters",
              target.map((letter, index) =>
                tick >= settles[index] ? letter : choices[Math.floor(Math.random() * choices.length)],
              ),
            )
            timers.delete(timer)
          }, tick * 75)

          timers.add(timer)
        })
      },
    ),
  )

  onCleanup(() => timers.forEach(clearTimeout))

  return (
    <svg class="settings-about-wordmark" viewBox="0 0 270 42" aria-hidden="true">
      <defs>
        <symbol id="settings-about-letter-c" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M24 30H6V18H24V30Z" />
          <path d="M24 12H6V30H24V36H0V6H24V12Z" />
        </symbol>
        <symbol id="settings-about-letter-o" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M18 30H6V18H18V30Z" />
          <path d="M18 12H6V30H18V12ZM24 36H0V6H24V36Z" />
        </symbol>
        <symbol id="settings-about-letter-m" viewBox="0 0 30 42">
          <path class="settings-about-letter-shadow" d="M12 36H6V18H12V36ZM24 36H18V18H24V36Z" />
          <path d="M0 6H30V36H24V12H18V36H12V12H6V36H0V6Z" />
        </symbol>
        <symbol id="settings-about-letter-p" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M18 30H6V18H18V30Z" />
          <path d="M6 30H18V12H6V30ZM24 36H6V42H0V6H24V36Z" />
        </symbol>
        <symbol id="settings-about-letter-y" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M18 24H6V12H18V24Z" />
          <path d="M0 6H6V24H18V6H24V42H0V36H18V30H0V6Z" />
        </symbol>
        <symbol id="settings-about-letter-d" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M18 30H6V18H18V30Z" />
          <path d="M18 12H6V30H18V12ZM24 36H0V6H18V0H24V36Z" />
        </symbol>
        <symbol id="settings-about-letter-e" viewBox="0 0 24 42">
          <path class="settings-about-letter-shadow" d="M24 24V30H6V24H24Z" />
          <path d="M24 24H6V30H24V36H0V6H24V24ZM6 18H18V12H6V18Z" />
        </symbol>
      </defs>
      <For each={state.letters}>
        {(letter, index) => (
          <use
            href={`#settings-about-letter-${letter}`}
            x={slots[index()].x + (slots[index()].w - (letter === "m" ? 30 : 24)) / 2}
            width={letter === "m" ? 30 : 24}
            height="42"
          />
        )}
      </For>
    </svg>
  )
}

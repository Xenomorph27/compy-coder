import { Icon } from "@opencode/ui/icon"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { usePet } from "./pet-state"
import "./pet.css"

const LINES = ["compy.pet.say.1", "compy.pet.say.2", "compy.pet.say.3", "compy.pet.say.4", "compy.pet.say.5"] as const

// A press that moves less than this is a click, not a drag.
const DRAG_THRESHOLD = 4
const SIZE = 104

/**
 * Compy, the desktop cat. A shaded SVG model whose face layers shift against the head as it turns toward the
 * pointer, so it reads as a solid head rather than a flat drawing. Drag to move it, click to poke it.
 */
export function CompyPet() {
  const pet = usePet()
  const language = useLanguage()

  const [state, setState] = createStore({
    lookX: 0,
    lookY: 0,
    poked: 0,
    line: undefined as string | undefined,
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [dragging, setDragging] = createSignal(false)
  let root: HTMLDivElement | undefined
  let frame = 0
  let quiet: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const look = (event: PointerEvent) => {
      if (frame || !root) return
      frame = requestAnimationFrame(() => {
        frame = 0

        if (!root) return
        const box = root.getBoundingClientRect()
        // Full turn once the pointer is a few hundred pixels away; closer, the cat turns part way.
        const clamp = (value: number) => Math.max(-1, Math.min(1, value / 320))
        setState({
          lookX: clamp(event.clientX - (box.left + box.width / 2)),
          lookY: clamp(event.clientY - (box.top + box.height * 0.4)),
        })
      })
    }

    // Keeps the cat inside the window when it shrinks, without moving its saved spot.
    const resize = () => setState({ width: window.innerWidth, height: window.innerHeight })

    window.addEventListener("pointermove", look, { passive: true })
    window.addEventListener("resize", resize)
    onCleanup(() => {
      window.removeEventListener("pointermove", look)
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(frame)
      clearTimeout(quiet)
    })
  })

  const poke = () => {
    const line = LINES[Math.floor(Math.random() * LINES.length)]
    setState({ poked: state.poked + 1, line: language.t(line) })
    clearTimeout(quiet)
    quiet = setTimeout(() => setState("line", undefined), 2600)
  }

  const press = (event: PointerEvent) => {
    if (event.button !== 0) return
    const start = { x: event.clientX, y: event.clientY, right: pet.right(), bottom: pet.bottom() }
    const target = event.currentTarget as HTMLElement
    let moved = false

    target.setPointerCapture(event.pointerId)

    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x
      const dy = next.clientY - start.y

      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true
      setDragging(true)
      pet.move(
        Math.max(0, Math.min(state.width - SIZE, start.right - dx)),
        Math.max(0, Math.min(state.height - SIZE, start.bottom - dy)),
      )
    }

    // A lost capture (the window blurring mid-drag, say) ends the drag where it is, never as a poke.
    const release = (end: PointerEvent) => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", release)
      target.removeEventListener("pointercancel", release)
      target.removeEventListener("lostpointercapture", release)
      setDragging(false)

      if (!moved && end.type === "pointerup") poke()
    }

    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", release)
    target.addEventListener("pointercancel", release)
    target.addEventListener("lostpointercapture", release)
  }

  return (
    <Show when={pet.ready() && pet.visible()}>
      <div
        ref={root}
        data-component="compy-pet"
        data-dragging={dragging() || undefined}
        style={{
          right: `${Math.min(pet.right(), Math.max(0, state.width - SIZE))}px`,
          bottom: `${Math.min(pet.bottom(), Math.max(0, state.height - SIZE))}px`,
          "--look-x": state.lookX,
          "--look-y": state.lookY,
        }}
      >
        <Show when={state.line}>
          {(line) => (
            <p data-slot="compy-pet-bubble" role="status">
              {line()}
            </p>
          )}
        </Show>
        <button
          type="button"
          data-slot="compy-pet-hide"
          aria-label={language.t("compy.pet.hide")}
          title={language.t("compy.pet.hide")}
          onClick={() => pet.setVisible(false)}
        >
          <Icon name="close" size="small" />
        </button>
        <div
          data-slot="compy-pet-body"
          role="button"
          tabIndex={0}
          aria-label={language.t("compy.pet.label")}
          onPointerDown={press}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") poke()
          }}
        >
          {/* Keyed on the poke count, so each poke restarts the squish. */}
          <Show when={state.poked + 1} keyed>
            {(count) => <CatModel poked={count > 1} />}
          </Show>
        </div>
      </div>
    </Show>
  )
}

function CatModel(props: { poked: boolean }) {
  return (
    <svg viewBox="0 0 140 150" width={SIZE} height={SIZE} aria-hidden="true" data-poked={props.poked || undefined}>
      <defs>
        <radialGradient id="pet-fur" cx="38%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.55" stop-color="#f1eff3" />
          <stop offset="0.85" stop-color="#cfcbd6" />
          <stop offset="1" stop-color="#a9a4b3" />
        </radialGradient>
        <radialGradient id="pet-patch" cx="35%" cy="25%" r="80%">
          <stop offset="0" stop-color="#6d6873" />
          <stop offset="0.6" stop-color="#3f3b45" />
          <stop offset="1" stop-color="#25222a" />
        </radialGradient>
        <radialGradient id="pet-ear-inner" cx="50%" cy="70%" r="70%">
          <stop offset="0" stop-color="#f7b7c4" />
          <stop offset="1" stop-color="#c97d8f" />
        </radialGradient>
        <radialGradient id="pet-cheek" cx="45%" cy="35%" r="70%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.7" stop-color="#f3f1f5" />
          <stop offset="1" stop-color="#d8d4de" />
        </radialGradient>
        <radialGradient id="pet-eye" cx="40%" cy="35%" r="65%">
          <stop offset="0" stop-color="#2a2a30" />
          <stop offset="0.75" stop-color="#0b0b0e" />
          <stop offset="1" stop-color="#000000" />
        </radialGradient>
        <radialGradient id="pet-iris" cx="50%" cy="50%" r="50%">
          <stop offset="0.82" stop-color="#7d7440" />
          <stop offset="1" stop-color="#4b4524" />
        </radialGradient>
        <radialGradient id="pet-nose" cx="40%" cy="30%" r="80%">
          <stop offset="0" stop-color="#ffd0da" />
          <stop offset="0.6" stop-color="#f19aae" />
          <stop offset="1" stop-color="#cf6f86" />
        </radialGradient>
        <radialGradient id="pet-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#000" stop-opacity="0.55" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </radialGradient>
        <clipPath id="pet-head-clip">
          <ellipse cx="70" cy="62" rx="48" ry="41" />
        </clipPath>
      </defs>

      <ellipse cx="70" cy="143" rx="44" ry="6" fill="url(#pet-ground)" data-slot="pet-shadow" />

      <g data-slot="pet-tail">
        <path
          d="M98 128 C122 126 128 104 118 92 C114 87 108 90 112 96 C118 106 112 118 96 120 Z"
          fill="url(#pet-patch)"
        />
      </g>

      <g data-slot="pet-torso">
        <ellipse cx="70" cy="116" rx="35" ry="27" fill="url(#pet-fur)" />
        <ellipse cx="56" cy="138" rx="10" ry="6" fill="url(#pet-cheek)" />
        <ellipse cx="84" cy="138" rx="10" ry="6" fill="url(#pet-cheek)" />
        <path d="M53 135 v4 M57 135.5 v4 M83 135.5 v4 M87 135 v4" stroke="#bdb8c6" stroke-width="1" stroke-linecap="round" />
      </g>

      <g data-slot="pet-head">
        <g data-slot="pet-ears">
          <path d="M28 52 C24 30 28 14 36 8 C46 14 56 24 62 32 Z" fill="url(#pet-patch)" />
          <path d="M34 44 C32 30 35 20 38 16 C44 21 50 27 53 32 Z" fill="url(#pet-ear-inner)" />
          <path d="M112 52 C116 30 112 14 104 8 C94 14 84 24 78 32 Z" fill="url(#pet-patch)" />
          <path d="M106 44 C108 30 105 20 102 16 C96 21 90 27 87 32 Z" fill="url(#pet-ear-inner)" />
        </g>

        <ellipse cx="70" cy="62" rx="48" ry="41" fill="url(#pet-fur)" />
        {/* The dark cap over the forehead and the right ear, as on the original cat. */}
        <g clip-path="url(#pet-head-clip)">
          <path d="M18 50 C22 26 44 16 62 18 C60 30 52 38 40 42 C32 45 24 48 18 50 Z" fill="url(#pet-patch)" />
          <path d="M84 18 C100 18 116 28 122 46 C110 44 98 38 90 30 C87 26 85 22 84 18 Z" fill="url(#pet-patch)" />
          <ellipse cx="52" cy="34" rx="22" ry="10" fill="#fff" opacity="0.12" />
        </g>

        <g data-slot="pet-face">
          {/* Soft hollows that make the eyes look wide open. */}
          <ellipse cx="49" cy="58" rx="18" ry="17.5" fill="#d9d5df" opacity="0.55" />
          <ellipse cx="91" cy="58" rx="18" ry="17.5" fill="#d9d5df" opacity="0.55" />

          <g data-slot="pet-eye">
            <circle cx="49" cy="58" r="15" fill="url(#pet-iris)" />
            <g data-slot="pet-pupil">
              <circle cx="49" cy="58" r="13.4" fill="url(#pet-eye)" />
              <circle cx="44" cy="52.5" r="4.2" fill="#fff" />
              <circle cx="54.5" cy="63.5" r="1.6" fill="#fff" opacity="0.85" />
            </g>
          </g>
          <g data-slot="pet-eye">
            <circle cx="91" cy="58" r="15" fill="url(#pet-iris)" />
            <g data-slot="pet-pupil">
              <circle cx="91" cy="58" r="13.4" fill="url(#pet-eye)" />
              <circle cx="86" cy="52.5" r="4.2" fill="#fff" />
              <circle cx="96.5" cy="63.5" r="1.6" fill="#fff" opacity="0.85" />
            </g>
          </g>

          {/* Puffed cheeks pressing up into a tight, too-polite smile. */}
          <ellipse cx="57" cy="84" rx="17" ry="11.5" fill="url(#pet-cheek)" />
          <ellipse cx="83" cy="84" rx="17" ry="11.5" fill="url(#pet-cheek)" />
          <ellipse cx="70" cy="95" rx="12" ry="3.6" fill="#c9c4d1" opacity="0.75" />
          <g fill="#b9b3c2">
            <circle cx="55" cy="79" r="0.9" />
            <circle cx="59" cy="81.5" r="0.9" />
            <circle cx="51" cy="81.5" r="0.9" />
            <circle cx="85" cy="79" r="0.9" />
            <circle cx="81" cy="81.5" r="0.9" />
            <circle cx="89" cy="81.5" r="0.9" />
          </g>

          <path d="M64.5 75 C64.5 72.5 75.5 72.5 75.5 75 C75.5 78 72 80 70 80.5 C68 80 64.5 78 64.5 75 Z" fill="url(#pet-nose)" />
          <ellipse cx="67.5" cy="74.3" rx="2" ry="0.9" fill="#fff" opacity="0.7" />
          {/* One long pressed-lip line, corners pushed up into the cheeks: polite, and not at all relaxed. */}
          <path d="M70 80.5 V86.5" stroke="#a77380" stroke-width="1.4" stroke-linecap="round" />
          <path d="M45 84.5 C56 93.5 84 93.5 95 84.5 C84 90.5 56 90.5 45 84.5 Z" fill="#c48a97" />
          <path
            d="M45 84.5 C56 92 84 92 95 84.5"
            fill="none"
            stroke="#94606d"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </g>

        {/* Rim light along the upper left of the head. */}
        <path d="M30 40 C38 26 52 21 66 21" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.35" />
      </g>
    </svg>
  )
}

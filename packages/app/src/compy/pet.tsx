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
        <radialGradient id="pet-fur" cx="40%" cy="32%" r="72%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.6" stop-color="#f3f1f4" />
          <stop offset="0.86" stop-color="#d4d0d9" />
          <stop offset="1" stop-color="#aaa5b2" />
        </radialGradient>
        <radialGradient id="pet-patch" cx="38%" cy="22%" r="85%">
          <stop offset="0" stop-color="#5f5a63" />
          <stop offset="0.55" stop-color="#3a363d" />
          <stop offset="1" stop-color="#1f1c22" />
        </radialGradient>
        <radialGradient id="pet-ear-inner" cx="50%" cy="72%" r="72%">
          <stop offset="0" stop-color="#f6b3c0" />
          <stop offset="1" stop-color="#c47788" />
        </radialGradient>
        <radialGradient id="pet-ear-inner-dark" cx="50%" cy="72%" r="72%">
          <stop offset="0" stop-color="#b98d97" />
          <stop offset="1" stop-color="#6e5a60" />
        </radialGradient>
        <radialGradient id="pet-cheek" cx="45%" cy="32%" r="72%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.7" stop-color="#f4f2f6" />
          <stop offset="1" stop-color="#d3cfda" />
        </radialGradient>
        <radialGradient id="pet-eye" cx="42%" cy="36%" r="65%">
          <stop offset="0" stop-color="#2b2a2f" />
          <stop offset="0.72" stop-color="#0b0b0d" />
          <stop offset="1" stop-color="#000000" />
        </radialGradient>
        <radialGradient id="pet-iris" cx="50%" cy="50%" r="50%">
          <stop offset="0.8" stop-color="#a6a24f" />
          <stop offset="1" stop-color="#57532a" />
        </radialGradient>
        <radialGradient id="pet-nose" cx="40%" cy="30%" r="80%">
          <stop offset="0" stop-color="#ffd3dc" />
          <stop offset="0.6" stop-color="#ef9aad" />
          <stop offset="1" stop-color="#c96b82" />
        </radialGradient>
        <radialGradient id="pet-ground" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#000" stop-opacity="0.55" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </radialGradient>
        <clipPath id="pet-head-clip">
          <ellipse cx="70" cy="64" rx="54" ry="46" />
        </clipPath>
      </defs>

      <ellipse cx="70" cy="145" rx="42" ry="5" fill="url(#pet-ground)" data-slot="pet-shadow" />

      <g data-slot="pet-tail">
        <path d="M100 136 C124 134 130 112 121 99 C117 94 111 97 115 103 C120 112 114 125 98 128 Z" fill="url(#pet-patch)" />
      </g>

      <g data-slot="pet-torso">
        <ellipse cx="70" cy="124" rx="36" ry="24" fill="url(#pet-fur)" />
        <ellipse cx="56" cy="141" rx="10" ry="5.5" fill="url(#pet-cheek)" />
        <ellipse cx="84" cy="141" rx="10" ry="5.5" fill="url(#pet-cheek)" />
        <path d="M53 138.5 v3.5 M57 139 v3.5 M83 139 v3.5 M87 138.5 v3.5" stroke="#bdb8c6" stroke-width="1" stroke-linecap="round" />
      </g>

      <g data-slot="pet-head">
        <g data-slot="pet-ears">
          <path d="M22 50 C16 28 20 12 30 4 C42 10 54 20 62 28 Z" fill="url(#pet-patch)" />
          <path d="M29 42 C27 28 29 18 33 13 C40 18 47 24 51 29 Z" fill="url(#pet-ear-inner)" />
          <path d="M118 50 C124 28 120 12 110 4 C98 10 86 20 78 28 Z" fill="url(#pet-patch)" />
          <path d="M111 42 C113 28 111 18 107 13 C100 18 93 24 89 29 Z" fill="url(#pet-ear-inner-dark)" />
        </g>

        <ellipse cx="70" cy="64" rx="54" ry="46" fill="url(#pet-fur)" />
        {/* The dark cap over the left ear and forehead and the patch round the right ear, as on the photo's cat. */}
        <g clip-path="url(#pet-head-clip)">
          <path d="M14 70 C14 42 32 18 62 15 C76 14 80 22 73 31 C66 39 56 41 44 45 C33 49 22 57 14 70 Z" fill="url(#pet-patch)" />
          <path d="M84 17 C104 15 122 30 127 54 C116 47 105 41 97 35 C90 30 86 24 84 17 Z" fill="url(#pet-patch)" />
          <ellipse cx="80" cy="25" rx="8" ry="6" fill="#4a464e" opacity="0.35" />
          <ellipse cx="52" cy="33" rx="20" ry="8" fill="#fff" opacity="0.1" />
        </g>

        <g data-slot="pet-face">
          {/* Lids and hollows round the eyes, so they read as wide open and a little startled. */}
          <ellipse cx="48" cy="62" rx="19.5" ry="19" fill="#d8d2da" opacity="0.6" />
          <ellipse cx="92" cy="62" rx="19.5" ry="19" fill="#d8d2da" opacity="0.6" />

          <g data-slot="pet-eye">
            <circle cx="48" cy="62" r="16.5" fill="url(#pet-iris)" />
            <g data-slot="pet-pupil">
              <circle cx="48" cy="62" r="14.2" fill="url(#pet-eye)" />
              <circle cx="42.5" cy="55.5" r="4.6" fill="#fff" />
              <circle cx="54" cy="68.5" r="1.8" fill="#fff" opacity="0.85" />
            </g>
          </g>
          <g data-slot="pet-eye">
            <circle cx="92" cy="62" r="16.5" fill="url(#pet-iris)" />
            <g data-slot="pet-pupil">
              <circle cx="92" cy="62" r="14.2" fill="url(#pet-eye)" />
              <circle cx="86.5" cy="55.5" r="4.6" fill="#fff" />
              <circle cx="98" cy="68.5" r="1.8" fill="#fff" opacity="0.85" />
            </g>
          </g>

          {/* Puffed whisker pads pressing up into the long, too-polite smile. */}
          <ellipse cx="57" cy="91" rx="18" ry="12" fill="url(#pet-cheek)" />
          <ellipse cx="83" cy="91" rx="18" ry="12" fill="url(#pet-cheek)" />
          <ellipse cx="70" cy="104" rx="12" ry="4" fill="#cbc6d2" opacity="0.75" />
          <g fill="#b6b0bf">
            <circle cx="53" cy="86" r="0.9" />
            <circle cx="58" cy="88.5" r="0.9" />
            <circle cx="49" cy="89" r="0.9" />
            <circle cx="87" cy="86" r="0.9" />
            <circle cx="82" cy="88.5" r="0.9" />
            <circle cx="91" cy="89" r="0.9" />
          </g>
          <path
            d="M44 90 L12 85 M44 93 L11 95 M45 96 L14 104 M96 90 L128 85 M96 93 L129 95 M95 96 L126 104"
            stroke="#ece9f0"
            stroke-width="0.8"
            stroke-linecap="round"
            opacity="0.85"
          />

          <path d="M62.5 82 C62.5 78.5 77.5 78.5 77.5 82 C77.5 85.5 72.5 88 70 88.5 C67.5 88 62.5 85.5 62.5 82 Z" fill="url(#pet-nose)" />
          <ellipse cx="66.5" cy="80.8" rx="2.3" ry="1" fill="#fff" opacity="0.7" />
          <path d="M70 88.5 V95.5" stroke="#9b6873" stroke-width="1.3" stroke-linecap="round" />
          <path d="M43 94 C55 103.5 85 103.5 97 94 C85 99.5 55 99.5 43 94 Z" fill="#c48a97" />
          <path d="M43 94 C55 101.5 85 101.5 97 94" fill="none" stroke="#8c5763" stroke-width="1.5" stroke-linecap="round" />
        </g>

        {/* Rim light along the upper left of the head. */}
        <path d="M24 44 C32 28 46 20 60 18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.25" />
      </g>
    </svg>
  )
}

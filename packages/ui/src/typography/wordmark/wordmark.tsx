import { createUniqueId, type ComponentProps } from "solid-js"

/** The product name, set in the UI font. Fixed to its box with `textLength`, so it scales like the old drawn mark. */
const NAME = "Compy Code"

export function Wordmark(
  props: Pick<ComponentProps<"svg">, "class"> & { fade?: boolean; muted?: boolean; outline?: boolean },
) {
  const mask = createUniqueId()
  const maskGradient = createUniqueId()
  const aurora = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 129"
      fill="none"
      classList={{
        [props.class ?? ""]: !!props.class,
        "overflow-visible [&_text]:[vector-effect:non-scaling-stroke]": props.outline,
      }}
    >
      <g opacity={props.muted === false ? 1 : 0.6} class="[[data-color-scheme=dark]_&]:opacity-100">
        <g mask={props.fade === false ? undefined : `url(#${mask})`}>
          <text
            x="0"
            y="104"
            textLength="720"
            lengthAdjust="spacingAndGlyphs"
            font-size="124"
            font-weight="600"
            letter-spacing="-4"
            style={{ "font-family": "var(--font-family-sans)" }}
            opacity={props.muted === false ? 1 : 0.16 * 0.7}
            fill={props.outline ? "none" : props.muted === false ? `url(#${aurora})` : "currentColor"}
            stroke={props.outline ? "currentColor" : undefined}
            stroke-width={props.outline ? 1 : undefined}
          >
            {NAME}
          </text>
        </g>
      </g>
      <defs>
        <linearGradient id={aurora} x1="0" y1="0" x2="720" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0.3" stop-color="currentColor" />
          <stop offset="0.6" stop-color="#2ee6c5" />
          <stop offset="0.8" stop-color="#38bdf8" />
          <stop offset="1" stop-color="#a78bfa" />
        </linearGradient>
        <mask id={mask} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="129">
          <rect width="720" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="68" x2="360" y2="129" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

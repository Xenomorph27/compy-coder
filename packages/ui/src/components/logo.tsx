import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 270 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        <path d="M24 30H6V18H24V30Z" fill="var(--icon-weak-base)" />
        <path d="M24 12H6V30H24V36H0V6H24V12Z" fill="var(--icon-base)" />
        <path d="M48 30H36V18H48V30Z" fill="var(--icon-weak-base)" />
        <path d="M48 12H36V30H48V12ZM54 36H30V6H54V36Z" fill="var(--icon-base)" />
        <path d="M72 36H66V18H72V36ZM84 36H78V18H84V36Z" fill="var(--icon-weak-base)" />
        <path d="M60 6H90V36H84V12H78V36H72V12H66V36H60V6Z" fill="var(--icon-base)" />
        <path d="M114 30H102V18H114V30Z" fill="var(--icon-weak-base)" />
        <path d="M102 30H114V12H102V30ZM120 36H102V42H96V6H120V36Z" fill="var(--icon-base)" />
        <path d="M144 24H132V12H144V24Z" fill="var(--icon-weak-base)" />
        <path d="M126 6H132V24H144V6H150V42H126V36H144V30H126V6Z" fill="var(--icon-base)" />
        <path d="M180 30H162V18H180V30Z" fill="var(--icon-weak-base)" />
        <path d="M180 12H162V30H180V36H156V6H180V12Z" fill="var(--icon-strong-base)" />
        <path d="M204 30H192V18H204V30Z" fill="var(--icon-weak-base)" />
        <path d="M204 12H192V30H204V12ZM210 36H186V6H210V36Z" fill="var(--icon-strong-base)" />
        <path d="M234 30H222V18H234V30Z" fill="var(--icon-weak-base)" />
        <path d="M234 12H222V30H234V12ZM240 36H216V6H234V0H240V36Z" fill="var(--icon-strong-base)" />
        <path d="M270 24V30H252V24H270Z" fill="var(--icon-weak-base)" />
        <path d="M270 24H252V30H270V36H246V6H270V24ZM252 18H264V12H252V18Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}

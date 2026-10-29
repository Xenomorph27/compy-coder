import { useLanguage } from "@/runtime/i18n/language"
import "./hero.css"

/** The Compy Code title: large type with the aurora running through it and a glow behind. */
export function CompyHero(props: { tagline?: "build" | "arena" }) {
  const language = useLanguage()

  return (
    <div data-component="compy-hero">
      <h1 data-slot="compy-hero-title">{language.t("compy.hero.title")}</h1>
      <p data-slot="compy-hero-tagline">
        {language.t(props.tagline === "arena" ? "compy.hero.arena" : "compy.hero.build")}
      </p>
    </div>
  )
}

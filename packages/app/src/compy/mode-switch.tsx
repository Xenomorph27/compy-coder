import { SegmentedControl, SegmentedControlItem } from "@opencode/ui/segmented-control"
import { useLanguage } from "@/runtime/i18n/language"
import { useCompy } from "./state"

/** Titlebar switch between the normal IDE and the Compy arena. */
export function CompyModeSwitch() {
  const compy = useCompy()
  const language = useLanguage()

  return (
    <SegmentedControl
      aria-label={language.t("compy.mode.label")}
      value={compy.active() ? "compy" : "normal"}
      onChange={(value) => (value === "compy" ? compy.enter() : compy.leave())}
      class="[app-region:no-drag]"
      style={{ width: "152px", height: "26px" }}
    >
      <SegmentedControlItem value="normal">{language.t("compy.mode.normal")}</SegmentedControlItem>
      <SegmentedControlItem value="compy">{language.t("compy.mode.compy")}</SegmentedControlItem>
    </SegmentedControl>
  )
}

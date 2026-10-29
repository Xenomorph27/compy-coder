import { SegmentedControl, SegmentedControlItem } from "@opencode/ui/segmented-control"
import { useLanguage } from "@/runtime/i18n/language"
import { useCompy } from "./state"

/** Titlebar switch between the normal IDE, the Compy arena where two agents compete, and Collab where they pair. */
export function CompyModeSwitch() {
  const compy = useCompy()
  const language = useLanguage()

  return (
    <SegmentedControl
      aria-label={language.t("compy.mode.label")}
      value={compy.kind() === "collab" ? "collab" : compy.kind() === "compete" ? "compy" : "normal"}
      onChange={(value) => {
        if (value === "compy") return compy.enter("compete")
        if (value === "collab") return compy.enter("collab")
        compy.leave()
      }}
      class="[app-region:no-drag]"
      style={{ width: "222px", height: "26px" }}
    >
      <SegmentedControlItem value="normal">{language.t("compy.mode.normal")}</SegmentedControlItem>
      <SegmentedControlItem value="compy">{language.t("compy.mode.compy")}</SegmentedControlItem>
      <SegmentedControlItem value="collab">{language.t("compy.mode.collab")}</SegmentedControlItem>
    </SegmentedControl>
  )
}

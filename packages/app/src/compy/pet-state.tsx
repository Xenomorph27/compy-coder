import { createSimpleContext } from "@opencode/ui/context"
import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { Persist, persisted } from "@/runtime/persistence/storage"

const Store = Persistence.struct({
  visible: Persistence.fallback(Schema.Boolean, () => true),
  /** Distance from the window's right and bottom edges, so the cat keeps its corner when the window resizes. */
  right: Persistence.fallback(Schema.Number, () => 20),
  bottom: Persistence.fallback(Schema.Number, () => 20),
})

/** Where the desktop cat sits and whether it is shown; Settings → Appearance toggles it. */
export const { use: usePet, provider: PetProvider } = createSimpleContext({
  name: "Pet",
  gate: false,
  init: () => {
    const [store, setStore, , ready] = persisted(Persist.global("compy.pet"), Store, {
      visible: true,
      right: 20,
      bottom: 20,
    })

    return {
      ready,
      visible: () => store.visible,
      right: () => store.right,
      bottom: () => store.bottom,
      setVisible(visible: boolean) {
        setStore("visible", visible)
      },
      move(right: number, bottom: number) {
        setStore({ right, bottom })
      },
    }
  },
})

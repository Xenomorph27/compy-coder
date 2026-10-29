import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "Compy Code Dev",
  beta: "Compy Code Beta",
  prod: "Compy Code",
}

const appIDs: Record<string, string> = {
  dev: "dev.compycode.desktop.dev",
  beta: "dev.compycode.desktop.beta",
  prod: "dev.compycode.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Compy Code Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "dev.compycode.desktop.dev"

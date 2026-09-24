import { createContext, useContext } from "react"
import type { ReactNode } from "react"

import { useGetSettings } from "../api/generated/default/default"
import type { SettingsResponseBody } from "../api/generated/model"

const SettingsContext = createContext<SettingsResponseBody | null | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const query = useGetSettings({
    query: { staleTime: Infinity },
  })
  return <SettingsContext.Provider value={query.data ?? null}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (ctx === undefined) {
    throw new Error("useSettings must be used within SettingsProvider")
  }
  return ctx
}

import { useQuery } from "@tanstack/react-query"
import { createContext, useContext } from "react"
import type { ReactNode } from "react"

import { getSettings } from "#/lib/api"
import type { Settings } from "#/lib/api"

const SettingsContext = createContext<Settings | null | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: Infinity,
  })
  return <SettingsContext.Provider value={query.data ?? null}>{children}</SettingsContext.Provider>
}

export function useSettings(): Settings | null {
  const ctx = useContext(SettingsContext)
  if (ctx === undefined) {
    throw new Error("useSettings must be used within SettingsProvider")
  }
  return ctx
}

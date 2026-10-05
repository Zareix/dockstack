import { useQueryClient } from "@tanstack/react-query"
import { createContext, useContext } from "react"
import type { ReactNode } from "react"

import {
  getGetAuthSessionQueryKey,
  postAuthSignOut,
  useGetAuthSession,
  type GetAuthSessionQueryResult,
} from "../api/generated/default/default"

type SessionValue = {
  session: GetAuthSessionQueryResult | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const authSessionQuery = useGetAuthSession({
    query: { retry: false, staleTime: 60_000 },
  })

  const logout = async () => {
    try {
      await postAuthSignOut()
    } finally {
      queryClient.setQueryData(getGetAuthSessionQueryKey(), null)
      queryClient.clear()
    }
  }

  const value: SessionValue = {
    session: authSessionQuery.data ?? null,
    isLoading: authSessionQuery.isLoading,
    isAuthenticated: authSessionQuery.isSuccess,
    logout,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider")
  }
  return ctx
}

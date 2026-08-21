import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, useContext } from "react"
import type { ReactNode } from "react"

import { getSession, signOut } from "#/lib/api"
import type { AuthSession } from "#/lib/api"

type SessionValue = {
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  })

  const logout = async () => {
    try {
      await signOut()
    } finally {
      queryClient.setQueryData(["session"], null)
      queryClient.clear()
    }
  }

  const value: SessionValue = {
    session: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: query.isSuccess,
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

import { get, post, patch, del } from "./client"

export type User = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  username: string
  avatar: string
  role: string
  createdAt: number
}

export type Session = {
  id: string
  expiresAt: number
  userAgent: string
  ipAddress: string
  createdAt: number
  isCurrent: boolean
}

export type AuthSession = {
  session: Session
  user: User
}

export type APIKey = {
  id: string
  name: string
  createdAt: number
  expiresAt: number | null
  enabled: boolean
}

export type Passkey = {
  id: string
  userId: string
  name: string
  credentialId: string
  createdAt: number
}

export const getSession = () => get<AuthSession>("/api/auth/session")

export const signInEmail = (email: string, password: string) =>
  post<{ user: User }>("/api/auth/sign-in/email", { email, password })

export const signInUsername = (username: string, password: string) =>
  post<{ user: User }>("/api/auth/sign-in/username", { username, password })

export const signOut = () => post("/api/auth/sign-out")

export const isUsernameAvailable = (username: string) =>
  post<{ available: boolean }>("/api/auth/is-username-available", { username })

export const listSessions = () => get<Session[]>("/api/auth/sessions")

export const revokeSession = (id: string) => post(`/api/auth/sessions/${id}/revoke`)

export const revokeOtherSessions = () => post("/api/auth/sessions/revoke-others")

export const changePassword = (currentPassword: string, newPassword: string) =>
  post("/api/auth/change-password", { currentPassword, newPassword })

export const changeEmail = (email: string) => post("/api/auth/change-email", { email })

export const updateUser = (data: { name: string; avatar: string }) =>
  patch<{ user: User }>("/api/auth/user", data)

export const forgotPassword = (email: string) => post("/api/auth/forgot-password", { email })

export const resetPassword = (token: string, newPassword: string) =>
  post("/api/auth/reset-password", { token, newPassword })

// API keys

export const listApiKeys = () => get<APIKey[]>("/api/auth/api-keys")

export const createApiKey = (name: string) =>
  post<{ key: string; apiKey: APIKey }>("/api/auth/api-keys", { name })

export const deleteApiKey = (id: string) => del(`/api/auth/api-keys/${id}`)

// Passkeys

export const listPasskeys = () => get<Passkey[]>("/api/auth/passkeys")

export const deletePasskey = (id: string) => del(`/api/auth/passkeys/${id}`)

export const passkeyRegisterBegin = () =>
  post<{ options: unknown; challengeId: string }>("/api/auth/passkey/register/begin")

export const passkeyRegisterFinish = (credential: unknown) =>
  post<{ passkey: Passkey }>("/api/auth/passkey/register/finish", { credential })

export const passkeyAuthBegin = () =>
  post<{ options: unknown; challengeId: string }>("/api/auth/passkey/auth/begin")

export const passkeyAuthFinish = (credential: unknown) =>
  post<{ user: User }>("/api/auth/passkey/auth/finish", { credential })

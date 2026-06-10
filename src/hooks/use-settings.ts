import { useRouteContext } from "@tanstack/react-router"

export const useSettings = () => {
  const settingsQuery = useRouteContext({ from: "__root__" })
  return settingsQuery.appSettings
}

import { useTheme } from "next-themes"
import { useEffect } from "react"

function setIconHref(type: string, href: string) {
  document
    .querySelector<HTMLLinkElement>(`link[rel="icon"][type="${type}"]`)
    ?.setAttribute("href", href)
}

export function useFaviconTheme() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const dark = resolvedTheme === "dark"
    setIconHref("image/svg+xml", dark ? "/favicon-dark.svg" : "/favicon-light.svg")
    setIconHref("image/x-icon", dark ? "/favicon-dark.ico" : "/favicon.ico")
  }, [resolvedTheme])
}

export function FaviconTheme() {
  useFaviconTheme()
  return null
}

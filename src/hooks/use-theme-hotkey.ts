import { useTheme } from "next-themes"
import { useEffect } from "react"
import { toast } from "sonner"

const THEME_CYCLE = ["system", "light", "dark"] as const

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function useThemeHotkey() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "d") return
      if (isEditableTarget(event.target)) return

      const isPlainD = !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
      const isCmdOrCtrlShiftD = (event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey

      if (!isPlainD && !isCmdOrCtrlShiftD) return

      event.preventDefault()

      const currentIndex = THEME_CYCLE.indexOf(theme as (typeof THEME_CYCLE)[number])
      const next = THEME_CYCLE[(currentIndex + 1 + THEME_CYCLE.length) % THEME_CYCLE.length]

      setTheme(next)

      requestAnimationFrame(() => {
        toast.info(`Switched theme to: ${next.charAt(0).toUpperCase()}${next.slice(1)}`)
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [theme, setTheme])
}

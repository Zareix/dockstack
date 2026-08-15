import { uiTranslations } from "fumadocs-ui/i18n"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

import { i18n } from "@/lib/i18n"

import { appName, gitConfig } from "./shared"

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: {
      displayName: "English",
    },
    fr: {
      displayName: "Français",
      "On this page(table of contents)": "Sur cette page",
      "Copy Markdown(page actions)": "Copier le Markdown",
      "Choose a language(language switcher)": "Choisir une langue",
      "Search(search dialog)": "Rechercher",
      "Search(search trigger)": "Rechercher",
      "Open(page actions)": "Ouvrir",
    },
  })

export function baseOptions(lang: string): BaseLayoutProps {
  return {
    nav: {
      title: appName,
      url: `/${lang}`,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}

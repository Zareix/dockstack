import { docs } from "collections/server"
import { loader } from "fumadocs-core/source"
import * as icons from "@phosphor-icons/react/ssr"

import { docsContentRoute, docsImageRoute, docsRoute } from "./shared"
import { createElement } from "react";

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      return;
    }
    if (icon in icons) return createElement(icons[icon as keyof typeof icons], { weight: "duotone", weights: new Map() });
  },
})

export function getPageImageUrl(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "image.png"]

  return {
    segments,
    url: "https://zareix.github.io/" + [page.locale, ...docsImageRoute.split("/"), ...segments].filter(Boolean).join("/"),
  }
}

export function getPageMarkdownUrl(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "content.md"]

  return {
    segments,
    url: "/" + [page.locale, ...docsContentRoute.split("/"), ...segments].filter(Boolean).join("/"),
  }
}

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed")

  return `# ${page.data.title} (${page.url})

${processed}`
}

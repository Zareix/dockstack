import * as icons from "@phosphor-icons/react/ssr"
import { docs } from "collections/server"
import { loader } from "fumadocs-core/source"
import { createElement } from "react"

import { i18n } from "./i18n"
import { openapi } from "./openapi"
import { docsContentRoute, docsImageRoute, docsRoute } from "./shared"

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: "openapi/(generated)",
    }),
  },
  {
    i18n,
    baseUrl: docsRoute,
    icon(icon) {
      if (!icon) {
        return
      }
      if (icon in icons)
        return createElement(icons[icon as keyof typeof icons], {
          weight: "duotone",
          weights: new Map(),
        })
    },
    plugins: [openapi.loaderPlugin()],
  },
)

export function getPageImageUrl(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "image.png"]

  return {
    segments,
    url:
      "https://zareix.github.io/" +
      [page.locale, ...docsImageRoute.split("/"), ...segments].filter(Boolean).join("/"),
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
  if (page.type === "openapi") {
    return JSON.stringify(page.data.getSchema().bundled, null, 2)
  }

  const processed = await page.data.getText("processed")

  return `# ${page.data.title} (${page.url})

${processed}`
}

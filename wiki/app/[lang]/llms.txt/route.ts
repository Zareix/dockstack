import { llms } from "fumadocs-core/source"

import { i18n } from "@/lib/i18n"
import { source } from "@/lib/source"

export const revalidate = false

export function GET() {
  return new Response(llms(source).index())
}

export const generateStaticParams = async () => {
  return i18n.languages.map((lang) => ({ lang }))
}

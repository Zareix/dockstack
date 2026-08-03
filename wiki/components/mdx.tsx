import { File, Files, Folder } from "fumadocs-ui/components/files"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

import { EnvVar } from "@/components/env-var"

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    File,
    Files,
    Folder,
    EnvVar,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}

import { i18nProvider } from "fumadocs-ui/i18n"
import { RootProvider } from "fumadocs-ui/provider/next"

import "../global.css"
import { Inter } from "next/font/google"

import { translations } from "@/lib/layout.shared"

const inter = Inter({
  subsets: ["latin"],
})

export default async function Layout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          i18n={i18nProvider(
            // @ts-ignore Typing wrong
            translations,
            lang,
          )}
          search={{ options: { type: "static", api: "/dockstack/api/search" } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  )
}

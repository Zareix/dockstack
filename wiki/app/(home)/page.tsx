import { Card, Cards } from "fumadocs-ui/components/card"
import { HardDrivesIcon, KeyIcon, LightningIcon, PackageIcon, PencilSimpleIcon, WebhooksLogoIcon } from "@phosphor-icons/react/ssr"
import Link from "next/link"

export const metadata = {
  title: "Dockstack Docs",
}

const features = [
  {
    icon: PackageIcon,
    title: "Docker Compose first",
    description: "Stacks are plain directories with a compose.yaml, managed on disk",
  },
  {
    icon: HardDrivesIcon,
    title: "Stateless and local-first",
    description: "SQLite is used only for auth; stack state lives in Docker and your filesystem",
  },
  {
    icon: LightningIcon,
    title: "Non-intrusive",
    description: "Calls the Docker socket or plain docker compose commands, no lock-in",
  },
  {
    icon: PencilSimpleIcon,
    title: "Built-in editor",
    description: "Edit compose files directly in the UI with YAML validation",
  },
  {
    icon: WebhooksLogoIcon,
    title: "Webhook redeploy",
    description: "Trigger a pull and restart of all running stacks from CI or a Git hook",
  },
  {
    icon: KeyIcon,
    title: "OIDC / passkeys",
    description: "Sign in with any OpenID Connect provider, or a passkey",
  },
]

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <div className="container mx-auto max-w-5xl space-y-8 px-4 py-16">
        <div className="space-y-4 text-center">
          <h1 className="font-bold text-4xl md:text-5xl">Dockstack</h1>
          <p className="mx-auto max-w-2xl text-fd-muted-foreground text-lg">
            Self-hosted Docker Compose stack management UI. Browse, start, stop, restart, and
            redeploy your stacks — no database, no complex config.
          </p>
        </div>

        <Cards className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              icon={<feature.icon className="text-fd-primary" weight="duotone" />}
              title={<span className="text-fd-foreground">{feature.title}</span>}
              description={feature.description}
              className="border-fd-border bg-fd-card transition-all duration-300 hover:border-fd-primary/50 hover:bg-fd-accent"
            />
          ))}
        </Cards>

        <div className="flex justify-center">
          <Link
            href="/docs"
            className="cursor-pointer rounded-full bg-fd-accent px-6 py-3 font-medium text-fd-accent-foreground transition-colors hover:bg-fd-accent/90"
          >
            Explore Documentation
          </Link>
        </div>
      </div>
    </div>
  )
}

"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { useSignedIn } from "@/components/marketing/use-signed-in";
import { Reveal } from "@/components/marketing/reveal";
import {
  INTEGRATIONS_CHIPS,
  INTEGRATIONS_HEADLINE,
  INTEGRATIONS_HUB,
  INTEGRATIONS_NODES,
  INTEGRATIONS_PROMPT_PLACEHOLDER,
  INTEGRATIONS_SECTION_ID,
  INTEGRATIONS_SUBCOPY,
  showcaseChipHref,
  type ShowcaseNode,
} from "@/lib/integrations-showcase";
import { cn } from "@/lib/utils";

function GmailMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#ea4335" />
      <path
        d="M7 11.2 16 17l9-5.8V22H7V11.2Z"
        fill="#fff"
        opacity="0.95"
      />
      <path d="M7 11.2 16 17l9-5.8L16 8.4 7 11.2Z" fill="#f8d7d3" />
    </svg>
  );
}

function SlackMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#4a154b" />
      <rect x="14" y="7" width="4.2" height="10" rx="2.1" fill="#ecb22e" />
      <rect x="15" y="15" width="10" height="4.2" rx="2.1" fill="#36c5f0" />
      <rect x="7" y="13" width="10" height="4.2" rx="2.1" fill="#2eb67d" />
      <rect x="13.8" y="15" width="4.2" height="10" rx="2.1" fill="#e01e5a" />
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0a66c2" />
      <text
        x="16"
        y="22"
        textAnchor="middle"
        fill="#fff"
        fontSize="13"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        in
      </text>
    </svg>
  );
}

function BrowserMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#3f6b58" />
      <circle cx="16" cy="16" r="7.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <ellipse cx="16" cy="16" rx="3.2" ry="7.2" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M9.2 16h13.6M16 9.2v13.6" stroke="#fff" strokeWidth="1.3" />
    </svg>
  );
}

function ApiMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1a1915" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="#f4f3ef"
        fontSize="11"
        fontWeight="650"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {"{ }"}
      </text>
    </svg>
  );
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#15803d" />
      <path
        d="M16 8.6a7.4 7.4 0 0 0-6.4 11.1L8.4 23.4l3.9-1.1A7.4 7.4 0 1 0 16 8.6Z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
      />
      <path
        d="M13.1 13.4c.3-.7.5-.7.8-.7h.6c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.2.6l-.5.4c-.2.1-.2.4 0 .6.4.5 1.2 1.2 1.8 1.5.3.2.6.1.7-.1l.5-.6c.2-.2.5-.2.7-.1l1.6.7c.3.1.4.3.4.5v.6c0 .3-.1.6-.7.8-.7.3-2 .4-3.9-1.2-1.6-1.4-2.2-3.1-2.3-3.6-.1-.4 0-.8.3-1.1Z"
        fill="#fff"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#24292f" />
      <circle cx="11" cy="14" r="2.1" fill="#fff" />
      <circle cx="21" cy="12.5" r="2.1" fill="#fff" />
      <circle cx="18.5" cy="20.5" r="2.1" fill="#fff" />
      <path
        d="M12.8 14.6c1.8.2 3.6-.4 5.6-2M20.2 14.4c-.2 2.1-.8 4.2-1.4 5.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function nodeMark(id: string) {
  switch (id) {
    case "gmail":
      return <GmailMark />;
    case "slack":
      return <SlackMark />;
    case "linkedin":
      return <LinkedInMark />;
    case "browser":
      return <BrowserMark />;
    case "api":
      return <ApiMark />;
    case "whatsapp":
      return <WhatsAppMark />;
    case "github":
      return <GitHubMark />;
    default:
      return null;
  }
}

function CloudLines() {
  const hub = { x: 50, y: 50 };
  return (
    <svg
      className="integrations-cloud-lines"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {INTEGRATIONS_NODES.map((node) => (
        <line
          key={node.id}
          x1={hub.x}
          y1={hub.y}
          x2={node.x}
          y2={node.y}
          className="integrations-cloud-line"
        />
      ))}
    </svg>
  );
}

function NodeTile({ node, index }: { node: ShowcaseNode; index: number }) {
  return (
    <div
      className="integrations-node"
      style={
        {
          "--node-x": `${node.x}%`,
          "--node-y": `${node.y}%`,
          "--node-delay": `${index * 0.18}s`,
        } as CSSProperties
      }
    >
      <div className="integrations-tile" title={node.honest}>
        {nodeMark(node.id)}
        <div className="min-w-0">
          <p className="text-[13px] font-medium tracking-tight">{node.name}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">{node.caption}</p>
        </div>
      </div>
      <p className="integrations-honest">{node.honest}</p>
    </div>
  );
}

export function IntegrationsShowcase() {
  const signedIn = useSignedIn();
  const startHref = signedIn ? "/desk" : "/signup?from=integrations&chip=marketplace";

  return (
    <section
      id={INTEGRATIONS_SECTION_ID}
      className="scroll-mt-20 border-t border-border"
    >
      <Reveal>
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm text-muted-foreground">Connectors</p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight md:text-4xl">
              {INTEGRATIONS_HEADLINE}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {INTEGRATIONS_SUBCOPY}
            </p>
          </div>

          <div className="integrations-stage mt-12">
            <div className="integrations-cloud">
              <CloudLines />
              <div className="integrations-hub">
                <span className="integrations-hub-mark" aria-hidden>
                  CP
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-medium tracking-tight">
                    {INTEGRATIONS_HUB.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {INTEGRATIONS_HUB.caption} · Brand Kit at the center
                  </span>
                </span>
              </div>
              {INTEGRATIONS_NODES.map((node, index) => (
                <NodeTile key={node.id} node={node} index={index} />
              ))}
            </div>

            <div className="integrations-prompt">
              <div className="integrations-prompt-bar">
                <p className="integrations-prompt-copy">{INTEGRATIONS_PROMPT_PLACEHOLDER}</p>
                <Link
                  href={startHref}
                  className="integrations-prompt-send"
                  aria-label={signedIn ? "Open desk" : "Get started with this prompt"}
                >
                  <ArrowUp className="size-4" />
                </Link>
              </div>
              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                Sample jobs — they open signup or the desk. This page does not
                run live connectors.
              </p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {INTEGRATIONS_CHIPS.map((chip) => (
                  <li key={chip.id}>
                    <Link
                      href={showcaseChipHref(chip, signedIn)}
                      title={chip.prompt}
                      className={cn(
                        "integrations-chip",
                        chip.hrefKind === "developers" && "integrations-chip-api",
                      )}
                    >
                      {chip.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

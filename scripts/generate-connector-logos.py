#!/usr/bin/env python3
"""Write public/connectors/*.svg — Simple Icons (CC0) plus official-style tiles."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "connectors"
SI = ROOT / "scripts" / "vendor" / "simple-icons"


def si_path(slug: str) -> str:
    text = (SI / f"{slug}.svg").read_text()
    match = re.search(r'<path d="([^"]+)"', text)
    if not match:
        raise SystemExit(f"no path in {slug}")
    return match.group(1)


def si_paths(slug: str) -> list[str]:
    d = si_path(slug)
    return re.findall(r"M[^M]+", d)


def tile(inner: str, bg: str, border: bool = False) -> str:
    border_el = (
        '<rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="rgba(15,15,15,0.12)"/>'
        if border
        else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="7" fill="{bg}"/>
  {border_el}
  {inner}
</svg>
'''


def glyph(d: str, fill: str, pad: float = 5.0) -> str:
    scale = (32 - pad * 2) / 24
    return f'<g transform="translate({pad},{pad}) scale({scale:.6f})"><path fill="{fill}" d="{d}"/></g>'


def write(name: str, svg: str) -> None:
    path = OUT / f"{name}.svg"
    path.write_text(svg.strip() + "\n")
    print("wrote", path.relative_to(ROOT), "bytes", path.stat().st_size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Gmail — Simple Icons M, white on brand red (readable on dark UI)
    write(
        "gmail",
        tile(glyph(si_path("gmail"), "#fff", 4.6), "#EA4335"),
    )

    # Google Calendar — blue calendar with 31
    write(
        "google-calendar",
        tile(
            """
  <rect x="5.5" y="6.2" width="21" height="19.2" rx="3.2" fill="#fff" stroke="#1A73E8" stroke-width="1.7"/>
  <path fill="#1A73E8" d="M5.5 9.6h21V9.4c0-1.8-1.4-3.2-3.2-3.2H8.7C6.9 6.2 5.5 7.6 5.5 9.4z"/>
  <rect x="9.4" y="4.2" width="2.1" height="4.4" rx="1" fill="#1A73E8"/>
  <rect x="20.5" y="4.2" width="2.1" height="4.4" rx="1" fill="#1A73E8"/>
  <path fill="#1A73E8" d="M12.2 13.1c.55 0 .98.16 1.28.47.3.31.45.73.45 1.24 0 .5-.16.91-.47 1.22-.31.31-.73.47-1.26.47-.5 0-.9-.15-1.2-.44-.3-.3-.5-.7-.58-1.2l1.05.22c.05.28.15.5.3.64.14.13.32.2.54.2.22 0 .4-.07.52-.2.13-.14.2-.33.2-.57 0-.25-.07-.44-.2-.57-.13-.13-.31-.2-.54-.2h-.5v-1.02h.41zm3.55-.2 2.05 3.05h.02V13h1.15v6.4h-1.15v-2.55h-.02l-2.18 2.55h-1.22l2.42-2.82-2.22-3.18h1.15z"/>
  <circle cx="24.2" cy="24.4" r="2.1" fill="#EA4335"/>
  <circle cx="7.8" cy="24.4" r="2.1" fill="#34A853"/>
  <circle cx="24.2" cy="7.6" r="2.1" fill="#FBBC04"/>
            """,
            "#fff",
            border=True,
        ),
    )

    write(
        "google-drive",
        tile(
            """
  <path fill="#4285F4" d="M8.4 21.6 3.6 13.2 12.4 4.6 17.2 13z"/>
  <path fill="#FBBC05" d="M17.2 13 12.4 4.6h8.7l4.8 8.4z"/>
  <path fill="#34A853" d="M8.4 21.6h8.8l8.7-8.6H17.2z"/>
            """,
            "#fff",
            border=True,
        ),
    )

    slack = si_paths("slack")
    slack_colors = [
        "#2EB67D",
        "#2EB67D",
        "#36C5F0",
        "#36C5F0",
        "#ECB22E",
        "#ECB22E",
        "#E01E5A",
        "#E01E5A",
    ]
    slack_inner = '<g transform="translate(4.5,4.5) scale(0.9583)">\n' + "\n".join(
        f'    <path fill="{c}" d="{p}"/>' for c, p in zip(slack_colors, slack)
    ) + "\n  </g>"
    write("slack", tile(slack_inner, "#fff", border=True))

    write(
        "whatsapp",
        tile(glyph(si_path("whatsapp"), "#fff", 4.5), "#25D366"),
    )
    write(
        "notion",
        tile(glyph(si_path("notion"), "#111111", 5), "#fff", border=True),
    )
    write(
        "github",
        tile(glyph(si_path("github"), "#fff", 4.2), "#181717"),
    )
    write(
        "stripe",
        tile(glyph(si_path("stripe"), "#fff", 6.2), "#635BFF"),
    )
    write(
        "hubspot",
        tile(glyph(si_path("hubspot"), "#fff", 5), "#FF7A59"),
    )
    write(
        "salesforce",
        tile(glyph(si_path("salesforce"), "#fff", 4.5), "#00A1E0"),
    )
    write(
        "semrush",
        tile(glyph(si_path("semrush"), "#fff", 4.8), "#FF642D"),
    )
    write(
        "calendly",
        tile(glyph(si_path("calendly"), "#fff", 4.5), "#006BFF"),
    )
    write(
        "mailchimp",
        tile(glyph(si_path("mailchimp"), "#241C15", 4.2), "#FFE01B"),
    )

    # LinkedIn: blue tile + white in (skip the outer square from SI)
    li = si_paths("linkedin")
    write(
        "linkedin",
        tile(
            f"""
  <g transform="translate(4.2,4.2) scale(0.9833)">
    <path fill="#fff" d="{li[0]}"/>
    <path fill="#fff" d="{li[1]}"/>
  </g>
            """,
            "#0A66C2",
        ),
    )

    # Hacker News / Y Combinator: orange square, white Y
    write(
        "hacker-news",
        tile(
            """
  <path fill="#fff" d="M9.1 7.4h3.05l3.85 7.15 3.9-7.15H23l-5.55 9.55V24h-3.15v-7.05z"/>
            """,
            "#F0652F",
        ),
    )

    # Tavily brand mark (three arrows from a hub) — Web Search
    write(
        "tavily",
        tile(
            """
  <g fill="none" stroke="#fff" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 16 V8.2"/>
    <path d="M13.35 10.6 16 7.7 18.65 10.6"/>
    <path d="M16 16 9.6 20.7"/>
    <path d="M9.85 17.35 8.7 21.5 12.85 20.55"/>
    <path d="M16 16 H23.6"/>
    <path d="M20.9 13.35 23.9 16 20.9 18.65"/>
  </g>
            """,
            "#141414",
        ),
    )

    # Ahrefs — orange lowercase a on white (site favicon)
    write(
        "ahrefs",
        tile(
            """
  <path fill="#F26B21" d="M18.55 10.05c-1-.65-2.15-.9-3.45-.9-3.2 0-5.5 2.3-5.5 5.65s2.2 5.7 5.45 5.7c1.3 0 2.5-.4 3.45-1.15v.9H21.1V13.2c0-1.25.2-2.05.9-2.05h.45V8.7h-.55c-1.15 0-2 .65-2.3 1.35zm0 7.7c-.7.7-1.65 1.1-2.7 1.1-2 0-3.35-1.5-3.35-3.7s1.35-3.7 3.35-3.7c1.05 0 2 .4 2.7 1.1z"/>
            """,
            "#fff",
            border=True,
        ),
    )

    # Pipedrive — green disc, white p
    write(
        "pipedrive",
        tile(
            """
  <circle cx="16" cy="16" r="11.2" fill="#017737"/>
  <path fill="#fff" d="M14.05 9.4h3.35c2.55 0 4.05 1.35 4.05 3.55 0 2.25-1.55 3.6-4.15 3.6h-1.15V22.6h-2.1zm2.1 5.35h1.05c1.25 0 1.95-.6 1.95-1.7s-.7-1.7-1.95-1.7h-1.05z"/>
            """,
            "#fff",
            border=True,
        ),
    )

    # Instantly — blue disc, lightning
    write(
        "instantly",
        tile(
            """
  <circle cx="16" cy="16" r="11.2" fill="#1A73E8"/>
  <path fill="#fff" d="M17.8 6.8 10.6 16.2h4.05l-1.15 9 8.05-10.7h-4.2z"/>
            """,
            "#fff",
            border=True,
        ),
    )

    # Apollo.io current mark: lime tile, black 8-blade pinwheel
    blades = []
    for i in range(8):
        angle = i * 45
        blades.append(
            f'<ellipse transform="rotate({angle} 16 16)" cx="16" cy="9.2" rx="1.55" ry="5.4" fill="#111"/>'
        )
    write(
        "apollo",
        tile("\n  ".join(blades), "#D4FF00"),
    )

    # Generic plug fallback (should not render for catalog ids)
    write(
        "generic",
        tile(
            """
  <path fill="#fff" d="M13.2 8.4h2.1v4.2h1.4V8.4h2.1v4.2h1.6c.7 0 1.3.6 1.3 1.3v3.4c0 2.5-1.6 4.6-3.9 5.3v2.9h-2.4v-2.9c-2.3-.7-3.9-2.8-3.9-5.3v-3.4c0-.7.6-1.3 1.3-1.3h1.4z"/>
            """,
            "#57534E",
        ),
    )


if __name__ == "__main__":
    main()

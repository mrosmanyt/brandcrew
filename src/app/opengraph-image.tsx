import { ImageResponse } from "next/og";
import {
  CINEM_MARK_PATHS,
  CINEM_MARK_VIEWBOX,
  CINEM_NIGHT,
  CINEM_PAPER,
} from "@/lib/cinem-mark";

export const alt = "CINEM Pro — AI employee desk from CINEM";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: CINEM_NIGHT,
          color: CINEM_PAPER,
        }}
      >
        <svg
          width="160"
          height="160"
          viewBox={CINEM_MARK_VIEWBOX}
          fill={CINEM_PAPER}
        >
          {CINEM_MARK_PATHS.map((d) => (
            <path key={d} d={d} fill={CINEM_PAPER} />
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 64,
            fontWeight: 600,
            letterSpacing: "-0.04em",
          }}
        >
          CINEM Pro
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 28,
            opacity: 0.72,
          }}
        >
          AI employee desk from CINEM
        </div>
      </div>
    ),
    { ...size },
  );
}

import { ImageResponse } from "next/og";
import {
  CINEM_MARK_PATHS,
  CINEM_MARK_VIEWBOX,
  CINEM_NIGHT,
  CINEM_PAPER,
} from "@/lib/cinem-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CINEM_NIGHT,
        }}
      >
        <svg
          width="118"
          height="118"
          viewBox={CINEM_MARK_VIEWBOX}
          fill={CINEM_PAPER}
        >
          {CINEM_MARK_PATHS.map((d) => (
            <path key={d} d={d} fill={CINEM_PAPER} />
          ))}
        </svg>
      </div>
    ),
    { ...size },
  );
}

import { config } from "../config.js";
import { ffmpeg } from "../lib/ffmpeg.js";
import { filePath } from "../lib/storage.js";

/**
 * Step 3 — video render. Provider-based design:
 *
 *  - "mock"  : ffmpeg se 8-second demo clip (pipeline test karne ke liye —
 *              CINEM-AI-ASSISTANT_MOCK=1 me hamesha yehi)
 *  - "none"  : abhi koi real video API configure nahi — job saaf error ke
 *              saath rukti hai, taake silent garbage upload na ho
 *  - REAL API: jab aap 1-2 providers test karke per-video cost lock kar lein
 *              (Blueprint Section 3), neeche `external()` template bhar dein
 *              aur VIDEO_PROVIDER=external set karein. Sirf YE file badlegi.
 */
export async function renderVideo({ userId, jobId, topic, script }) {
  const out = filePath(userId, jobId, "video.mp4");

  const provider = config.mock ? "mock" : config.videoProvider;
  if (provider === "mock") {
    await mockRender(out);
    return out;
  }
  if (provider === "external") {
    return external({ userId, jobId, topic, script, out });
  }
  throw new Error(
    "VIDEO_PROVIDER configure nahi hai. Ek video-gen API choose karke per-video cost test karo, " +
    "phir src/pipeline/video.js me external() implement karke .env me VIDEO_PROVIDER=external set karo. " +
    "(Test ke liye: CINEM-AI-ASSISTANT_MOCK=1 se mock render chalta hai.)"
  );
}

/** 1280x720 demo clip — gradient + tone. Sirf pipeline verify karne ke liye. */
async function mockRender(out) {
  const vf = "testsrc2=size=1280x720:rate=30:duration=8";
  await ffmpeg([
    "-f", "lavfi", "-i", vf,
    "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-shortest",
    out,
  ]);
}

/**
 * REAL provider template — API choose hone par bharna:
 *  1. Script/scenes ko provider ke endpoint par bhejo (fetch + API key .env se)
 *  2. Render poll karo, mp4 download karke `out` par likho
 *  3. `out` return karo — baaki pipeline (thumbnail, upload) khud chalegi
 */
async function external({ topic, script, out }) {
  void topic; void script; void out;
  throw new Error("external video provider abhi implement nahi hua — src/pipeline/video.js dekhein");
}

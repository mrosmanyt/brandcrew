/**
 * Vision capture helpers + natural-language intent matching for Cinem AI Assistant's
 * Camera and Screen Share features.
 */

/** Camera stream (rear camera preferred on devices that have one). */
export async function getCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API unavailable in this environment.");
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 } },
    audio: false,
  });
}

/** Screen-share stream (prompts the OS screen picker). */
export async function getScreenStream(): Promise<MediaStream> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (c: MediaStreamConstraints) => Promise<MediaStream>;
  };
  if (!md.getDisplayMedia) {
    throw new Error("Screen capture isn't supported by this window.");
  }
  return md.getDisplayMedia({ video: true, audio: false });
}

/** Draws a video frame to a canvas and returns base64 JPEG (no data: prefix). */
function frameFromVideo(video: HTMLVideoElement, maxW = 1024): string {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = Math.min(1, maxW / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
}

/**
 * Grabs a single still frame from a live stream (creates an offscreen video,
 * waits for the first frame, captures it). Works independently of any visible
 * preview element.
 */
export function captureFromStream(stream: MediaStream, maxW = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    const grab = () => {
      // small delay so the decoder has a painted frame
      setTimeout(() => {
        try {
          const b64 = frameFromVideo(video, maxW);
          if (!b64) reject(new Error("Could not capture a frame."));
          else resolve(b64);
        } catch (e) {
          reject(e);
        }
      }, 180);
    };

    video.onloadeddata = () => video.play().then(grab).catch(reject);
    video.onerror = () => reject(new Error("Video stream error."));
  });
}

/* ── Natural-language intent matching ─────────────────────────────── */

export type VisionIntent =
  | { kind: "enable-camera" }
  | { kind: "enable-screen" }
  | { kind: "disable" }
  | { kind: "analyze"; source: "camera" | "screen" | "auto"; prompt: string };

/** Maps a user command to a vision intent, or null if it isn't vision-related. */
export function matchVisionIntent(text: string): VisionIntent | null {
  const t = text.toLowerCase().trim();

  // Stop / disable
  if (/\b(stop|disable|close|turn off|end)\b.*\b(camera|screen|share|sharing|vision)\b/.test(t)) {
    return { kind: "disable" };
  }

  // Questions that imply analysis come BEFORE the plain enable toggles.
  const analysisAsk =
    /\bwhat(?:'s| is) this\b/.test(t) ||
    /\bdescribe this\b/.test(t) ||
    /\bidentify this\b/.test(t) ||
    /\bwhat (?:am i (?:holding|showing)|do you see|is in front)\b/.test(t) ||
    /\b(read|analyze|analyse) this\b/.test(t) ||
    /\b(analyze|analyse|look at|check|review|examine) (?:my |the |this )?screen\b/.test(t) ||
    /\bwhat does this (?:say|mean)\b/.test(t) ||
    /\bwhat(?:'s| is) on (?:my|the) screen\b/.test(t) ||
    /\bsummari[sz]e (?:this|the screen|this document)\b/.test(t) ||
    /\bexplain (?:this )?(?:code|error|screen)\b/.test(t) ||
    /\b(suggest|recommend) (?:some )?improvements?\b/.test(t) ||
    /\bwhat error\b/.test(t);

  if (analysisAsk) {
    const screeny =
      /\bscreen\b|\bdocument\b|\bcode\b|\berror\b|\bpage\b|\bui\b|\bdesign\b|\bwebsite\b/.test(t) &&
      !/\bholding\b|\bcamera\b/.test(t);
    return { kind: "analyze", source: screeny ? "screen" : "auto", prompt: text };
  }

  // Plain toggles
  if (/\b(share|capture|view|see|start)\b.*\bscreen\b/.test(t)) return { kind: "enable-screen" };
  if (/\b(enable|open|start|turn on|activate|use)\b.*\bcamera\b/.test(t)) return { kind: "enable-camera" };

  return null;
}

/** Builds the prompt sent to the vision model. */
export function buildVisionPrompt(userText: string, source: "camera" | "screen"): string {
  const role =
    source === "screen"
      ? "You are Cinem AI Assistant analyzing a screenshot of the user's screen."
      : "You are Cinem AI Assistant analyzing a live camera frame the user is pointing at something.";
  return `${role}
User asked: "${userText}".
Answer helpfully and specifically based ONLY on what is visible. If text/code/an error is present, read it and explain it. Keep it concise (under 130 words) unless detail is clearly needed. Plain text, no markdown headers.`;
}

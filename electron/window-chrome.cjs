/**
 * Integrated window chrome (Claude / Cursor / Grok Bot vibe).
 * Keep this file free of `electron` so Node tests can require it.
 *
 * Windows: hidden title bar + titleBarOverlay so min/max/close sit on the
 * same dark surface as Desk / AI Assistant — not a separate light caption strip.
 * Linux: frameless + custom caption glyphs.
 * macOS: hiddenInset traffic lights.
 */
const CHROME_SURFACE = "#09090b";
const CHROME_SYMBOL = "#c4c4c4";
const OVERLAY_HEIGHT = 44;
const OVERLAY_CAPTION_RESERVE_PX = 138;
const TRAFFIC_LIGHT_RESERVE_PX = 78;

function describeWindowChrome(platform = process.platform) {
  if (platform === "darwin") {
    return {
      platform,
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 14, y: 14 },
      titleBarOverlay: false,
      usesNativeOverlay: false,
      usesCustomCaption: false,
      captionReservePx: 0,
      trafficLightReservePx: TRAFFIC_LIGHT_RESERVE_PX,
    };
  }
  if (platform === "win32") {
    return {
      platform,
      frame: true,
      titleBarStyle: "hidden",
      titleBarOverlay: {
        color: CHROME_SURFACE,
        symbolColor: CHROME_SYMBOL,
        height: OVERLAY_HEIGHT,
      },
      usesNativeOverlay: true,
      usesCustomCaption: false,
      captionReservePx: OVERLAY_CAPTION_RESERVE_PX,
      trafficLightReservePx: 0,
    };
  }
  return {
    platform,
    frame: false,
    titleBarStyle: undefined,
    titleBarOverlay: false,
    usesNativeOverlay: false,
    usesCustomCaption: true,
    captionReservePx: OVERLAY_CAPTION_RESERVE_PX,
    trafficLightReservePx: 0,
  };
}

/** Fields safe to spread into `new BrowserWindow({...})`. */
function browserWindowChromeOptions(platform = process.platform) {
  const d = describeWindowChrome(platform);
  /** @type {Record<string, unknown>} */
  const opts = {
    frame: d.frame,
    backgroundColor: CHROME_SURFACE,
    autoHideMenuBar: true,
  };
  if (d.titleBarStyle) opts.titleBarStyle = d.titleBarStyle;
  if (d.trafficLightPosition) opts.trafficLightPosition = d.trafficLightPosition;
  if (d.titleBarOverlay) opts.titleBarOverlay = d.titleBarOverlay;
  return opts;
}

function chromeQuery(mode, platform = process.platform) {
  const d = describeWindowChrome(platform);
  return {
    mode: mode === "assistant" ? "assistant" : "desk",
    platform,
    overlay: d.usesNativeOverlay ? "1" : "0",
    caption: d.usesCustomCaption ? "1" : "0",
  };
}

module.exports = {
  CHROME_SURFACE,
  CHROME_SYMBOL,
  OVERLAY_HEIGHT,
  OVERLAY_CAPTION_RESERVE_PX,
  TRAFFIC_LIGHT_RESERVE_PX,
  describeWindowChrome,
  browserWindowChromeOptions,
  chromeQuery,
};

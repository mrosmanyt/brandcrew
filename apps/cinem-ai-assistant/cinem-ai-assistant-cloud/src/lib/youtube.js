import fs from "node:fs";
import { google } from "googleapis";
import { config } from "../config.js";
import { decrypt } from "./crypto.js";

/**
 * YouTube — OFFICIAL Data API v3 (browser-automation nahi: koi ban risk
 * nahi, PC-on dependency nahi — Blueprint ka sabse important shift).
 * Har client apna account EK BAAR OAuth se connect karta hai; hum sirf
 * uska (encrypted) refresh token rakhte hain.
 */
export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const redirectUri = () => `${config.publicUrl}/api/connect/youtube/callback`;

export function oauthClient() {
  return new google.auth.OAuth2(config.googleClientId, config.googleClientSecret, redirectUri());
}

export function getAuthUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // refresh_token har baar mile
    scope: YT_SCOPES,
    state,
  });
}

export async function exchangeCode(code) {
  const { tokens } = await oauthClient().getToken(code);
  return tokens; // { access_token, refresh_token, ... }
}

export function clientFor(account) {
  const c = oauthClient();
  c.setCredentials({ refresh_token: decrypt(account.refresh_token_enc) });
  return c;
}

export async function channelInfo(auth) {
  const yt = google.youtube({ version: "v3", auth });
  const res = await yt.channels.list({ part: ["snippet", "statistics", "contentDetails"], mine: true });
  const ch = res.data.items?.[0];
  if (!ch) throw new Error("Is Google account par koi YouTube channel nahi mila");
  return {
    channelId: ch.id,
    title: ch.snippet?.title,
    thumbnail: ch.snippet?.thumbnails?.default?.url,
    subs: ch.statistics?.subscriberCount,
    views: ch.statistics?.viewCount,
    videoCount: ch.statistics?.videoCount,
    uploadsPlaylist: ch.contentDetails?.relatedPlaylists?.uploads,
  };
}

export async function uploadVideo(auth, { filePath, title, description, tags, privacyStatus = "public" }) {
  const yt = google.youtube({ version: "v3", auth });
  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title: String(title).slice(0, 100), description, tags, categoryId: "22" },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(filePath) },
  });
  return res.data.id;
}

export async function setThumbnail(auth, videoId, thumbPath) {
  const yt = google.youtube({ version: "v3", auth });
  await yt.thumbnails.set({ videoId, media: { body: fs.createReadStream(thumbPath) } });
}

/** Dashboard ke liye: channel stats + last uploads (views ke saath). */
export async function basicStats(auth) {
  const info = await channelInfo(auth);
  const yt = google.youtube({ version: "v3", auth });
  let recent = [];
  if (info.uploadsPlaylist) {
    const pl = await yt.playlistItems.list({ part: ["contentDetails", "snippet"], playlistId: info.uploadsPlaylist, maxResults: 5 });
    const ids = (pl.data.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
    if (ids.length) {
      const vids = await yt.videos.list({ part: ["snippet", "statistics"], id: ids });
      recent = (vids.data.items || []).map((v) => ({
        id: v.id,
        title: v.snippet?.title,
        publishedAt: v.snippet?.publishedAt,
        views: v.statistics?.viewCount,
        likes: v.statistics?.likeCount,
        url: `https://youtu.be/${v.id}`,
      }));
    }
  }
  const popular = [...recent].sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0] || null;
  return { channel: info, latest: recent[0] || null, popular, recent };
}

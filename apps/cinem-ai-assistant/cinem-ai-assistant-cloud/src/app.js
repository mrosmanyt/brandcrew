import express from "express";
import cors from "cors";
import { health } from "./routes/health.js";
import { me } from "./routes/me.js";
import { connect } from "./routes/connect.js";
import { videos } from "./routes/videos.js";
import { usage } from "./routes/usage.js";
import { telegram } from "./routes/telegram.js";
import { log } from "./lib/log.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors()); // website (cinem-ai-assistant.site) + desktop dono is API par aayenge
  app.use(express.json({ limit: "1mb" }));

  app.use(health);
  app.use(me);
  app.use(connect);
  app.use(videos);
  app.use(usage);
  app.use(telegram);

  app.use((req, res) => res.status(404).json({ error: `Route nahi mila: ${req.method} ${req.path}` }));

  // Central error handler — user ko saaf message, log me poori baat
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) log.error(err.stack || err.message);
    res.status(status).json({ error: err.message || "Server error" });
  });

  return app;
}

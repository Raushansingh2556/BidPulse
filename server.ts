import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { db } from "./server/db/database";
import { seedDatabase } from "./server/db/seeds";
import { outbox } from "./server/services/outbox";
import { realtime } from "./server/services/realtime";
import { checkAndTransitionAuctions } from "./server/services/auction";
import { apiRouter } from "./server/routes/api";

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Basic CORS headers
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // 1. Initialize Database & Seed data
  try {
    console.log("[SERVER] Initializing PostgreSQL database...");
    await db.init();
    await seedDatabase();
  } catch (err: any) {
    console.error("[SERVER] Database initialization failure:", err);
  }

  // 2. Attach WebSocket server to HTTP server
  realtime.attach(server);

  // 3. Start Transactional Outbox Background Worker
  outbox.start(100); // polls every 100ms for sub-second realtime broadcast after DB commit

  // 4. Start Auction Lifecycle Tick Loop (every 2 seconds)
  setInterval(async () => {
    try {
      await checkAndTransitionAuctions();
    } catch (err) {
      // silent loop error
    }
  }, 2000);

  // 5. Mount API routes
  app.use("/api", apiRouter);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      socketsConnected: realtime.getConnectedCount(),
      service: "Real-Time Transactional Auction Platform",
    });
  });

  // 6. Vite Middleware or Static Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Auction Platform running at http://0.0.0.0:${PORT}`);
    console.log(`[SERVER] WebSocket ready at ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error("[FATAL] Server failed to start:", err);
  process.exit(1);
});

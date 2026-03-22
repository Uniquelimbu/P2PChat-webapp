import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocket } from "./lib/websocket";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db/schema";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDefaultRooms() {
  const existing = await db.select().from(roomsTable);
  if (existing.length > 0) return;

  await db.insert(roomsTable).values([
    { id: "general", name: "General" },
    { id: "demo", name: "Demo Room" },
  ]);
  logger.info("Seeded default rooms: General, Demo Room");
}

const server = http.createServer(app);

setupWebSocket(server);

server.listen(port, async () => {
  logger.info({ port }, "Server listening with WebSocket support");
  try {
    await seedDefaultRooms();
  } catch (err) {
    logger.warn({ err }, "Failed to seed default rooms (non-fatal)");
  }
});

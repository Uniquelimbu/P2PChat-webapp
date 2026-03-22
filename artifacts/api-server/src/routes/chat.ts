import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, messagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  CreateRoomBody,
  GetMessagesQueryParams,
} from "@workspace/api-zod";
import { getPeers } from "../lib/websocket";

const router: IRouter = Router();

router.get("/rooms", async (_req, res) => {
  const rooms = await db.select().from(roomsTable);
  const peers = getPeers();

  const roomsWithCount = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt.toISOString(),
    peerCount: peers.filter((p) => p.roomId === room.id).length,
  }));

  res.json(roomsWithCount);
});

router.post("/rooms", async (req, res) => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name } = parsed.data;
  const id = randomUUID();

  await db.insert(roomsTable).values({ id, name });
  const room = await db
    .select()
    .from(roomsTable)
    .where(eq(roomsTable.id, id))
    .then((r) => r[0]);

  res.status(201).json({
    id: room.id,
    name: room.name,
    createdAt: room.createdAt.toISOString(),
    peerCount: 0,
  });
});

router.get("/rooms/:roomId/messages", async (req, res) => {
  const { roomId } = req.params;
  const query = GetMessagesQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? Number(query.data.limit) : 50;

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.roomId, roomId))
    .orderBy(desc(messagesTable.timestamp))
    .limit(limit);

  res.json(
    messages.reverse().map((m) => ({
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderIp: m.senderIp,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
      protocol: m.protocol,
      frameType: m.frameType,
      payloadSize: m.payloadSize,
      direction: m.direction,
    }))
  );
});

router.get("/peers", (_req, res) => {
  res.json(getPeers());
});

export default router;

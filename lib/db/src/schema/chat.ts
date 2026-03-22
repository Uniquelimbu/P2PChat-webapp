import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomsTable = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderIp: text("sender_ip").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  protocol: text("protocol").notNull().default("WebSocket"),
  frameType: text("frame_type").notNull().default("text"),
  payloadSize: integer("payload_size").notNull().default(0),
  direction: text("direction").notNull().default("RECEIVED"),
});

export const insertRoomSchema = createInsertSchema(roomsTable);
export const insertMessageSchema = createInsertSchema(messagesTable);

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

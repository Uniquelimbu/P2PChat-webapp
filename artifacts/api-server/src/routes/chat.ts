import { Router, type IRouter } from "express";
import { getPeers } from "../lib/websocket";

const router: IRouter = Router();

/**
 * P2P TRUE SIGNALING SERVER
 * 
 * REST endpoints are minimal — only for debugging and monitoring.
 * All chat happens via WebRTC data channels directly between peers.
 * No message persistence, no room storage.
 */

/**
 * GET /api/chat/peers
 * Returns the current list of connected peers (for debugging)
 */
router.get("/peers", (_req, res) => {
  const peerList = getPeers();
  res.json({ peers: peerList, count: peerList.length });
});

export default router;

# P2P Local Network Chat (True WebRTC P2P)

A university-demo-ready chat app where messages flow directly between peers using WebRTC data channels.

## What This Project Is

- True peer-to-peer messaging: no server message relay.
- Group chat and direct messages.
- Ephemeral messages: in-memory only, cleared when browser closes.
- Signaling server only: used for peer discovery + SDP/ICE exchange.
- Protocol Inspector: live visibility into WebSocket signaling + WebRTC events.

## Architecture

```text
Browser A  --\
            \      WebRTC Data Channels (group-chat, direct-message)
             >-----------------------------------------------<
            /                                                 \
Browser B  --/                                                 Browser C

All browsers connect to a signaling server at /ws only for:
- peer join/discovery
- SDP offer/answer relay
- ICE candidate relay
```

Server responsibilities are intentionally minimal:
- `join` flow
- peer list broadcast
- signaling relay (`signal:offer`, `signal:answer`, `signal:ice-candidate`)

No database. No REST message history.

## Tech Stack

- Frontend: React 19, Vite, TypeScript, Tailwind
- Backend: Express 5 + ws
- P2P transport: WebRTC (`RTCPeerConnection` + data channels)
- Workspace: pnpm monorepo

## Quick Start

### 1) Install dependencies

```bash
pnpm install
```

### 2) Run both services (from repository root)

```bash
cd C:\projects\P2PChat-webapp
pnpm run dev:all
```

This starts:
- signaling server on `http://localhost:8080` (`/ws` path for signaling)
- frontend on `http://localhost:5173`

If you run this command from `C:\projects` (parent folder), pnpm will fail because no workspace `package.json` exists there.

### 3) Open app

- Open `http://localhost:5173` in two browser windows.
- Enter different usernames.
- Join the same room.
- Send group and direct messages.

## LAN Demo (Same WiFi)

1. On host machine, run `pnpm run dev:all`.
2. Find host IPv4 address.
3. On other devices, open `http://<host-ip>:5173`.
4. Verify peers appear and WebRTC connects.

## ngrok (Optional)

```bash
pnpm run share:ngrok
```

This tunnels both ports:
- `5173` frontend
- `8080` signaling server

## Signaling URL Override (Optional)

By default, the frontend connects signaling to:

- same-host `/ws` (`ws://<frontend-host>/ws` or `wss://<frontend-host>/ws`)
- Vite proxies `/ws` to the signaling server in local dev

For split-host deployments (frontend and signaling on different hosts), set:

```bash
VITE_SIGNALING_WS_URL=wss://your-signaling-host/ws
```

## Scripts

| Command | Description |
|---|---|
| `pnpm run dev:all` | Run signaling server + frontend |
| `pnpm run share:ngrok` | Tunnel frontend and signaling ports |
| `pnpm run typecheck` | Type-check workspace |
| `pnpm run build` | Type-check then build packages |
| `pnpm --filter @workspace/api-server run dev` | Run signaling server only |
| `pnpm --filter @workspace/p2p-chat run dev` | Run frontend only |

## Workspace Structure

```text
artifacts/
  api-server/
    src/
      app.ts
      index.ts
      lib/websocket.ts
      routes/
  p2p-chat/
    src/
      hooks/use-websocket.ts   # signaling transport
      hooks/use-webrtc.ts      # peer connections + data channels
      context/app-context.tsx
      components/chat/
scripts/
```

## Important Runtime Notes

- Messages are not persisted.
- Rooms are client-managed and ephemeral.
- Works best on local/LAN networks for demo environments.
- TURN is not configured by default (LAN-focused setup).

## Troubleshooting

### Frontend cannot connect to signaling server

- Check backend is running on port `8080`.
- Check frontend proxy routes `/ws` to backend.
- If deployed on separate hosts, set `VITE_SIGNALING_WS_URL`.

### `pnpm run dev:all` fails immediately

- Ensure you are in the repository root: `C:\projects\P2PChat-webapp`.
- Then run `pnpm run dev:all`.

### Peer list appears but messages do not arrive

- Verify WebRTC connection state in Protocol Inspector.
- Ensure both peers are in the same room.
- On restrictive networks, ICE may fail without TURN.

### Port already in use

Stop the process using `8080` or `5173`, then restart `pnpm run dev:all`.


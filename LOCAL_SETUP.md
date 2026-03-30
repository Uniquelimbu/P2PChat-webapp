# LOCAL_SETUP.md

## True P2P Local Setup (LAN Demo)

This setup is for the current architecture:
- WebRTC data channels for chat transport
- WebSocket signaling server only
- no PostgreSQL
- no message persistence

## Prerequisites

- Node.js 20+
- pnpm 9+

Check versions:

```bash
node --version
pnpm --version
```

## Install

From workspace root:

```bash
pnpm install
```

Optional: create a local env file from template:

```powershell
Copy-Item .env.example .env
```

## Run Everything

```bash
pnpm run dev:all
```

For public sharing (same 2-step flow):

```bash
pnpm run share:ngrok
```

Share the single ngrok frontend URL with peers.

This runs:
- backend signaling server on `http://localhost:8080`
- frontend on `http://localhost:5173`

## Manual Split Run (optional)

Terminal 1:

```bash
pnpm --filter @workspace/api-server run dev
```

Terminal 2:

```bash
pnpm --filter @workspace/p2p-chat run dev
```

## Verify P2P Behavior

1. Open `http://localhost:5173` in two browsers.
2. Use different usernames.
3. Join the same room.
4. Send group messages.
5. Open a DM and send direct messages.
6. Confirm Protocol Inspector shows signaling + WebRTC events.

Expected behavior:
- peer discovery happens through WebSocket signaling
- chat payloads flow through WebRTC data channels
- closing browser clears message history

## LAN Demo Steps

1. Host machine: run `pnpm run dev:all`.
2. Find host IP:

Windows:

```powershell
ipconfig | findstr IPv4
```

macOS/Linux:

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

3. Client devices on same WiFi open:

```text
http://<host-ip>:5173
```

4. Verify peers connect and exchange messages.

## ngrok (optional)

```bash
pnpm run share:ngrok
```

This creates one public tunnel to frontend `5173`.
Share that frontend URL with peers.

`/ws` signaling still works because the frontend server proxies `/ws` to local `8080`.

## Environment Variables

Required for frontend process:
- `PORT` (typically `5173`)
- `BASE_PATH` (typically `/`)

Required for backend process:
- `PORT` (typically `8080`)

Optional for cross-network reliability (different WiFi / strict NAT):
- `VITE_TURN_URLS` (comma-separated TURN URLs)
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`
- `VITE_ICE_TRANSPORT_POLICY` (`relay` to force TURN)
- `VITE_ICE_SERVERS` (advanced JSON override for full ICE config)
- `VITE_DISABLE_PUBLIC_TURN` (`true` to disable demo fallback TURN)

Note: this project includes a public TURN fallback by default for demo convenience.
For stable production usage, configure your own TURN server values above.

Example:

```bash
VITE_TURN_URLS=turn:your-turn-host:3478?transport=udp,turn:your-turn-host:443?transport=tcp
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-password
VITE_ICE_TRANSPORT_POLICY=relay
```

No `DATABASE_URL` is required.

## Troubleshooting

### App opens but peer connection does not establish

- ensure both peers are in same room
- check browser console for ICE/WebRTC errors
- verify signaling server is reachable at `/ws`
- for different WiFi networks, configure TURN variables above

### Cannot open from another device on LAN

- ensure all devices are on same network
- open/allow inbound port `5173` on host firewall
- keep backend on `8080` running

### Port conflicts

Free ports `8080` and `5173`, then restart.

## Notes

- This project is intentionally LAN-focused for university demo use.
- TURN is not configured by default.
- Messages are ephemeral by design.

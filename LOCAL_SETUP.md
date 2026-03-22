# P2P Local Network Chat — Local Setup Guide

A complete, step-by-step guide for running this app on your own machine (or on a local network for the university demo).

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [How It Works Technically](#2-how-it-works-technically)
3. [Prerequisites](#3-prerequisites)
4. [Project Structure](#4-project-structure)
5. [Step 1 — Clone and Install Dependencies](#5-step-1--clone-and-install-dependencies)
6. [Step 2 — Set Up PostgreSQL](#6-step-2--set-up-postgresql)
7. [Step 3 — Create the Database Tables](#7-step-3--create-the-database-tables)
8. [Step 4 — Seed the Database](#8-step-4--seed-the-database)
9. [Step 5 — Configure the Vite Dev Server Proxy](#9-step-5--configure-the-vite-dev-server-proxy)
10. [Step 6 — Run the Backend (API Server)](#10-step-6--run-the-backend-api-server)
11. [Step 7 — Run the Frontend (React App)](#11-step-7--run-the-frontend-react-app)
12. [Step 8 — Open the App and Test](#12-step-8--open-the-app-and-test)
13. [Running on a LAN (University Demo)](#13-running-on-a-lan-university-demo)
14. [Environment Variable Reference](#14-environment-variable-reference)
15. [WebSocket Protocol Reference](#15-websocket-protocol-reference)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What This App Does

This is a real-time peer-to-peer style chat application that demonstrates WebSocket communication. Multiple users on the same network open the same URL, pick a username, join chat rooms, and talk in real time. A built-in **Protocol Inspector** panel shows every network event live — frame type, payload size, sender IP, direction — making it ideal for university networking demos.

Features:
- Real-time multi-user group chat rooms (backed by WebSocket + PostgreSQL)
- Private one-on-one direct messages between peers (in-memory, not persisted)
- Live peer list showing everyone connected, their username, and IP address
- Protocol Inspector showing WS_HANDSHAKE / CTRL / DATA / DM / CLOSE frame types with full JSON payloads

---

## 2. How It Works Technically

```
Browser (React + Vite)
        |
        |  HTTP GET /api/...    (REST — room list, message history)
        |  WS  wss://.../ws     (WebSocket — real-time events)
        |
   [Vite dev server]  ──proxy──▶  [Express + ws API server]
                                          |
                                     PostgreSQL
                                   (rooms, messages)
```

- The **frontend** is a React 19 + Vite app with Tailwind CSS, shadcn/ui components, and TanStack Query for REST calls.
- The **backend** is an Express 5 server with a `ws` WebSocket server mounted on the `/ws` path.
- The **database** is PostgreSQL accessed through Drizzle ORM.
- The **Vite dev server** acts as a local proxy — it forwards `/api` and `/ws` requests to the Express server. This is why everyone can connect to one URL even though there are two separate processes.

---

## 3. Prerequisites

Install these before you begin.

### Node.js (v20 or later)

```bash
# Check your version
node --version   # should be v20.x or higher

# If not installed, download from https://nodejs.org
# Or use nvm:
nvm install 20
nvm use 20
```

### pnpm (v9 or later)

This project uses `pnpm` workspaces. `npm` and `yarn` will NOT work.

```bash
# Install pnpm globally
npm install -g pnpm

# Verify
pnpm --version   # should be 9.x or higher
```

### PostgreSQL (v14 or later)

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download the installer from https://www.postgresql.org/download/windows/

# Verify PostgreSQL is running
psql --version
```

---

## 4. Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express + WebSocket backend
│   │   └── src/
│   │       ├── index.ts     # Entry point — creates HTTP + WS server
│   │       ├── app.ts       # Express app, routes
│   │       ├── routes/
│   │       │   ├── chat.ts  # REST endpoints: GET /rooms, POST /rooms, GET /rooms/:id/messages
│   │       │   └── health.ts
│   │       └── lib/
│   │           └── websocket.ts   # WebSocket logic, DM routing, broadcast
│   │
│   └── p2p-chat/            # React + Vite frontend
│       └── src/
│           ├── context/
│           │   └── app-context.tsx      # Global state: room, DMs, peers, protocol logs
│           ├── hooks/
│           │   └── use-websocket.ts     # WS connection, reconnect, message dispatch
│           └── components/chat/
│               ├── sidebar.tsx          # Room list, DM list, peer list
│               ├── message-area.tsx     # Room messages + DM view + send input
│               └── inspector.tsx        # Protocol Inspector panel
│
└── lib/
    ├── db/                  # Drizzle ORM — schema + database connection
    │   ├── src/
    │   │   ├── index.ts     # Exports the `db` instance (PostgreSQL pool)
    │   │   └── schema/
    │   │       └── chat.ts  # `rooms` and `messages` table definitions
    │   └── drizzle.config.ts
    ├── api-spec/            # OpenAPI 3.1 spec (openapi.yaml)
    ├── api-zod/             # Zod schemas generated from the spec
    └── api-client-react/    # TanStack Query hooks generated from the spec
```

---

## 5. Step 1 — Clone and Install Dependencies

```bash
# Clone the repository (or unzip the downloaded files)
git clone <your-repo-url>
cd workspace

# Install all dependencies for every package in the monorepo
pnpm install
```

This runs once and installs everything: Express, React, Drizzle, ws, Tailwind, shadcn/ui, etc.

> If you see an error like `ERR_PNPM_REGISTRIES_MISMATCH`, run `pnpm install --no-frozen-lockfile`.

---

## 6. Step 2 — Set Up PostgreSQL

### Create a database and user

Connect to PostgreSQL as the superuser:

```bash
# macOS / Linux
psql -U postgres

# Windows — open "SQL Shell (psql)" from the Start menu
```

Inside the `psql` prompt, run:

```sql
-- Create a dedicated user for the app
CREATE USER p2pchat WITH PASSWORD 'p2pchat_password';

-- Create the database
CREATE DATABASE p2pchat OWNER p2pchat;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE p2pchat TO p2pchat;

-- Exit
\q
```

### Build your DATABASE_URL

The connection string has this format:

```
postgresql://<user>:<password>@<host>:<port>/<database>
```

For the setup above:

```
postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat
```

> Default PostgreSQL port is `5432`. If you changed it, update accordingly.

### Create a .env file for the API server

```bash
# From the root of the project
touch artifacts/api-server/.env
```

Add this content to `artifacts/api-server/.env`:

```env
DATABASE_URL=postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat
PORT=8080
```

---

## 7. Step 3 — Create the Database Tables

The schema is managed by **Drizzle ORM**. You push the schema directly to the database — no SQL migration files to manage.

```bash
# From the project root
cd lib/db

# Set the DATABASE_URL for this command
DATABASE_URL=postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat pnpm run push
```

This creates two tables:

**`rooms`**
| Column     | Type        | Notes                         |
|------------|-------------|-------------------------------|
| id         | text        | Primary key (e.g. "general")  |
| name       | text        | Display name ("General")      |
| created_at | timestamp   | Auto-set to now               |

**`messages`**
| Column       | Type      | Notes                                  |
|--------------|-----------|----------------------------------------|
| id           | text      | Primary key (UUID)                     |
| room_id      | text      | Foreign key → rooms.id                 |
| sender_id    | text      | WebSocket client ID (UUID)             |
| sender_name  | text      | Username chosen at login               |
| sender_ip    | text      | IP address of the sender               |
| content      | text      | Message body                           |
| timestamp    | timestamp | Auto-set to now                        |
| protocol     | text      | Always "WebSocket"                     |
| frame_type   | text      | DATA, CTRL, DM, etc.                   |
| payload_size | integer   | Bytes                                  |
| direction    | text      | "RECEIVED" or "SENT"                   |

Go back to the project root after:

```bash
cd ../..
```

---

## 8. Step 4 — Seed the Database

The app needs at least one room to exist before anyone can chat. Connect to the database and insert the default rooms:

```bash
psql postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat
```

Inside `psql`:

```sql
-- Insert the two default rooms
INSERT INTO rooms (id, name, created_at) VALUES
  ('general',   'General',   NOW()),
  ('demo',      'Demo Room', NOW());

-- Verify
SELECT id, name, created_at FROM rooms;
```

Expected output:
```
   id    |   name    |         created_at
---------+-----------+----------------------------
 general | General   | 2026-03-20 10:00:00.000000
 demo    | Demo Room | 2026-03-20 10:00:00.000000
(2 rows)
```

Exit psql:

```sql
\q
```

> You can also create rooms through the app's UI after starting — click the `+` button next to "Rooms" in the sidebar. The seed is only needed to have rooms ready immediately on first load.

---

## 9. Step 5 — Configure the Vite Dev Server Proxy

In production (Replit), a cloud proxy routes `/api` and `/ws` to the API server automatically. Locally, you need to tell Vite's dev server to do the same thing.

Open `artifacts/p2p-chat/vite.config.ts` and add the `proxy` block inside the existing `server` config:

**Find this section** (near the bottom of the file):

```typescript
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
```

**Replace it with:**

```typescript
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
```

This tells Vite: "any request to `/api/...` → forward to Express on port 8080, and any WebSocket connection to `/ws` → forward to the WebSocket server on port 8080."

> Make sure `8080` matches the `PORT` you set in `artifacts/api-server/.env`.

---

## 10. Step 6 — Run the Backend (API Server)

Open a terminal and run:

```bash
# From the project root
PORT=8080 DATABASE_URL=postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat \
  pnpm --filter @workspace/api-server run dev
```

Or, if you created the `.env` file in Step 6, install `dotenv-cli` to load it automatically:

```bash
pnpm add -g dotenv-cli

# Then run with .env loaded
dotenv -e artifacts/api-server/.env -- pnpm --filter @workspace/api-server run dev
```

You should see:

```
{"level":"info","msg":"WebSocket server initialized on /ws"}
{"level":"info","port":8080,"msg":"Server listening with WebSocket support"}
```

The backend is now running on **http://localhost:8080**.

REST endpoints available:
- `GET  http://localhost:8080/api/chat/rooms` — list all rooms
- `POST http://localhost:8080/api/chat/rooms` — create a room `{ "name": "my-room" }`
- `GET  http://localhost:8080/api/chat/rooms/:id/messages` — message history for a room
- `GET  http://localhost:8080/api/health` — health check
- `WS   ws://localhost:8080/ws` — WebSocket endpoint

---

## 11. Step 7 — Run the Frontend (React App)

Open a **second terminal** and run:

```bash
# From the project root
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev
```

You should see:

```
  VITE v7.x.x  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

The frontend is now running on **http://localhost:5173**.

> `BASE_PATH=/` tells the app it is mounted at the root of the server. Do not omit this — the app will fail to load assets if `BASE_PATH` is missing.

---

## 12. Step 8 — Open the App and Test

1. Open `http://localhost:5173` in your browser
2. Type a username (e.g. `cyber_punk_99`) and click **INITIALIZE_CONNECTION**
3. You are taken to the chat interface
4. Click **General** or **Demo Room** in the left sidebar to join a room
5. Type a message and press Enter or click **SEND**
6. Open a **second browser tab** (or window), pick a different username, join the same room — you will see both users in the peer list and messages arrive in real time

### Testing Direct Messages (DMs)

1. With two tabs open and both users in the same room, look at the **Direct Messages** section in the sidebar
2. You should see the other user listed there
3. Click their name — the message area switches to a private conversation
4. Send a message — only that specific peer receives it (verify in the Protocol Inspector)

### Using the Protocol Inspector

The right panel shows every network event. After joining a room you will see events like:

| Timestamp    | Size     | Event      | Frame Type   |
|--------------|----------|------------|--------------|
| 10:00:00.001 | 0 Bytes  | CONNECT    | WS_HANDSHAKE |
| 10:00:00.012 | 209 B    | RECEIVED   | CTRL         |
| 10:00:00.350 | 96 B     | SENT       | CTRL         |
| 10:00:00.419 | 108 B    | RECEIVED   | CTRL         |
| 10:00:05.221 | 72 B     | SENT       | DATA         |
| 10:00:05.250 | 178 B    | RECEIVED   | DATA         |

Click any row to expand the full JSON payload.

---

## 13. Running on a LAN (University Demo)

This is the intended demo scenario: one laptop acts as the server, everyone else on the same WiFi connects to it.

### On the host laptop

1. Find your local IP address:

   ```bash
   # macOS / Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig | findstr "IPv4"
   ```

   Example result: `192.168.1.100`

2. Run both services exactly as in Steps 10 and 11 — no changes needed.

3. The Vite server already binds to `0.0.0.0` (all interfaces), so it is reachable from the network.

### On every other device

Open a browser and navigate to:

```
http://192.168.1.100:5173
```

Replace `192.168.1.100` with the actual IP of the host laptop.

That's it — everyone connects to the same Vite server, which proxies `/ws` to the WebSocket server. All users share the same room state and peer list.

### Firewall note

If other devices cannot connect, the host machine's firewall may be blocking port 5173. Allow it:

```bash
# macOS — allow incoming on port 5173
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/node

# Ubuntu / Debian
sudo ufw allow 5173

# Windows — add an inbound rule for port 5173 in Windows Defender Firewall
```

---

## 14. Environment Variable Reference

### `artifacts/api-server/.env`

| Variable       | Required | Example                                                      | Description                              |
|----------------|----------|--------------------------------------------------------------|------------------------------------------|
| `DATABASE_URL` | Yes      | `postgresql://p2pchat:pass@localhost:5432/p2pchat`           | Full PostgreSQL connection string        |
| `PORT`         | Yes      | `8080`                                                       | Port the Express server listens on       |

### Frontend (`PORT` and `BASE_PATH` passed as shell env vars)

| Variable    | Required | Example | Description                                          |
|-------------|----------|---------|------------------------------------------------------|
| `PORT`      | Yes      | `5173`  | Port the Vite dev server listens on                  |
| `BASE_PATH` | Yes      | `/`     | URL path prefix the app is mounted at (use `/` locally) |

---

## 15. WebSocket Protocol Reference

All WebSocket frames are JSON text frames. This table documents every message type the server sends and receives.

### Server → Client messages

| `type`    | `frameType`   | When sent                                         | Key fields                                                   |
|-----------|---------------|---------------------------------------------------|--------------------------------------------------------------|
| `system`  | `WS_HANDSHAKE`| Immediately after connection                      | `detail` (IP, handshake info), `timestamp`                   |
| `joined`  | `CTRL`        | After a successful `join` from the client         | `clientId`, `ip`, `roomId`                                   |
| `peers`   | `CTRL`        | After any join or disconnect in a room            | `peers[]` — `{ id, name, ip, connectedAt, roomId }`          |
| `system`  | `CTRL`        | When another peer joins (`PEER_JOINED`)           | `event`, `detail`, `timestamp`                               |
| `system`  | `CTRL`        | When another peer leaves (`PEER_LEFT`)            | `event`, `detail`, `timestamp`                               |
| `chat`    | `DATA`        | When any peer sends a room message                | `id`, `roomId`, `senderId`, `senderName`, `senderIp`, `content`, `timestamp`, `payloadSize`, `direction` |
| `dm`      | `DM`          | When a DM is delivered (to sender and recipient)  | `id`, `senderId`, `senderName`, `senderIp`, `targetId`, `targetName`, `content`, `timestamp`, `direction` |
| `dm_error`| `CTRL`        | When DM target peer is not connected              | `detail`, `timestamp`                                        |

### Client → Server messages

| `type`    | `frameType` | When sent                     | Required fields                                |
|-----------|-------------|-------------------------------|------------------------------------------------|
| `join`    | `CTRL`      | When user enters a room       | `roomId`, `name`, `userId`                     |
| `message` | `DATA`      | When user sends a room message| `roomId`, `content`                            |
| `dm`      | `DM`        | When user sends a direct message | `targetId` (server clientId), `content`     |

### `direction` field

- `SENT` — the server is confirming to the original sender that their message was processed
- `RECEIVED` — the server is delivering a message from another peer

### Connection lifecycle

```
Client                                     Server
  |                                           |
  |──── TCP SYN / HTTP GET /ws ──────────────▶|
  |◀─── 101 Switching Protocols ──────────────|   WS_HANDSHAKE
  |◀─── { type: "system", event: "CONNECT" } ─|   CTRL
  |                                           |
  |──── { type: "join", roomId, name } ──────▶|   CTRL
  |◀─── { type: "joined", clientId, ip } ─────|   CTRL
  |◀─── { type: "peers", peers: [...] } ──────|   CTRL
  |                                           |
  |──── { type: "message", content } ────────▶|   DATA
  |◀─── { type: "chat", direction: "SENT" } ──|   DATA (echo back to sender)
  |           (broadcast to room peers)       |
  |                                           |
  |──── { type: "dm", targetId, content } ───▶|   DM
  |◀─── { type: "dm", direction: "SENT" } ────|   DM (sender confirmation)
  |           target receives direction:"RECEIVED"
  |                                           |
  |──── TCP FIN ──────────────────────────────▶|
  |           (broadcast PEER_LEFT to room)   |   CTRL
```

---

## 16. Troubleshooting

### "PORT environment variable is required"

Both the API server and the Vite frontend require `PORT` to be set before starting. Make sure you pass it explicitly:

```bash
# Backend
PORT=8080 pnpm --filter @workspace/api-server run dev

# Frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev
```

### "BASE_PATH environment variable is required"

The frontend Vite config reads `BASE_PATH`. If missing, Vite throws on startup. Always set `BASE_PATH=/` locally.

### WebSocket connects but never receives messages

This usually means the Vite proxy is not configured. Go back to [Step 5](#9-step-5--configure-the-vite-dev-server-proxy) and add the proxy block to `vite.config.ts`. After saving, Vite hot-reloads and the proxy takes effect immediately — no restart needed.

### "DATABASE_URL, ensure the database is provisioned"

The Drizzle config throws this if `DATABASE_URL` is not in the environment when starting the API server. Either:
- Pass it inline: `DATABASE_URL=postgresql://... PORT=8080 pnpm ...`
- Or use `dotenv-cli` to load your `.env` file

### "relation rooms does not exist" / table not found

You skipped Step 7 (pushing the schema). Run:

```bash
cd lib/db
DATABASE_URL=postgresql://p2pchat:p2pchat_password@localhost:5432/p2pchat pnpm run push
cd ../..
```

### "authentication failed for user p2pchat"

The password in your `DATABASE_URL` doesn't match what you set in PostgreSQL. Reset it:

```bash
psql -U postgres -c "ALTER USER p2pchat WITH PASSWORD 'new_password';"
```

Then update `DATABASE_URL` to use the new password.

### Users on other devices can't connect

1. Check the host machine's firewall — port 5173 must be open (see [LAN setup](#13-running-on-a-lan-university-demo))
2. Confirm Vite is bound to `0.0.0.0` not `127.0.0.1` — the config already does this via `host: "0.0.0.0"` in `vite.config.ts`
3. Confirm other devices are on the same WiFi network/subnet as the host

### Messages appear in the inspector but not in the chat

The frontend only adds a `chat` message to the visible list if `data.roomId === activeRoom.id`. Make sure everyone has joined the same room (click the room name in the sidebar). If you just connected and haven't clicked a room yet, messages for that room are ignored.

### DMs are lost on refresh

Direct messages are intentionally in-memory only — they are not persisted to the database. This is by design for the demo: the protocol shows DM frames being routed peer-to-peer. If you need persistent DMs, you would add a `direct_messages` table to `lib/db/src/schema/chat.ts`, push the schema, and update the WebSocket handler to insert rows.

### pnpm: "Use pnpm instead" error

This repo blocks `npm install`. Always use `pnpm install`. If you accidentally ran `npm install`, delete `node_modules` and `package-lock.json` then run `pnpm install`.

---

## Quick Start Cheat Sheet

```bash
# 1. Install
pnpm install

# 2. Push DB schema
cd lib/db && DATABASE_URL=postgresql://p2pchat:pass@localhost:5432/p2pchat pnpm run push && cd ../..

# 3. Seed rooms (run once)
psql postgresql://p2pchat:pass@localhost:5432/p2pchat \
  -c "INSERT INTO rooms (id, name, created_at) VALUES ('general','General',NOW()),('demo','Demo Room',NOW()) ON CONFLICT DO NOTHING;"

# 4. Start backend (terminal 1)
PORT=8080 DATABASE_URL=postgresql://p2pchat:pass@localhost:5432/p2pchat \
  pnpm --filter @workspace/api-server run dev

# 5. Start frontend (terminal 2)  [after editing vite.config.ts proxy]
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev

# 6. Open http://localhost:5173
```

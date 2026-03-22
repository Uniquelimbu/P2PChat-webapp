<div align="center">

# P2P Local Network Chat

**A real-time, peer-to-peer style chat application with a live Protocol Inspector — built for networking education and local network demos.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## What Is This?

P2P Local Network Chat is a full-stack web application that lets multiple users on the same network connect to one URL and chat in real time. Every message, join event, and direct message travels over a **WebSocket connection** and is displayed live in a built-in **Protocol Inspector** — showing exactly what's happening at the network layer in human-readable detail.

It was designed as a university networking demo to make abstract concepts like TCP handshakes, WebSocket frames, IP addressing, and real-time pub/sub routing **visible and tangible**.

---

## Features

| Feature | Description |
|---|---|
| **Real-time Group Chat** | Multiple users join named rooms and exchange messages instantly over WebSocket |
| **Private Direct Messages** | Click any peer's name to open a one-on-one encrypted DM channel |
| **Live Peer List** | See every connected user's alias and IP address update in real time |
| **Protocol Inspector** | A built-in panel that logs every single WebSocket frame — type, direction, payload size, sender IP, and raw JSON |
| **Persistent History** | Room messages are stored in PostgreSQL and loaded when you join a room |
| **Room Management** | Create new rooms on the fly or use the pre-seeded defaults |
| **Hacker Terminal Aesthetic** | Monospace fonts, scanlines, and a dark cyberpunk UI that fits the networking demo vibe |

---

## Screenshots

> **Setup screen** — enter your alias to initialize your connection identity.  
> **Chat screen** — sidebar with rooms and peers, main message area, collapsible Protocol Inspector at the bottom.

---

## How It Works

```
Browser (React + Vite)
        │
        ├─── HTTP GET /api/chat/rooms          ─────────────────────┐
        ├─── HTTP GET /api/chat/rooms/:id/messages                  │
        │                                                            ▼
        └─── WebSocket  wss://host/ws          ────▶  Express 5 + ws server
                                                              │
                                                         PostgreSQL
                                                      (rooms, messages)
```

1. You open the app and enter an alias. The frontend connects to the WebSocket server via `wss://host/ws`.
2. The server sends a `WS_HANDSHAKE` frame confirming your connection, along with your detected IP address.
3. When you join a room, the server sends a `join` frame to all peers in that room and broadcasts an updated peer list.
4. Every chat message is a `DATA` frame broadcast to all peers in the room and persisted to PostgreSQL.
5. Direct messages are `DM` frames routed server-side from one WebSocket connection directly to another — never stored.
6. The Protocol Inspector on the frontend records every frame it sends or receives and displays it with full metadata.

---

## Tech Stack

### Frontend (`artifacts/p2p-chat`)
| Technology | Role |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Dev server and bundler |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui + Radix UI** | Accessible UI primitives (buttons, dialogs, scroll areas) |
| **TanStack Query** | REST data fetching and caching |
| **Wouter** | Lightweight client-side routing |
| **WebSocket API** | Real-time bidirectional communication |

### Backend (`artifacts/api-server`)
| Technology | Role |
|---|---|
| **Node.js 24** | JavaScript runtime |
| **Express 5** | HTTP server and REST API router |
| **ws** | WebSocket server (mounted at `/ws`) |
| **Pino** | Structured JSON logging |
| **Drizzle ORM** | Type-safe database queries |
| **Zod** | Request/response validation |

### Database & Shared Libraries
| Technology | Role |
|---|---|
| **PostgreSQL 16** | Persistent storage for rooms and messages |
| **Drizzle ORM + Drizzle Kit** | Schema definition and migrations |
| **OpenAPI 3.1 + Orval** | API contract → auto-generated React Query hooks and Zod schemas |
| **pnpm Workspaces** | Monorepo package manager |
| **TypeScript 5.9** | End-to-end type safety across all packages |

---

## Monorepo Structure

```
workspace/
├── artifacts/
│   ├── api-server/              # Express 5 + WebSocket backend
│   │   └── src/
│   │       ├── index.ts         # HTTP server entry — reads PORT, starts server
│   │       ├── app.ts           # Express app — mounts CORS, body parsing, routes
│   │       ├── routes/
│   │       │   ├── chat.ts      # GET /rooms, POST /rooms, GET /rooms/:id/messages, GET /peers
│   │       │   └── health.ts    # GET /healthz
│   │       └── lib/
│   │           └── websocket.ts # WebSocket server — join, message, dm, close logic
│   │
│   └── p2p-chat/                # React 19 + Vite frontend
│       └── src/
│           ├── App.tsx          # Root — QueryClient, Router, AppProvider
│           ├── pages/
│           │   ├── setup.tsx    # Alias entry screen
│           │   └── chat.tsx     # Main chat layout
│           ├── components/
│           │   └── chat/
│           │       ├── sidebar.tsx      # Room list + peer list
│           │       ├── message-area.tsx # Chat messages + DM view
│           │       └── inspector.tsx    # Protocol Inspector panel
│           ├── hooks/
│           │   └── use-websocket.ts  # WebSocket connection, send, reconnect logic
│           └── context/
│               └── app-context.tsx   # Global state — username, rooms, messages, logs
│
├── lib/
│   ├── db/                      # Shared database layer
│   │   ├── src/
│   │   │   ├── index.ts         # Drizzle client (Pool + db instance)
│   │   │   └── schema/
│   │   │       └── chat.ts      # rooms + messages table definitions
│   │   └── drizzle.config.ts    # Drizzle Kit config (reads DATABASE_URL)
│   │
│   ├── api-spec/                # OpenAPI 3.1 spec + Orval codegen config
│   │   └── openapi.yaml         # Single source of truth for the API contract
│   │
│   ├── api-zod/                 # Auto-generated Zod schemas (from OpenAPI)
│   └── api-client-react/        # Auto-generated TanStack Query hooks (from OpenAPI)
│
├── scripts/                     # One-off utility scripts (TypeScript)
├── pnpm-workspace.yaml          # Workspace package roots
├── tsconfig.base.json           # Shared TypeScript config (composite, bundler)
└── tsconfig.json                # Root project references
```

---

## Database Schema

```sql
-- Rooms — where group conversations happen
CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Messages — persisted chat history per room
CREATE TABLE messages (
  id           TEXT PRIMARY KEY,
  room_id      TEXT NOT NULL REFERENCES rooms(id),
  sender_id    TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_ip    TEXT NOT NULL,
  content      TEXT NOT NULL,
  timestamp    TIMESTAMP DEFAULT NOW() NOT NULL,
  protocol     TEXT NOT NULL DEFAULT 'WebSocket',
  frame_type   TEXT NOT NULL DEFAULT 'text',
  payload_size INTEGER NOT NULL DEFAULT 0,
  direction    TEXT NOT NULL DEFAULT 'RECEIVED'
);
```

> Direct messages are **not** persisted — they are routed in-memory, peer-to-peer, to keep the protocol demonstration clean.

---

## WebSocket Frame Types

The Protocol Inspector categorises every frame into one of five types:

| Frame Type | Meaning | Example events |
|---|---|---|
| `WS_HANDSHAKE` | HTTP Upgrade to WebSocket | Initial connection confirmation |
| `CTRL` | Control frame | `join`, `joined`, `peers`, `system`, `peer_left` |
| `DATA` | Chat message | A message sent to a room |
| `DM` | Direct message | Private message routed to one peer |
| `CLOSE` | Connection closed | Client disconnect or error |

---

## REST API Reference

All endpoints are mounted under `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Server health check |
| `GET` | `/api/chat/rooms` | List all rooms with live peer counts |
| `POST` | `/api/chat/rooms` | Create a new room `{ name: string }` |
| `GET` | `/api/chat/rooms/:roomId/messages` | Fetch message history (query: `?limit=50`) |
| `GET` | `/api/peers` | List all currently connected WebSocket peers |

---

## Running Locally — Step by Step

> **You don't need to be a developer.** Follow every step in order and you'll have the app running.

### Prerequisites

You need three things installed before you start.

#### 1. Node.js (v20 or later)

```bash
# Check if you already have it
node --version
# Should print v20.x.x or higher

# If not installed, download from: https://nodejs.org
# Or use nvm (Node Version Manager):
nvm install 20 && nvm use 20
```

#### 2. pnpm (v9 or later)

This project uses **pnpm**, not npm or yarn. Using the wrong package manager will not work.

```bash
# Install pnpm globally
npm install -g pnpm

# Verify
pnpm --version   # Should print 9.x.x or higher
```

#### 3. PostgreSQL (v14 or later)

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu / Debian
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download the installer from: https://www.postgresql.org/download/windows/
# Run the installer, set a password for the postgres user, and start the service.

# Verify PostgreSQL is running
psql --version
```

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-username/p2p-local-network-chat.git
cd p2p-local-network-chat
```

---

### Step 2 — Install All Dependencies

Run this once from the root of the project. It installs everything for all packages in one go.

```bash
pnpm install
```

You should see output like `Done in 30s`. If you see an error saying "use pnpm instead", you ran `npm install` — delete `node_modules` and `package-lock.json`, then run `pnpm install` again.

---

### Step 3 — Set Up the PostgreSQL Database

#### 3a. Create a database and user

Open a PostgreSQL shell:

```bash
# macOS / Linux
psql -U postgres

# Windows (open "SQL Shell (psql)" from Start Menu, press Enter for defaults)
```

Then run these SQL commands inside the shell:

```sql
-- Create a dedicated user for this app
CREATE USER p2pchat WITH PASSWORD 'p2pchat_pass';

-- Create the database
CREATE DATABASE p2pchat OWNER p2pchat;

-- Exit the shell
\q
```

#### 3b. Create your environment file

Create a file named `.env` in the project root:

```bash
# macOS / Linux
touch .env

# Windows (PowerShell)
New-Item .env
```

Open `.env` in any text editor and add this line (replace the values if you chose a different username/password/database name):

```env
DATABASE_URL=postgresql://p2pchat:p2pchat_pass@localhost:5432/p2pchat
```

---

### Step 4 — Create the Database Tables

This command reads your schema and creates the `rooms` and `messages` tables:

```bash
pnpm --filter @workspace/db run push
```

You should see `Changes applied` at the end. If you see a connection error, double-check your `DATABASE_URL` in `.env`.

---

### Step 5 — Seed the Default Rooms

The app expects at least one room to exist. Run this to create the default rooms:

```bash
psql "$DATABASE_URL" -c "
INSERT INTO rooms (id, name, created_at)
VALUES
  ('general', 'General', NOW()),
  ('demo', 'Demo Room', NOW())
ON CONFLICT DO NOTHING;
"
```

> Replace `$DATABASE_URL` with your actual connection string if your shell doesn't read `.env` automatically, e.g.:  
> `psql postgresql://p2pchat:p2pchat_pass@localhost:5432/p2pchat -c "..."`

---

### Step 6 — Configure the Vite Proxy

The frontend needs to know where the backend is running so it can forward API and WebSocket requests.

Open `artifacts/p2p-chat/vite.config.ts` and add a `proxy` block inside the `server` section:

```typescript
server: {
  port,
  host: "0.0.0.0",
  allowedHosts: true,
  // ADD THIS BLOCK:
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
  // END OF ADDED BLOCK
},
```

---

### Step 7 — Start the Backend

Open a **new terminal window** and run:

```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

You should see:

```
[INFO]: WebSocket server initialized on /ws
[INFO]: Server listening with WebSocket support  port: 8080
```

Leave this terminal running.

---

### Step 8 — Start the Frontend

Open **another new terminal window** and run:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev
```

You should see:

```
VITE v7.x.x  ready in 350ms
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

---

### Step 9 — Open the App

Open your browser and go to: **[http://localhost:5173](http://localhost:5173)**

You'll see the **SECURE TERMINAL ACCESS** setup screen. Enter an alias (at least 2 characters) and click **INITIALIZE_CONNECTION**.

---

### Step 10 — Test With Multiple Users

To simulate a real P2P chat:

- Open **two or more browser tabs** (or use different browsers) and go to the same URL.
- Enter a different alias in each tab.
- Watch the peer list update in real time as each connection joins.
- Send messages and watch the **Protocol Inspector** panel at the bottom to see the raw WebSocket frames.

---

## Running on a Local Network (LAN Demo)

This is the fun part — multiple people on the same WiFi connect to one machine.

### On the host machine:

1. Find your local IP address:
   ```bash
   # macOS / Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig | findstr "IPv4"
   ```
   It will look like `192.168.1.42`.

2. Make sure your firewall allows connections on port `5173`:
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)

   # Ubuntu / Debian
   sudo ufw allow 5173/tcp

   # Windows: Search "Windows Defender Firewall" → Advanced Settings → Inbound Rules → New Rule → Port 5173
   ```

3. Start both services as described in Steps 7 and 8 above (Vite already binds to `0.0.0.0`).

### On other machines (same WiFi):

Open a browser and go to: **`http://192.168.1.42:5173`** (replace with the host machine's IP).

Everyone connects and chats in real time. The peer list shows each user's IP address. Open the Protocol Inspector to see the live WebSocket traffic.

---

## Environment Variables

| Variable | Where Used | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `lib/db`, `api-server` | Yes | PostgreSQL connection string |
| `PORT` | `api-server`, `p2p-chat` | Yes | Port the service binds to |
| `BASE_PATH` | `p2p-chat` | Yes | URL prefix for the frontend (use `/` locally) |
| `NODE_ENV` | `api-server` | No | Set to `development` to enable verbose logging |

---

## Development Scripts

Run all commands from the **project root** unless otherwise noted.

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run typecheck` | Type-check the entire monorepo with TypeScript project references |
| `pnpm run build` | Typecheck then build all packages |
| `pnpm --filter @workspace/db run push` | Apply schema changes to PostgreSQL |
| `pnpm --filter @workspace/db run push-force` | Force-apply schema (use if push fails due to drift) |
| `pnpm --filter @workspace/api-server run dev` | Start the backend dev server (with tsx hot reload) |
| `pnpm --filter @workspace/p2p-chat run dev` | Start the frontend Vite dev server |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks and Zod schemas from the OpenAPI spec |

---

## Quick Start Cheat Sheet

Already done it before? Here's the whole thing in one block:

```bash
# Clone and install
git clone https://github.com/your-username/p2p-local-network-chat.git
cd p2p-local-network-chat
pnpm install

# Set up database (one time)
echo "DATABASE_URL=postgresql://p2pchat:p2pchat_pass@localhost:5432/p2pchat" > .env
pnpm --filter @workspace/db run push
psql "$DATABASE_URL" -c "INSERT INTO rooms (id,name,created_at) VALUES ('general','General',NOW()),('demo','Demo Room',NOW()) ON CONFLICT DO NOTHING;"

# Terminal 1 — backend
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — frontend (after adding proxy to vite.config.ts)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev

# Open http://localhost:5173
```

---

## Troubleshooting

### `PORT environment variable is required`

You forgot to prefix the command with `PORT=...`. Every service reads `PORT` from the environment.

```bash
# Correct
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/p2p-chat run dev
```

### `Error: connect ECONNREFUSED 127.0.0.1:5432`

PostgreSQL is not running. Start it:

```bash
# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql
```

### `authentication failed for user "p2pchat"`

The password in `DATABASE_URL` doesn't match PostgreSQL. Fix it:

```bash
psql -U postgres -c "ALTER USER p2pchat WITH PASSWORD 'p2pchat_pass';"
```

### WebSocket won't connect — browser shows `ERROR` status

Check that the Vite proxy is configured (Step 6) and that the backend is running on port 8080.

### Port already in use

```bash
# Find what's using the port
lsof -i :8080   # or :5173

# Kill it
kill -9 <PID>
```

### Users on other devices can't connect

- Confirm Vite is binding to `0.0.0.0` (it is by default in this config).
- Open port `5173` in your firewall (see LAN setup above).
- Make sure all devices are on the **same WiFi network**.

### Messages show in the inspector but not in chat

You haven't joined the room yet — click the room name in the sidebar. The frontend only renders messages whose `roomId` matches the active room.

### DMs disappear after refresh

This is by design. Direct messages are intentionally in-memory only to demonstrate raw WebSocket routing without persistence. Room messages are persisted in PostgreSQL.

---

## Architecture Decision Notes

- **Why two separate processes?** Separating the React frontend from the Express backend makes the architecture explicit — students can see the HTTP proxy layer and understand that the WebSocket server is a distinct process.
- **Why Drizzle ORM?** Drizzle gives fully type-safe SQL queries without hiding what's happening at the database level. Schema changes are visible in TypeScript, not buried in migration files.
- **Why pnpm workspaces?** Sharing the database schema (`@workspace/db`) and API types (`@workspace/api-zod`, `@workspace/api-client-react`) between packages without publishing to npm keeps everything in sync with zero overhead.
- **Why not persist DMs?** The demo value of direct messages is in the protocol — watching a `DM` frame route from one peer to another. Persistence would add complexity without educational benefit.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Typecheck: `pnpm run typecheck`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feat/my-feature`
7. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with WebSockets, PostgreSQL, and a healthy appreciation for network protocols.

</div>

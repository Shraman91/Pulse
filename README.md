# Pulse

An uptime and heartbeat (dead man's switch) monitoring service engineered for developers.

Pulse monitors HTTP services and cron jobs, detects outages using anti-flapping intelligence, dispatches alerts across Discord, Slack, and Telegram, records detailed latency breakdowns (DNS, connect, TLS, TTFB), and publishes public status pages.

---

## Architecture Overview

```
                                      +--------------------------+
                                      |    Next.js Web Client    |
                                      |     (apps/web: 3000)     |
                                      +-------------+------------+
                                                    | (Firebase ID Token)
                                                    v
+------------------------+            +-------------+------------+
|  Cron / Scheduled Job  |-- /ping -->|     Go API Service       |
+------------------------+            |   (cmd/api: port 8080)   |
                                      +-------------+------------+
                                                    | Admin SDK
                                                    v
                                      +-------------+------------+
                                      |   Firestore / Memory DB  |
                                      +-------------+------------+
                                                    ^
                                                    | Atomic Leases
                                      +-------------+------------+
                                      |    Go Worker / Scheduler |
                                      |       (cmd/worker)       |
                                      +-------------+------------+
                                             |             |
                                             v             v
                                     +---------------+ +---------------+
                                     |  HTTP Targets | | Alert Channels|
                                     | (httptrace +  | |(Discord/Slack/|
                                     |  SSRF Guard)  | |   Telegram)   |
                                     +---------------+ +---------------+
```

---

## Design Decisions

### 1. Separate API and Worker Binaries
- **Independent Scaling**: The API (`cmd/api`) is stateless and can scale horizontally or run in serverless containers (e.g. Cloud Run, Fly.io).
- **Continuous Scheduling**: The Worker (`cmd/worker`) requires an uninterrupted event loop for 10-second ticker checks and a persistent 20-goroutine worker pool. Separating them prevents container cold starts from delaying critical monitoring cycles.

### 2. Distributed Leases with Firestore Transactions
To prevent two worker instances from checking the same target simultaneously:
1. Every 10 seconds, the scheduler queries monitors where `paused == false` and `nextCheckAt <= now`.
2. Workers execute an atomic Firestore transaction claiming the monitor by advancing `leaseUntil = now + 60s` and calculating the next execution time with random jitter ($\pm 5\%$).
3. Only the worker that successfully commits the transaction is granted execution rights on that check cycle.

### 3. Strict SSRF Protection
The checker incorporates a zero-trust network dialer (`net.Dialer.Control`). It inspects all resolved IPv4 and IPv6 socket addresses prior to establishing connections, instantly blocking:
- Loopback (`127.0.0.0/8`, `::1`)
- RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Link-local (`169.254.0.0/16`, `fe80::/10`)
- Unique local (`fc00::/7`)
- Cloud metadata services (`169.254.169.254`)

### 4. Anti-Flapping Incident State Machine
- **Down Threshold**: An incident is only opened (and DOWN notification dispatched) after **2 consecutive failures**, preventing alert fatigue from transient network blips.
- **Recovery Threshold**: An active incident is resolved (and RECOVERY notification dispatched) only after **2 consecutive successful checks** or an explicit heartbeat check-in ping.

### 5. Cost-Controlled Hourly Rollups
Firestore's free tier provides 20,000 writes/day. Pulse stays comfortably within limits through three architectural constraints:
- **Success Aggregation**: Healthy checks do **not** write raw check documents. Instead, they atomically increment an hourly rollup bucket (`monitors/{id}/rollups/{yyyy-MM-dd-HH}`).
- **Failures-Only Retention**: Raw check documents (containing deep `httptrace` diagnostic timings) are written only for failed checks and expire via a 30-day TTL.
- **Quota Enforced**: Maximum 10 monitors per user; minimum interval 60 seconds (default 300 seconds).

---

## Heartbeat (Dead Man's Switch) Monitoring

For cron jobs, data pipelines, and backup scripts, create a Heartbeat monitor. Pulse generates a unique ping token.

Append a simple `curl` request to the end of your job or script:

```bash
# In your crontab (e.g. daily backup at 2 AM):
0 2 * * * /opt/scripts/backup.sh && curl -fsS --retry 3 http://localhost:8080/ping/YOUR_PING_TOKEN > /dev/null

# In a bash script:
#!/usr/bin/env bash
python3 process_pipeline.py
curl -sS "http://localhost:8080/ping/YOUR_PING_TOKEN"
```

If the expected check-in does not arrive within `expectedEverySec + graceSec`, Pulse marks the monitor DOWN, creates an incident, and dispatches alerts to Discord, Slack, and Telegram. When your script checks in again, Pulse automatically resolves the outage and dispatches a recovery notification.

---

## Public Status Pages

Pulse enables teams to publish clean, customer-facing status pages:
- **Custom URL Slugs**: Shareable at `/status/{slug}` (e.g. `/status/production-api`).
- **Global Health Beacon**: Visual status indicator (🟢 *All Systems Operational*, 🟡 *Degraded Performance*, 🔴 *Major System Outage*).
- **30-Day Segmented Uptime Bars**: Daily and hourly health bars with interactive tooltips showing check counts and uptime percentages.
- **Past Incident Timeline**: Outage durations, start times, and root cause descriptions.

---

## API Reference

### Public Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/healthz` | Service health & clock check |
| `GET/POST` | `/ping/{token}` | Heartbeat check-in endpoint for cron jobs |
| `GET` | `/api/status-pages/{slug}` | Public status page view with 30d uptime bars and incidents |

### Authenticated Endpoints (Bearer ID Token)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/monitors` | List authenticated user's monitors |
| `POST` | `/api/monitors` | Create HTTP or Heartbeat monitor (max 10) |
| `GET` | `/api/monitors/{id}` | Get monitor details |
| `PATCH` | `/api/monitors/{id}` | Update monitor config, pause/resume, alert channels |
| `DELETE` | `/api/monitors/{id}` | Delete monitor |
| `GET` | `/api/monitors/{id}/stats?range=24h\|7d\|30d` | Fetch latency breakdown & uptime rollups |
| `GET` | `/api/incidents` | List user's active and resolved incident history |
| `POST` | `/api/alerts/test` | Dispatch test notification to Discord/Slack/Telegram |
| `GET` | `/api/status-pages` | List user's status pages |
| `POST` | `/api/status-pages` | Create status page with custom slug and selected monitors |
| `PATCH` | `/api/status-pages/{id}` | Update status page title, slug, visibility, monitors |
| `DELETE` | `/api/status-pages/{id}` | Delete status page |

---

## Repository Structure

```
Pulse/
├── apps/web/                  # Next.js 16 App Router + TypeScript + Tailwind
│   ├── src/app/monitors/      # Dashboard (Monitors, Incidents, Status Pages)
│   ├── src/app/status/[slug]/ # Public status page (SSR / Partial Prerendering)
│   ├── src/components/        # MonitorStatsModal & Telemetry charts (Recharts)
│   └── Dockerfile             # Multi-stage standalone Next.js container
├── services/api/              # Go Monorepo
│   ├── cmd/
│   │   ├── api/main.go        # HTTP API entrypoint
│   │   └── worker/main.go     # Scheduler & worker pool entrypoint
│   └── internal/
│       ├── config/            # Environment configuration & quote trimmer
│       ├── auth/              # Firebase token validator & DevVerifier
│       ├── httpx/             # HTTP helpers & CORS
│       ├── monitors/          # CRUD handlers & rollup stats
│       ├── heartbeat/         # /ping/{token} endpoint
│       ├── scheduler/         # Distributed lease loop & 20-worker pool
│       ├── checker/           # httptrace collector & zero-trust SSRF dialer
│       ├── incidents/         # Anti-flapping state machine (2 failures/successes)
│       ├── alerts/            # Discord, Slack, and Telegram dispatchers
│       ├── statuspage/        # Status page handlers & slug validation
│       └── store/             # Firestore & in-memory store abstraction
├── Dockerfile.api             # Minimal production Alpine container for API
├── Dockerfile.worker          # Minimal production Alpine container for Worker
├── docker-compose.yml         # Container orchestration (API, Worker, Web)
├── firestore.rules            # Security rules (client writes disabled)
├── firestore.indexes.json     # Composite query indexes
├── .env.example               # Environment variables template
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- [Go 1.22+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)

### 2. Environment Setup
Create `.env` in the root of the project:
```bash
cp .env.example .env
```
*(By default, `STORE_TYPE=memory` is set, allowing immediate local development without requiring Google Cloud keys).*

### 3. Running Locally
Run all three services (API on `:8080`, Worker scheduler, and Web on `:3000`) with a single command:
```powershell
npm run dev
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **Go API Server**: [http://localhost:8080](http://localhost:8080)
- **Health Check**: [http://localhost:8080/healthz](http://localhost:8080/healthz)

### 4. Running with Docker Compose
To run the full stack in isolated production containers:
```bash
docker compose up --build
```

### 5. Running Tests & Quality Checks
```bash
# Run all Go tests
cd services/api && go test -count=1 ./...

# Run Go Vet
cd services/api && go vet ./...

# Run Next.js production build
npm --prefix apps/web run build
```

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
                                      |   Firestore NoSQL Store  |
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
The checker incorporates a zero-trust network dialer (`net.Dialer.Control`). It inspects all resolved IPv4 and IPv6 socket addresses prior to establishing connections, instantly blocking loopback (`127.0.0.0/8`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`, `fe80::/10`), unique local (`fc00::/7`), and cloud metadata services (`169.254.169.254`).

### 4. Firestore Cost Capping
Firestore's free tier provides 20,000 writes/day. Pulse stays comfortably within free limits through three architectural constraints:
- **Success Aggregation**: Healthy checks do **not** write raw check documents. Instead, they increment an hourly rollup counter (`monitors/{id}/rollups/{yyyyMMddHH}`).
- **Failures-Only Retention**: Raw check documents (containing deep `httptrace` diagnostic timings) are written only for failed checks and expire via a 30-day TTL.
- **Default 5-Minute Intervals**: Minimum check interval is 60 seconds (default 300 seconds), capped at 10 monitors per user.

---

## Repository Structure

```
Pulse/
├── apps/web/                  # Next.js 15 App Router + TypeScript + Tailwind
├── services/api/              # Go Monorepo
│   ├── cmd/
│   │   ├── api/main.go        # HTTP API entrypoint
│   │   └── worker/main.go     # Scheduler & worker pool entrypoint
│   └── internal/
│       ├── config/            # Environment configuration
│       ├── auth/              # Firebase ID token validation middleware
│       ├── httpx/             # HTTP helpers & CORS
│       ├── monitors/          # CRUD handlers & rollup stats
│       ├── heartbeat/         # /ping/{token} endpoint
│       ├── scheduler/         # Distributed lease loop & worker pool
│       ├── checker/           # httptrace collector & SSRF-safe dialer
│       ├── incidents/         # Anti-flapping state machine
│       ├── alerts/            # Discord, Slack, and Telegram dispatchers
│       ├── rollup/            # Hourly aggregates aggregator
│       └── store/             # Firestore & in-memory store abstraction
├── firestore.rules            # Security rules (browser writes blocked)
├── firestore.indexes.json     # Composite query indexes
├── firebase.json              # Firebase configuration
├── Makefile                   # Developer task automation
├── .env.example               # Environment variables template
└── README.md
```

---

## Quick Start

### Prerequisites
- [Go 1.22+](https://go.dev/dl/)
- [Node.js 18+](https://nodejs.org/)

### Setup
1. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   cd apps/web && npm install
   ```

### Running Locally
To launch the API, Worker, and Next.js frontend concurrently:
```bash
make dev
# or on Windows PowerShell:
npm run dev
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **Go API Server**: [http://localhost:8080](http://localhost:8080)
- **Health Check**: [http://localhost:8080/healthz](http://localhost:8080/healthz)

### Running Tests & Linting
```bash
make test
make lint
```

# SentinelUI — Intrusion Detection Visualization Platform

React frontend for the SentinelIDS AI-powered network intrusion detection backend.

## Features

- **Dashboard** — Live stats, attack timeline, threat distribution
- **Predict Playground** — Real-time single-flow classification with explainability
- **Batch Upload** — CSV upload for bulk analysis with export
- **Attack Simulator** — Simulate DDoS, port scans, brute force attacks live
- **Analytics** — Attack distribution, confidence histograms, hourly trends
- **Forensics** — Investigation panel with feature inspection and report export

## Quick Start

### Local development

```bash
npm install
cp .env.example .env
# Edit .env to set VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000

### With Docker (recommended)

```bash
# From the SentinelIDS root directory with backend already running:
cd frontend
docker build -t sentinelui .
docker run -p 3000:80 sentinelui
```

### Mock mode (no backend needed)

```bash
VITE_MOCK_MODE=true npm run dev
```

### Production build

```bash
npm run build
# Output in dist/
```

### Run tests

```bash
npm test
```

### Docker Compose (full stack)

From the backend directory:
```bash
docker compose up
```

The frontend docker-compose.override.yml connects to the backend network automatically.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend URL |
| `VITE_MOCK_MODE` | `false` | Use mock API instead of backend |
| `VITE_POLL_INTERVAL` | `5000` | Stats polling interval (ms) |

## Tech Stack

React · TypeScript · Vite · TailwindCSS · Framer Motion · TanStack Query · Zustand · Recharts · Leaflet · React Hook Form · Zod · MSW

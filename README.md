# SentinelIDS — AI-Powered Network Intrusion Detection System

End-to-end intrusion detection system combining a neural classifier (93.4% accuracy),
autoencoder anomaly detection, and signature-based rules.

## Architecture
```
SentinelIDS/
├── backend/       FastAPI + PyTorch + PostgreSQL
└── frontend/      React + TypeScript + Vite
```

## Quick Start

### Full stack with Docker (recommended)
```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Train the model first (required before running API)
```bash
# Place datasets in backend/datasets/
docker compose --profile train up trainer
```

### Local development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Datasets

Place dataset files in `backend/datasets/`:
```
backend/datasets/
├── cicids2017/    *.csv or *.parquet
├── cicids2018/    *.csv or *.parquet
├── unsw_nb15/     *.csv or *.parquet
└── nsl_kdd/       *.csv, *.txt or *.arff
```

## Model Performance

| Metric | Score |
|---|---|
| Overall Accuracy | 93.4% |
| BENIGN F1 | 0.97 |
| DDOS F1 | 0.96 |
| BRUTE_FORCE F1 | 0.94 |
| Training Data | 9.6M flows (4 datasets) |
| Attack Classes | 17 |

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | System health + model status |
| `/predict` | POST | Single flow classification |
| `/predict/batch` | POST | Bulk CSV or JSON prediction |
| `/stats` | GET | Aggregated detection statistics |

## Tech Stack

**Backend:** FastAPI, PyTorch, scikit-learn, PostgreSQL, SQLAlchemy, Docker

**Frontend:** React, TypeScript, Vite, TailwindCSS, Framer Motion, Recharts, Leaflet
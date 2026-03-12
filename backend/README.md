# SentinelIDS — AI Intrusion Detection Platform

Production-ready backend combining neural network classification, autoencoder anomaly detection, and signature-based threat scanning.

## Supported Datasets
| Dataset | Folder |
|---|---|
| CIC-IDS2017 | `datasets/cicids2017/` |
| UNSW-NB15 | `datasets/unsw_nb15/` |
| NSL-KDD | `datasets/nsl_kdd/` |
| CIC-IDS2018 | `datasets/cicids2018/` |

## Quick Start

```bash
# 1. Install
pip install -r requirements.txt

# 2. Configure
cp .env.example .env

# 3. Place dataset files in datasets/<name>/
#    - CICIDS 2017/2018: .csv or .parquet
#    - UNSW-NB15: .csv or .parquet
#    - NSL-KDD: .txt/.csv (and many .arff variants)

# 4. Train
python training/training_pipeline.py

# 5. Run API
uvicorn app.main:app --reload
```

Swagger UI: http://localhost:8000/docs

## Docker
```bash
# Start API + Postgres (does NOT train)
docker compose up --build

# Train models (run once). This writes to ./models on your host.
docker compose --profile train run --rm trainer
```

## GPU training (Docker)
- Training uses GPU automatically if PyTorch has CUDA and Docker can access your NVIDIA GPU.
- On Windows, this typically requires Docker Desktop with WSL2 and NVIDIA GPU support enabled.

To build the container with CUDA-enabled PyTorch wheels, set in `.env`:

```bash
TORCH_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cu121
```

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Service + model status |
| `/predict` | POST | Single traffic record inference |
| `/predict/batch` | POST | Batch (JSON or CSV upload) |
| `/stats` | GET | Aggregate prediction statistics |

## Threat Scoring
```
Score = 0.6 × classifier_confidence
      + 0.3 × anomaly_score
      + 0.1 × signature_hit

Severity: 0-30 low | 31-60 medium | 61-80 high | 81-100 critical
```

## Testing
```bash
pytest tests/ -v
```

## Retraining
Add/replace CSVs in `/datasets` then rerun `python training/training_pipeline.py`.

## builds and then trains
docker compose --profile train up --build trainer

##docker container stop commands: 
docker compose --profile train down
docker compose down
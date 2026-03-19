"""FastAPI route handlers: /health, /predict, /predict/batch, /stats."""
from __future__ import annotations
import csv, io, logging
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.schemas import (BatchPredictionResponse, BatchRequest, HealthResponse,
                              PredictionResponse, StatsResponse, TrafficFeatures)
from app.core.database import get_db
from app.core.models import PredictionLog
from app.ml.model_loader import get_model_bundle
from app.rules.signature_engine import get_signature_engine
from app.services.prediction_service import PredictionService
from app.utils.ip_utils import get_client_ip

router = APIRouter()
logger = logging.getLogger(__name__)

def get_service() -> PredictionService:
    b = get_model_bundle()
    if not b.loaded:
        raise HTTPException(503, "Models not loaded. Run the training pipeline first.")
    return PredictionService(bundle=b, sig_engine=get_signature_engine())

@router.get("/health", response_model=HealthResponse, tags=["system"])
def health():
    b = get_model_bundle()
    return HealthResponse(status="ok" if b.loaded else "degraded",
                          models_loaded=b.loaded,
                          classifier_ready=b.classifier is not None,
                          autoencoder_ready=b.autoencoder is not None,
                          version=b.version)

@router.post("/predict", response_model=PredictionResponse, tags=["inference"])
def predict(request: Request, features: TrafficFeatures,
            db: Session = Depends(get_db), svc: PredictionService = Depends(get_service)):
    return svc.predict_one(features, db=db, client_ip=get_client_ip(request))

@router.post("/predict/batch", response_model=BatchPredictionResponse, tags=["inference"])
async def predict_batch(request: Request, db: Session = Depends(get_db),
                        svc: PredictionService = Depends(get_service)):
    ct = request.headers.get("content-type","")
    if "application/json" in ct:
        body = await request.json(); records = BatchRequest(**body).records
    elif "multipart/form-data" in ct:
        form = await request.form(); file: UploadFile = form.get("file")
        if not file: raise HTTPException(400, "'file' field missing")
        text = (await file.read()).decode("utf-8","replace")
        records = _parse_csv(text)
    else:
        try: body = await request.json(); records = BatchRequest(**body).records
        except: raise HTTPException(415, "Use application/json or multipart CSV upload")
    results = svc.predict_batch(records, db=db, client_ip=get_client_ip(request))
    return BatchPredictionResponse(total=len(results), results=results)

def _parse_csv(text: str):
    from app.api.schemas import TrafficFeatures
    STRING_FIELDS = {"url","body","header"}
    records = []
    for row in csv.DictReader(io.StringIO(text)):
        d = {}
        for k, v in row.items():
            k = k.strip()
            if k in STRING_FIELDS: d[k] = v.strip() or None
            else:
                try: d[k] = float(v) if v.strip() else None
                except: pass
        try: records.append(TrafficFeatures(**d))
        except Exception as e: logger.warning("Skipping bad CSV row: %s", e)
    if not records: raise HTTPException(400, "No valid CSV records")
    return records

@router.get("/stats", response_model=StatsResponse, tags=["system"])
def stats(db: Session = Depends(get_db)):
    total   = db.query(func.count(PredictionLog.id)).scalar() or 0
    att_rows = db.query(PredictionLog.predicted_attack, func.count(PredictionLog.id))                  .group_by(PredictionLog.predicted_attack).all()
    sev_rows = db.query(PredictionLog.severity, func.count(PredictionLog.id))                  .group_by(PredictionLog.severity).all()
    anom = db.query(func.count(PredictionLog.id)).filter(PredictionLog.anomaly_score > 0.5).scalar() or 0
    return StatsResponse(total_requests=total,
                         attack_distribution={r[0]:r[1] for r in att_rows},
                         severity_counts={r[0]:r[1] for r in sev_rows},
                         anomaly_rate=round(anom/max(total,1),4))

@router.delete("/stats/reset", tags=["system"])
def reset_stats(db: Session = Depends(get_db)):
    """Delete all prediction logs — resets dashboard to zero."""
    deleted = db.query(PredictionLog).delete()
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Reset failed: {e}")
    return {"deleted": deleted, "message": "All prediction logs cleared"}
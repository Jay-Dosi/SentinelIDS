"""Orchestrates full prediction pipeline."""
from __future__ import annotations
import json, logging, time
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.api.schemas import PredictionResponse, TrafficFeatures
from app.config import settings
from app.core.models import PredictionLog
from app.ml.anomaly_detector import run_anomaly_detector
from app.ml.classifier import run_classifier
from app.ml.model_loader import ModelBundle
from app.ml.threat_scoring import compute_threat_score
from app.rules.signature_engine import SignatureEngine
from app.utils.feature_vector import build_feature_vector

logger = logging.getLogger(__name__)

class PredictionService:
    def __init__(self, bundle: ModelBundle, sig_engine: SignatureEngine):
        self.bundle = bundle; self.sig_engine = sig_engine

    def predict_one(self, features: TrafficFeatures, db=None, client_ip="unknown") -> PredictionResponse:
        t0 = time.perf_counter()
        vec   = build_feature_vector(features.to_feature_dict(), self.bundle.scaler)
        label, conf, _ = run_classifier(vec, self.bundle)
        anom, is_anom  = run_anomaly_detector(vec, self.bundle)
        sig   = self.sig_engine.scan_fields(features.payload_fields())
        score, sev = compute_threat_score(conf, anom, sig.matched)
        sig_rule = f"{sig.rule_id}: {sig.rule_name}" if sig.matched else None
        logger.info("ip=%s attack=%s conf=%.3f anom=%.3f score=%.1f sev=%s sig=%s lat=%.1fms",
                    client_ip, label, conf, anom, score, sev, sig_rule or "none",
                    (time.perf_counter()-t0)*1000)
        if db:
            log = PredictionLog(
                timestamp=datetime.now(tz=timezone.utc), client_ip=client_ip,
                features_json=json.dumps(features.to_feature_dict()),
                predicted_attack=label, confidence=conf, anomaly_score=anom,
                threat_score=score, severity=sev, signature_rule=sig_rule,
                model_version=self.bundle.version)
            db.add(log)
            try: db.commit()
            except Exception as e: logger.error("DB commit failed: %s", e); db.rollback()
        return PredictionResponse(
            predicted_attack=label, confidence=round(conf,4), anomaly_score=round(anom,4),
            is_anomaly=is_anom, threat_score=score, severity=sev,
            signature_matched=sig.matched, signature_rule=sig_rule,
            model_version=self.bundle.version)

    def predict_batch(self, records, db=None, client_ip="unknown"):
        return [self.predict_one(r, db=db, client_ip=client_ip) for r in records]

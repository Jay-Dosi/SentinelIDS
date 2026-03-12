"""Composite threat scoring: combines classifier, anomaly, and signature signals."""
from __future__ import annotations
from app.config import settings

SEVERITY = [(81,"critical"),(61,"high"),(31,"medium"),(0,"low")]

def compute_threat_score(classifier_confidence: float, anomaly_score: float,
                         signature_detected: bool) -> tuple[float,str]:
    """Return (threat_score 0-100, severity label)."""
    raw = (settings.classifier_weight * classifier_confidence
           + settings.anomaly_weight   * anomaly_score
           + settings.signature_weight * (1.0 if signature_detected else 0.0))
    score = round(max(0.0, min(100.0, raw * 100.0)), 2)
    return score, _severity(score)

def _severity(score: float) -> str:
    for thr, lbl in SEVERITY:
        if score >= thr: return lbl
    return "low"

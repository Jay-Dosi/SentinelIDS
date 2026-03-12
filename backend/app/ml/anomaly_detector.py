"""Anomaly detector inference."""
from __future__ import annotations
import numpy as np, torch
from app.ml.model_loader import ModelBundle

def run_anomaly_detector(feature_vector: np.ndarray, bundle: ModelBundle):
    if bundle.autoencoder is None: raise RuntimeError("Autoencoder not loaded")
    x = torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)
    raw = float(bundle.autoencoder.reconstruction_error(x).item())
    normalised = min(raw / max(bundle.anomaly_threshold * 3, 1e-8), 1.0)
    return normalised, raw > bundle.anomaly_threshold

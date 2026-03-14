"""Anomaly detector inference."""
from __future__ import annotations
import logging
import numpy as np, torch
from app.ml.model_loader import ModelBundle

logger = logging.getLogger(__name__)

def run_anomaly_detector(feature_vector: np.ndarray, bundle: ModelBundle):
    if bundle.autoencoder is None: raise RuntimeError("Autoencoder not loaded")
    x = torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)
    raw = float(bundle.autoencoder.reconstruction_error(x).item())
    # Use 50x threshold as normalization ceiling — accounts for real-world
    # feature variance beyond the training distribution
    normalised = min(raw / max(bundle.anomaly_threshold * 50, 1e-8), 1.0)
    is_anomaly = normalised > 0.5
    return normalised, is_anomaly
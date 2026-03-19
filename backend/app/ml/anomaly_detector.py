"""Anomaly detector inference."""
from __future__ import annotations
import math
import logging
import numpy as np
import torch
from app.ml.model_loader import ModelBundle

logger = logging.getLogger(__name__)

def run_anomaly_detector(feature_vector: np.ndarray, bundle: ModelBundle):
    if bundle.autoencoder is None:
        raise RuntimeError("Autoencoder not loaded")

    # Clamp scaled features to ±5 std devs before passing to autoencoder
    x = torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)
    x = torch.clamp(x, -5.0, 5.0)

    with torch.no_grad():
        raw = float(bundle.autoencoder.reconstruction_error(x).item())

    threshold = bundle.anomaly_threshold

    logger.info("ANOMALY raw=%.6f threshold=%.6f", raw, threshold)

    if raw <= threshold:
        normalised = (raw / threshold) * 0.4
    else:
        ratio = raw / threshold
        normalised = 0.4 + (math.log1p(ratio - 1) / math.log1p(99)) * 0.6
        normalised = min(normalised, 1.0)

    is_anomaly = raw > threshold
    return round(normalised, 4), is_anomaly
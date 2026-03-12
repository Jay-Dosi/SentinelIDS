"""Build scaled feature vectors from API request dicts."""
from __future__ import annotations
import logging
import numpy as np
from sklearn.preprocessing import StandardScaler
from training.dataset_loader import UNIFIED_FEATURES

logger = logging.getLogger(__name__)

def build_feature_vector(feature_dict: dict, scaler: StandardScaler) -> np.ndarray:
    raw = np.zeros(len(UNIFIED_FEATURES), dtype=np.float32)
    for i, feat in enumerate(UNIFIED_FEATURES):
        v = feature_dict.get(feat)
        if v is not None:
            try: raw[i] = float(v)
            except: logger.warning("Bad value for '%s': %r", feat, v)
    return scaler.transform(raw.reshape(1,-1))[0].astype(np.float32)

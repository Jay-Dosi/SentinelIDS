"""Classifier inference."""
from __future__ import annotations
import numpy as np
import torch, torch.nn.functional as F
from app.ml.model_loader import ModelBundle

def run_classifier(feature_vector: np.ndarray, bundle: ModelBundle):
    if bundle.classifier is None: raise RuntimeError("Classifier not loaded")
    x = torch.tensor(feature_vector, dtype=torch.float32).unsqueeze(0)
    with torch.no_grad():
        probs = F.softmax(bundle.classifier(x), dim=1).squeeze(0).numpy()
    idx = int(np.argmax(probs))
    return bundle.index_to_label.get(idx, f"class_{idx}"), float(probs[idx]), probs

"""Preprocessing: scaling, train/test split, serialisation helpers."""
from __future__ import annotations
import json, logging, pickle
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from training.dataset_loader import UNIFIED_FEATURES, LABEL_COLUMN

logger = logging.getLogger(__name__)

def preprocess(df, scaler=None, fit=True):
    X = df[UNIFIED_FEATURES].values.astype(np.float32)
    y = df[LABEL_COLUMN].values.astype(np.int64)
    if scaler is None: scaler = StandardScaler()
    X = scaler.fit_transform(X) if fit else scaler.transform(X)
    return X, y, scaler

def split_data(X, y, test_size=0.2, random_state=42):
    return train_test_split(X, y, test_size=test_size, random_state=random_state, stratify=y)

def get_benign_mask(y: np.ndarray, label_map: dict) -> np.ndarray:
    idx = label_map.get("BENIGN", label_map.get("NORMAL", -1))
    return y == idx

def save_scaler(scaler, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path,"wb") as f: pickle.dump(scaler,f)
    logger.info("Scaler saved to %s", path)

def load_scaler(path: Path):
    with open(path,"rb") as f: return pickle.load(f)

def save_label_encoder(label_map: dict, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path,"w") as f: json.dump(label_map,f,indent=2)

def load_label_encoder(path: Path) -> dict:
    with open(path) as f: return json.load(f)

"""Singleton model bundle: load all artefacts once at startup."""
from __future__ import annotations
import json, logging, pickle
from pathlib import Path
import torch
from sklearn.preprocessing import StandardScaler
from training.train_classifier  import IDSClassifier
from training.train_autoencoder import IDSAutoencoder

logger = logging.getLogger(__name__)

class ModelBundle:
    def __init__(self):
        self.classifier: IDSClassifier | None = None
        self.autoencoder: IDSAutoencoder | None = None
        self.scaler: StandardScaler | None = None
        self.label_map: dict[str,int] = {}
        self.index_to_label: dict[int,str] = {}
        self.anomaly_threshold: float = 0.5
        self.feature_names: list[str] = []
        self.version: str = "1.0.0"
        self.loaded: bool = False

    def load(self, classifier_path, autoencoder_path, scaler_path, label_encoder_path, metadata_path):
        ok = True
        try:
            ckpt = torch.load(classifier_path, map_location="cpu")
            self.classifier = IDSClassifier(ckpt["input_dim"], ckpt["num_classes"])
            self.classifier.load_state_dict(ckpt["model_state_dict"]); self.classifier.eval()
            logger.info("Classifier loaded")
        except Exception as e: logger.error("Classifier load failed: %s", e); ok = False
        try:
            ckpt = torch.load(autoencoder_path, map_location="cpu")
            self.autoencoder = IDSAutoencoder(ckpt["input_dim"])
            self.autoencoder.load_state_dict(ckpt["model_state_dict"]); self.autoencoder.eval()
            self.anomaly_threshold = float(ckpt.get("threshold", 0.5))
            logger.info("Autoencoder loaded (threshold=%.4f)", self.anomaly_threshold)
        except Exception as e: logger.error("Autoencoder load failed: %s", e); ok = False
        try:
            with open(scaler_path,"rb") as f: self.scaler = pickle.load(f)
            logger.info("Scaler loaded")
        except Exception as e: logger.error("Scaler load failed: %s", e); ok = False
        try:
            with open(label_encoder_path) as f: self.label_map = json.load(f)
            self.index_to_label = {v:k for k,v in self.label_map.items()}
        except Exception as e: logger.error("Label encoder load failed: %s", e); ok = False
        try:
            with open(metadata_path) as f: meta = json.load(f)
            self.feature_names = meta.get("feature_names",[])
            self.version = meta.get("version","1.0.0")
        except Exception as e: logger.warning("Metadata not loaded: %s", e)
        self.loaded = ok; return ok

_bundle: ModelBundle | None = None

def get_model_bundle() -> ModelBundle:
    global _bundle
    if _bundle is None: _bundle = ModelBundle()
    return _bundle

def load_models(classifier_path, autoencoder_path, scaler_path, label_encoder_path, metadata_path):
    b = get_model_bundle()
    b.load(classifier_path, autoencoder_path, scaler_path, label_encoder_path, metadata_path)
    return b

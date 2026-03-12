"""Application settings from environment / .env."""
from __future__ import annotations
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    app_name: str = "SentinelIDS"
    app_version: str = "1.0.0"
    debug: bool = False
    database_url: str = "sqlite:///./sentinelids.db"
    models_dir: Path = Path("models")
    datasets_dir: Path = Path("datasets")
    classifier_weight: float = 0.6
    anomaly_weight: float = 0.3
    signature_weight: float = 0.1
    classifier_filename: str = "ids_classifier.pt"
    autoencoder_filename: str = "anomaly_autoencoder.pt"
    scaler_filename: str = "scaler.pkl"
    label_encoder_filename: str = "label_encoder.json"
    metadata_filename: str = "metadata.json"

    @property
    def classifier_path(self)  -> Path: return self.models_dir / self.classifier_filename
    @property
    def autoencoder_path(self) -> Path: return self.models_dir / self.autoencoder_filename
    @property
    def scaler_path(self)      -> Path: return self.models_dir / self.scaler_filename
    @property
    def label_encoder_path(self) -> Path: return self.models_dir / self.label_encoder_filename
    @property
    def metadata_path(self)    -> Path: return self.models_dir / self.metadata_filename

settings = Settings()

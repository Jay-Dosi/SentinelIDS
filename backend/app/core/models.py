"""SQLAlchemy ORM: prediction_logs table."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class PredictionLog(Base):
    __tablename__ = "prediction_logs"
    id:               Mapped[int]       = mapped_column(Integer, primary_key=True, index=True)
    timestamp:        Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())
    client_ip:        Mapped[str|None]  = mapped_column(String(64), nullable=True)
    features_json:    Mapped[str|None]  = mapped_column(Text, nullable=True)
    predicted_attack: Mapped[str]       = mapped_column(String(128))
    confidence:       Mapped[float]     = mapped_column(Float)
    anomaly_score:    Mapped[float]     = mapped_column(Float)
    threat_score:     Mapped[float]     = mapped_column(Float)
    severity:         Mapped[str]       = mapped_column(String(16))
    signature_rule:   Mapped[str|None]  = mapped_column(String(256), nullable=True)
    model_version:    Mapped[str]       = mapped_column(String(64), default="1.0.0")

    def to_dict(self):
        return {"id":self.id,"timestamp":self.timestamp.isoformat() if self.timestamp else None,
                "client_ip":self.client_ip,"predicted_attack":self.predicted_attack,
                "confidence":self.confidence,"anomaly_score":self.anomaly_score,
                "threat_score":self.threat_score,"severity":self.severity,
                "signature_rule":self.signature_rule,"model_version":self.model_version}

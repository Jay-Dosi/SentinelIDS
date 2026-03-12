"""Pydantic request/response schemas."""
from __future__ import annotations
from pydantic import BaseModel, Field
from training.dataset_loader import UNIFIED_FEATURES

class TrafficFeatures(BaseModel):
    flow_duration:      float | None = Field(None, ge=0)
    packet_count:       float | None = Field(None, ge=0)
    byte_count:         float | None = Field(None, ge=0)
    fwd_packets:        float | None = Field(None, ge=0)
    bwd_packets:        float | None = Field(None, ge=0)
    flow_bytes_per_sec: float | None = Field(None, ge=0)
    avg_packet_size:    float | None = Field(None, ge=0)
    syn_flag_count:     float | None = Field(None, ge=0)
    ack_flag_count:     float | None = Field(None, ge=0)
    rst_flag_count:     float | None = Field(None, ge=0)
    payload_length:     float | None = Field(None, ge=0)
    payload_entropy:    float | None = Field(None, ge=0)
    url:    str | None = None
    body:   str | None = None
    header: str | None = None

    def to_feature_dict(self): return {f: getattr(self,f) for f in UNIFIED_FEATURES}
    def payload_fields(self):  return {"url":self.url,"body":self.body,"header":self.header}

class BatchRequest(BaseModel):
    records: list[TrafficFeatures] = Field(..., min_length=1, max_length=10_000)

class PredictionResponse(BaseModel):
    predicted_attack: str
    confidence: float
    anomaly_score: float
    is_anomaly: bool
    threat_score: float
    severity: str
    signature_matched: bool
    signature_rule: str | None
    model_version: str

class BatchPredictionResponse(BaseModel):
    total: int
    results: list[PredictionResponse]

class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    classifier_ready: bool
    autoencoder_ready: bool
    version: str

class StatsResponse(BaseModel):
    total_requests: int
    attack_distribution: dict[str, int]
    severity_counts: dict[str, int]
    anomaly_rate: float

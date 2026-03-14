"""Pydantic request/response schemas."""
from __future__ import annotations
from pydantic import BaseModel, Field
from training.dataset_loader import UNIFIED_FEATURES

class TrafficFeatures(BaseModel):
    # Flow timing
    flow_duration:          float | None = Field(None, ge=0)
    flow_iat_mean:          float | None = Field(None, ge=0)
    flow_iat_std:           float | None = Field(None, ge=0)
    # Packet counts
    packet_count:           float | None = Field(None, ge=0)
    fwd_packets:            float | None = Field(None, ge=0)
    bwd_packets:            float | None = Field(None, ge=0)
    fwd_bwd_ratio:          float | None = Field(None, ge=0)
    # Byte counts
    byte_count:             float | None = Field(None, ge=0)
    fwd_bytes:              float | None = Field(None, ge=0)
    bwd_bytes:              float | None = Field(None, ge=0)
    # Rates
    flow_bytes_per_sec:     float | None = Field(None, ge=0)
    flow_packets_per_sec:   float | None = Field(None, ge=0)
    # Packet size stats
    avg_packet_size:        float | None = Field(None, ge=0)
    fwd_packet_size_mean:   float | None = Field(None, ge=0)
    bwd_packet_size_mean:   float | None = Field(None, ge=0)
    # TCP flags
    syn_flag_count:         float | None = Field(None, ge=0)
    ack_flag_count:         float | None = Field(None, ge=0)
    rst_flag_count:         float | None = Field(None, ge=0)
    fin_flag_count:         float | None = Field(None, ge=0)
    psh_flag_count:         float | None = Field(None, ge=0)
    # Payload
    payload_length:         float | None = Field(None, ge=0)
    payload_entropy:        float | None = Field(None, ge=0)
    # Header
    fwd_header_length:      float | None = Field(None, ge=0)
    bwd_header_length:      float | None = Field(None, ge=0)
    # Optional text fields
    url:    str | None = None
    body:   str | None = None
    header: str | None = None

    def to_feature_dict(self): return {f: getattr(self, f) for f in UNIFIED_FEATURES}
    def payload_fields(self):  return {"url": self.url, "body": self.body, "header": self.header}

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
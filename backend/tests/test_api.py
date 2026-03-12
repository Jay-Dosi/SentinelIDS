"""API endpoint tests with mocked ML dependencies."""
from __future__ import annotations
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.ml.model_loader import ModelBundle

def _mock_bundle():
    b = ModelBundle()
    b.loaded = True; b.version = "test"; b.label_map = {"BENIGN":0,"DOS":1}
    b.index_to_label = {0:"BENIGN",1:"DOS"}; b.anomaly_threshold = 0.5
    b.feature_names = ["flow_duration","packet_count","byte_count","fwd_packets",
                       "bwd_packets","flow_bytes_per_sec","avg_packet_size",
                       "syn_flag_count","ack_flag_count","rst_flag_count",
                       "payload_length","payload_entropy"]
    sc = MagicMock(); sc.transform.return_value = np.zeros((1,12),dtype=np.float32); b.scaler = sc
    import torch
    clf = MagicMock(); logits = torch.zeros(1,2); logits[0,0]=5.0; clf.return_value = logits; b.classifier = clf
    ae = MagicMock(); ae.reconstruction_error.return_value = torch.tensor([0.01]); b.autoencoder = ae
    return b

@pytest.fixture()
def client():
    mb = _mock_bundle()
    with patch("app.api.routes.get_model_bundle", return_value=mb), \
         patch("app.ml.classifier.run_classifier", return_value=("BENIGN",0.95,np.array([0.95,0.05]))), \
         patch("app.ml.anomaly_detector.run_anomaly_detector", return_value=(0.1,False)), \
         patch("app.core.database.init_db"), \
         patch("app.ml.model_loader.load_models", return_value=mb):
        from app.main import app
        with TestClient(app) as c: yield c

def test_health(client):
    r = client.get("/health"); assert r.status_code == 200
    d = r.json(); assert "status" in d; assert "models_loaded" in d

def test_predict_basic(client):
    r = client.post("/predict", json={"flow_duration":100.0,"packet_count":10.0})
    assert r.status_code == 200
    d = r.json(); assert "predicted_attack" in d; assert 0 <= d["threat_score"] <= 100

def test_predict_all_features(client):
    payload = {f:1.0 for f in ["flow_duration","packet_count","byte_count","fwd_packets",
               "bwd_packets","flow_bytes_per_sec","avg_packet_size","syn_flag_count",
               "ack_flag_count","rst_flag_count","payload_length","payload_entropy"]}
    r = client.post("/predict", json=payload); assert r.status_code == 200

def test_predict_empty(client):
    r = client.post("/predict", json={}); assert r.status_code == 200

def test_batch_json(client):
    r = client.post("/predict/batch",
                    json={"records":[{"flow_duration":1.0},{"flow_duration":2.0}]},
                    headers={"Content-Type":"application/json"})
    assert r.status_code == 200; d = r.json()
    assert d["total"] == 2; assert len(d["results"]) == 2

def test_stats(client):
    r = client.get("/stats"); assert r.status_code == 200
    d = r.json(); assert "total_requests" in d; assert "attack_distribution" in d

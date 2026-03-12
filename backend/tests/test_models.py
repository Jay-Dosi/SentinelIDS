"""Unit tests: threat scoring, signature engine, model architectures."""
from __future__ import annotations
import numpy as np
import pytest
import torch
from app.ml.threat_scoring import compute_threat_score, _severity
from app.rules.signature_engine import SignatureEngine
from training.train_classifier  import IDSClassifier
from training.train_autoencoder import IDSAutoencoder

class TestThreatScoring:
    def test_range(self):
        for c in [0.0,0.5,1.0]:
            for a in [0.0,0.5,1.0]:
                for s in [True,False]:
                    score,_ = compute_threat_score(c,a,s)
                    assert 0 <= score <= 100

    def test_high_conf_high_score(self):
        score,sev = compute_threat_score(1.0,1.0,True)
        assert score >= 80; assert sev in ("high","critical")

    def test_zero_is_low(self):
        score,sev = compute_threat_score(0.0,0.0,False)
        assert score == 0.0; assert sev == "low"

    def test_severity_thresholds(self):
        assert _severity(0)   == "low"
        assert _severity(31)  == "medium"
        assert _severity(61)  == "high"
        assert _severity(81)  == "critical"
        assert _severity(100) == "critical"

    def test_sig_boosts_score(self):
        s1,_ = compute_threat_score(0.5,0.5,False)
        s2,_ = compute_threat_score(0.5,0.5,True)
        assert s2 > s1

class TestSignatureEngine:
    @pytest.fixture(autouse=True)
    def eng(self): self.e = SignatureEngine()

    def test_sql_union(self):
        m = self.e.scan("UNION SELECT * FROM users"); assert m.matched; assert m.rule_id=="SQL-001"
    def test_sql_or(self):
        m = self.e.scan("admin' OR 1=1--"); assert m.matched
    def test_drop_table(self):
        m = self.e.scan("DROP TABLE users"); assert m.matched; assert m.rule_id=="SQL-003"
    def test_cmd_passwd(self):
        m = self.e.scan("foo; cat /etc/passwd"); assert m.matched; assert m.rule_id=="CMD-001"
    def test_benign(self):
        m = self.e.scan("GET /api/v1/users?page=1"); assert not m.matched
    def test_case_insensitive(self):
        m = self.e.scan("union select 1,2"); assert m.matched
    def test_empty(self):
        m = self.e.scan(""); assert not m.matched
    def test_scan_fields_hit(self):
        m = self.e.scan_fields({"url":"/api","body":"DROP TABLE x","header":"UA:fx"})
        assert m.matched
    def test_scan_fields_miss(self):
        m = self.e.scan_fields({"url":"/health","body":None,"header":"Auth: Bearer abc"})
        assert not m.matched

class TestIDSClassifier:
    def test_shape(self):
        m = IDSClassifier(12,5); assert m(torch.randn(8,12)).shape == (8,5)
    def test_single(self):
        m = IDSClassifier(12,3); assert m(torch.randn(1,12)).shape == (1,3)

class TestIDSAutoencoder:
    def test_shape(self):
        m = IDSAutoencoder(12); assert m(torch.randn(8,12)).shape == (8,12)
    def test_err_shape(self):
        m = IDSAutoencoder(12).eval(); assert m.reconstruction_error(torch.randn(16,12)).shape == (16,)
    def test_err_nonneg(self):
        m = IDSAutoencoder(12).eval()
        assert (m.reconstruction_error(torch.randn(10,12)) >= 0).all()

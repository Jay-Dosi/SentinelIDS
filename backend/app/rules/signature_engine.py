"""Signature-based detection engine."""
from __future__ import annotations
import json, logging
from pathlib import Path
from typing import NamedTuple

logger = logging.getLogger(__name__)
SIGNATURES_PATH = Path(__file__).parent / "signatures.json"

class SignatureMatch(NamedTuple):
    matched: bool
    rule_id: str | None
    rule_name: str | None
    category: str | None
    severity: str | None

class SignatureEngine:
    """Scans payload strings against rules loaded from signatures.json."""
    def __init__(self, path: Path = SIGNATURES_PATH):
        self.rules: list[dict] = []
        self.version: str = "unknown"
        try:
            with open(path) as f: data = json.load(f)
            self.rules = data.get("rules",[])
            self.version = data.get("version","unknown")
            logger.info("Loaded %d signature rules (v%s)", len(self.rules), self.version)
        except Exception as e: logger.error("Signature load failed: %s", e)

    def scan(self, payload: str) -> SignatureMatch:
        if not payload: return SignatureMatch(False,None,None,None,None)
        for rule in self.rules:
            pat = rule.get("pattern","")
            cs  = rule.get("case_sensitive",False)
            h, n = (payload, pat) if cs else (payload.lower(), pat.lower())
            if n in h:
                return SignatureMatch(True,rule["id"],rule.get("name"),rule.get("category"),rule.get("severity"))
        return SignatureMatch(False,None,None,None,None)

    def scan_fields(self, fields: dict) -> SignatureMatch:
        for field, val in fields.items():
            if not val: continue
            r = self.scan(str(val))
            if r.matched: return r
        return SignatureMatch(False,None,None,None,None)

_engine: SignatureEngine | None = None
def get_signature_engine() -> SignatureEngine:
    global _engine
    if _engine is None: _engine = SignatureEngine()
    return _engine

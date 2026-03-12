"""
Feature alignment: enforce unified schema, encode labels, compute class weights.
"""
from __future__ import annotations
import logging
import numpy as np
import pandas as pd
from training.dataset_loader import UNIFIED_FEATURES, LABEL_COLUMN

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Label normalisation map
#
# Keys   = raw labels that appear in the data (after _norm_label uppercasing)
# Values = canonical family name to train on
#
# Design rules:
#   1. Merge cross-dataset duplicates (same attack, different dataset names)
#   2. Fix encoding artifacts  (WEB_ATTACK_â_* → WEB_*)
#   3. Fix typos               (INFILTERATION → INFILTRATION)
#   4. Merge tiny sub-classes  (≤ ~50 samples) into their parent family
#      so the model has enough examples to learn them
# ---------------------------------------------------------------------------

LABEL_NORMALISATION: dict[str, str] = {

    # ── Benign / normal ──────────────────────────────────────────────────────
    "BENIGN":                       "BENIGN",
    "NORMAL":                       "BENIGN",

    # ── DoS family ───────────────────────────────────────────────────────────
    # Raw NSL-KDD names
    "DOS":                          "DOS",
    "BACK":                         "DOS",
    "LAND":                         "DOS",
    "NEPTUNE":                      "DOS",
    "POD":                          "DOS",
    "SMURF":                        "DOS",
    "TEARDROP":                     "DOS",
    "MAILBOMB":                     "DOS",
    "PROCESSTABLE":                 "DOS",
    "UDPSTORM":                     "DOS",
    # CIC-IDS2017 DoS names
    "DOS_GOLDENEYE":                "DOS",
    "DOS_HULK":                     "DOS",
    "DOS_SLOWHTTPTEST":             "DOS",
    "DOS_SLOWLORIS":                "DOS",
    # CIC-IDS2018 DoS names  (slightly different naming)
    "DOS_ATTACKS-GOLDENEYE":        "DOS",
    "DOS_ATTACKS-HULK":             "DOS",
    "DOS_ATTACKS-SLOWHTTPTEST":     "DOS",
    "DOS_ATTACKS-SLOWLORIS":        "DOS",

    # ── DDoS family ──────────────────────────────────────────────────────────
    "DDOS":                         "DDOS",
    "DDOS_ATTACK-HOIC":             "DDOS",
    "DDOS_ATTACK-LOIC-UDP":         "DDOS",
    "DDOS_ATTACKS-LOIC-HTTP":       "DDOS",

    # ── Port / network scanning ──────────────────────────────────────────────
    "PORTSCAN":                     "PORTSCAN",
    "PORTSWEEP":                    "PORTSCAN",
    "NMAP":                         "PORTSCAN",
    "IPSWEEP":                      "PORTSCAN",
    "MSCAN":                        "PORTSCAN",
    "SAINT":                        "PORTSCAN",
    "SATAN":                        "PORTSCAN",
    "RECONNAISSANCE":               "PORTSCAN",

    # ── Brute force (all protocols) ──────────────────────────────────────────
    "SSH-BRUTEFORCE":               "BRUTE_FORCE",
    "SSH-PATATOR":                  "BRUTE_FORCE",
    "FTP-BRUTEFORCE":               "BRUTE_FORCE",
    "FTP-PATATOR":                  "BRUTE_FORCE",
    "GUESS_PASSWD":                 "BRUTE_FORCE",
    "IMAP":                         "BRUTE_FORCE",     # NSL-KDD IMAP = brute force
    "NAMED":                        "BRUTE_FORCE",
    "SENDMAIL":                     "BRUTE_FORCE",
    "SNMPGETATTACK":                "BRUTE_FORCE",
    "SNMPGUESS":                    "BRUTE_FORCE",
    "XLOCK":                        "BRUTE_FORCE",
    "XSNOOP":                       "BRUTE_FORCE",

    # ── Web attacks ──────────────────────────────────────────────────────────
    # Raw CIC names (UTF-8 mojibake — â is the broken encoding of a dash/bullet)
    "WEB_ATTACK_â_BRUTE_FORCE":    "WEB_BRUTE_FORCE",
    "WEB_ATTACK_â_SQL_INJECTION":  "WEB_SQL_INJECTION",
    "WEB_ATTACK_â_XSS":            "WEB_XSS",
    # Alternate encodings that may appear depending on how the CSV was read
    "WEB_ATTACK_-_BRUTE_FORCE":    "WEB_BRUTE_FORCE",
    "WEB_ATTACK_-_SQL_INJECTION":  "WEB_SQL_INJECTION",
    "WEB_ATTACK_-_XSS":            "WEB_XSS",
    "WEB_ATTACK__BRUTE_FORCE":     "WEB_BRUTE_FORCE",
    "WEB_ATTACK__SQL_INJECTION":   "WEB_SQL_INJECTION",
    "WEB_ATTACK__XSS":             "WEB_XSS",
    "BRUTE_FORCE_-WEB":            "WEB_BRUTE_FORCE",
    "BRUTE_FORCE_-XSS":            "WEB_XSS",
    "SQL_INJECTION":               "WEB_SQL_INJECTION",
    "SQLATTACK":                   "WEB_SQL_INJECTION",

    # ── Botnet ───────────────────────────────────────────────────────────────
    "BOT":                          "BOTNET",

    # ── Intrusion / infiltration ─────────────────────────────────────────────
    "INFILTRATION":                 "INFILTRATION",
    "INFILTERATION":                "INFILTRATION",    # typo in CIC-IDS2018

    # ── UNSW-NB15 attack families ────────────────────────────────────────────
    "EXPLOITS":                     "EXPLOITS",
    "FUZZERS":                      "FUZZERS",
    "GENERIC":                      "GENERIC",
    "SHELLCODE":                    "SHELLCODE",
    "RECONNAISSANCE":               "PORTSCAN",        # already mapped above
    "BACKDOOR":                     "BACKDOOR",
    "ANALYSIS":                     "PORTSCAN",        # UNSW ANALYSIS ≈ scanning
    "WORMS":                        "WORM",

    # ── NSL-KDD rare / tiny classes → nearest parent ─────────────────────────
    # These have < 15 samples — merge rather than try to learn impossible classes
    "PERL":                         "SHELLCODE",       # remote exploit payload
    "PHF":                          "WEB_BRUTE_FORCE", # old CGI attack
    "SPY":                          "INFILTRATION",
    "MULTIHOP":                     "INFILTRATION",
    "ROOTKIT":                      "BACKDOOR",
    "LOADMODULE":                   "BACKDOOR",
    "HTTPTUNNEL":                   "BACKDOOR",
    "WAREZCLIENT":                  "INFILTRATION",
    "WAREZMASTER":                  "INFILTRATION",
    "PS":                           "PORTSCAN",
    "XTERM":                        "BRUTE_FORCE",
    "WORM":                         "WORM",

    # ── CIC-IDS2018 misc ─────────────────────────────────────────────────────
    "ANOMALY":                      "BOTNET",          # UNSW generic anomaly bucket
    "HEARTBLEED":                   "EXPLOITS",        # only 2 samples, merge
    "BUFFER_OVERFLOW":              "EXPLOITS",
    "FTP_WRITE":                    "INFILTRATION",
}

# Final canonical label set after normalisation — 16 classes
CANONICAL_LABELS = sorted(set(LABEL_NORMALISATION.values()))


def _normalise_label(raw: str) -> str:
    """
    Map a raw label string to its canonical family name.

    Handles:
    - mojibake variants of WEB_ATTACK labels
    - cross-dataset naming inconsistencies
    - typos (INFILTERATION)
    - tiny classes merged into parent families

    Unknown labels fall back to the raw value so new datasets
    are not silently dropped.
    """
    key = str(raw).strip().upper()

    # Direct lookup first
    if key in LABEL_NORMALISATION:
        return LABEL_NORMALISATION[key]

    # Fuzzy match for WEB_ATTACK mojibake variants we might have missed
    # e.g. "WEB_ATTACK_Â_BRUTE_FORCE", "WEB_ATTACK_?_XSS" etc.
    if key.startswith("WEB_ATTACK_"):
        if "BRUTE" in key:  return "WEB_BRUTE_FORCE"
        if "SQL"   in key:  return "WEB_SQL_INJECTION"
        if "XSS"   in key:  return "WEB_XSS"

    # Merge any remaining DOS_ATTACKS-* variants
    if key.startswith("DOS_ATTACKS"):
        if "GOLD"  in key: return "DOS"
        if "HULK"  in key: return "DOS"
        if "SLOW"  in key: return "DOS"
        return "DOS"

    if key.startswith("DDOS"):
        return "DDOS"

    logger.debug("Unknown label '%s' — keeping as-is", raw)
    return key


# ---------------------------------------------------------------------------
# Feature alignment
# ---------------------------------------------------------------------------

def align_features(df: pd.DataFrame) -> pd.DataFrame:
    """Align DataFrame to exactly UNIFIED_FEATURES; drop extras, fill missing."""
    aligned = {}
    for feat in UNIFIED_FEATURES:
        if feat in df.columns:
            aligned[feat] = pd.to_numeric(df[feat], errors="coerce").fillna(0.0)
        else:
            logger.warning("Alignment: missing '%s' — zeroing", feat)
            aligned[feat] = pd.Series(0.0, index=df.index)
    result = pd.DataFrame(aligned)
    for col in [LABEL_COLUMN, "_source"]:
        if col in df.columns:
            result[col] = df[col].values
    return result


def encode_labels(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, int]]:
    """
    1. Normalise raw labels to canonical families via LABEL_NORMALISATION.
    2. Encode canonical strings to integer class indices.

    Returns (modified DataFrame, label→index mapping).
    """
    df = df.copy()

    # Step 1: normalise
    before = df[LABEL_COLUMN].nunique()
    df[LABEL_COLUMN] = df[LABEL_COLUMN].apply(_normalise_label)
    after  = df[LABEL_COLUMN].nunique()
    logger.info("Label normalisation: %d raw labels → %d canonical classes", before, after)

    # Log the final distribution so it's visible in training logs
    dist = df[LABEL_COLUMN].value_counts()
    logger.info("Label distribution after normalisation:\n%s", dist.to_string())

    # Step 2: integer encode
    labels    = sorted(df[LABEL_COLUMN].unique().tolist())
    label_map = {lbl: idx for idx, lbl in enumerate(labels)}
    df[LABEL_COLUMN] = df[LABEL_COLUMN].map(label_map)
    logger.info("Final encoded classes (%d): %s", len(label_map), labels)
    return df, label_map


def compute_class_weights(labels: np.ndarray, num_classes: int) -> np.ndarray:
    """Inverse-frequency class weights — higher weight for rarer classes."""
    counts  = np.bincount(labels, minlength=num_classes).astype(float)
    counts  = np.where(counts == 0, 1.0, counts)
    weights = 1.0 / counts
    return weights / weights.sum() * num_classes
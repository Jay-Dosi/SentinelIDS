"""
Dataset loaders for CIC-IDS2017, UNSW-NB15, NSL-KDD, CIC-IDS2018.
Each loader reads raw CSVs/.parquets and maps columns to the unified feature schema.
"""
from __future__ import annotations
import logging, math
from pathlib import Path
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

UNIFIED_FEATURES = [
    # Flow timing
    "flow_duration",
    "flow_iat_mean",        # inter-arrival time mean
    "flow_iat_std",         # inter-arrival time std
    # Packet counts
    "packet_count",
    "fwd_packets",
    "bwd_packets",
    "fwd_bwd_ratio",        # fwd/bwd packet ratio — key for distinguishing attacks
    # Byte counts
    "byte_count",
    "fwd_bytes",
    "bwd_bytes",
    # Rates
    "flow_bytes_per_sec",
    "flow_packets_per_sec",
    # Packet size stats
    "avg_packet_size",
    "fwd_packet_size_mean",
    "bwd_packet_size_mean",
    # TCP flags
    "syn_flag_count",
    "ack_flag_count",
    "rst_flag_count",
    "fin_flag_count",
    "psh_flag_count",
    # Payload
    "payload_length",
    "payload_entropy",
    # Header
    "fwd_header_length",
    "bwd_header_length",
]
LABEL_COLUMN = "label"


def _safe_clip(s: pd.Series) -> pd.Series:
    return s.replace([np.inf, -np.inf], np.nan).clip(0, 1e12)

def _entropy(length_series: pd.Series) -> pd.Series:
    return length_series.apply(
        lambda v: math.log2(max(float(v), 1)) / 10.0 if pd.notna(v) else 0.0
    )

def _norm_label(raw: str) -> str:
    raw = str(raw).strip().upper()
    if raw in ("BENIGN", "NORMAL", "-", "0"):
        return "BENIGN"
    return raw.replace(" ", "_")

def _fill(df: pd.DataFrame) -> pd.DataFrame:
    for col in df.columns:
        if col == LABEL_COLUMN:
            continue
        if df[col].isna().any():
            m = df[col].median()
            df[col] = df[col].fillna(0.0 if pd.isna(m) else m)
    return df

def _read_tabular_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, low_memory=False)
    if suffix == ".parquet":
        return pd.read_parquet(path)
    raise ValueError(f"Unsupported file type: {path.name}")

def _list_dataset_files(path: Path) -> list[Path]:
    files = []
    files.extend(sorted(path.glob("*.csv")))
    files.extend(sorted(path.glob("*.parquet")))
    return files


# ── CIC-IDS2017 / 2018 ──────────────────────────────────────────────────────
# These datasets are the richest — map as many columns as possible.

CICIDS_MAP = {
    "Flow Duration":                  "flow_duration",
    "Flow IAT Mean":                  "flow_iat_mean",
    "Flow IAT Std":                   "flow_iat_std",
    "Total Fwd Packets":              "fwd_packets",
    "Total Backward Packets":         "bwd_packets",
    "Flow Bytes/s":                   "flow_bytes_per_sec",
    "Flow Packets/s":                 "flow_packets_per_sec",
    "Packet Length Mean":             "avg_packet_size",
    "Fwd Packet Length Mean":         "fwd_packet_size_mean",
    "Bwd Packet Length Mean":         "bwd_packet_size_mean",
    "Total Length of Fwd Packets":    "fwd_bytes",
    "Total Length of Bwd Packets":    "bwd_bytes",
    "Average Packet Size":            "avg_packet_size",
    "SYN Flag Count":                 "syn_flag_count",
    "ACK Flag Count":                 "ack_flag_count",
    "RST Flag Count":                 "rst_flag_count",
    "FIN Flag Count":                 "fin_flag_count",
    "PSH Flag Count":                 "psh_flag_count",
    "Fwd Header Length":              "fwd_header_length",
    "Bwd Header Length":              "bwd_header_length",
    "Label":                          LABEL_COLUMN,
}

def load_cicids(path: Path, year: str = "2017") -> pd.DataFrame:
    files = _list_dataset_files(path)
    if not files:
        logger.warning("No files in %s", path)
        return pd.DataFrame()
    frames = []
    for f in files:
        try:
            chunk = _read_tabular_file(f)
            chunk.columns = chunk.columns.str.strip()
            frames.append(chunk)
        except Exception as e:
            logger.error("Read error %s: %s", f, e)
    if not frames:
        return pd.DataFrame()
    raw = pd.concat(frames, ignore_index=True)
    raw.columns = raw.columns.str.strip()
    raw = raw.rename(columns={k: v for k, v in CICIDS_MAP.items() if k in raw.columns})

    # Derived columns — use pd.Series fallback so .fillna() always works
    _fwd_b = pd.to_numeric(
        raw["fwd_bytes"] if "fwd_bytes" in raw.columns
        else pd.Series(0, index=raw.index),
        errors="coerce"
    ).fillna(0)
    _bwd_b = pd.to_numeric(
        raw["bwd_bytes"] if "bwd_bytes" in raw.columns
        else pd.Series(0, index=raw.index),
        errors="coerce"
    ).fillna(0)
    raw["byte_count"]     = _fwd_b + _bwd_b
    raw["payload_length"] = _fwd_b

    return _build_unified(raw, f"cicids{year}")


# ── UNSW-NB15 ────────────────────────────────────────────────────────────────

def load_unsw_nb15(path: Path) -> pd.DataFrame:
    files = _list_dataset_files(path)
    if not files:
        logger.warning("No files in %s", path)
        return pd.DataFrame()
    frames = []
    for f in files:
        try:
            chunk = _read_tabular_file(f)
            chunk.columns = chunk.columns.str.strip().str.lower()
            frames.append(chunk)
        except Exception as e:
            logger.error("Read error %s: %s", f, e)
    if not frames:
        return pd.DataFrame()
    raw = pd.concat(frames, ignore_index=True)
    rename = {
        "dur":        "flow_duration",
        "rate":       "flow_bytes_per_sec",
        "smean":      "fwd_packet_size_mean",
        "dmean":      "bwd_packet_size_mean",
        "sintpkt":    "flow_iat_mean",
        "label":      LABEL_COLUMN,
        "attack_cat": "_attack_cat",
    }
    raw = raw.rename(columns={k: v for k, v in rename.items() if k in raw.columns})
    if "_attack_cat" in raw.columns and LABEL_COLUMN in raw.columns:
        raw[LABEL_COLUMN] = raw.apply(
            lambda r: str(r["_attack_cat"]).strip() if r[LABEL_COLUMN] == 1 else "BENIGN",
            axis=1,
        )
    fwd = raw.get("spkts", pd.Series(0, index=raw.index))
    bwd = raw.get("dpkts", pd.Series(0, index=raw.index))
    raw["fwd_packets"]  = fwd
    raw["bwd_packets"]  = bwd
    raw["packet_count"] = fwd + bwd
    sb  = pd.to_numeric(raw.get("sbytes", 0), errors="coerce").fillna(0)
    db_ = pd.to_numeric(raw.get("dbytes", 0), errors="coerce").fillna(0)
    raw["fwd_bytes"]       = sb
    raw["bwd_bytes"]       = db_
    raw["byte_count"]      = sb + db_
    raw["payload_length"]  = sb
    raw["avg_packet_size"] = raw["byte_count"] / raw["packet_count"].replace(0, 1)
    if "proto" in raw.columns:
        raw["syn_flag_count"] = (raw["proto"].astype(str).str.lower() == "tcp").astype(int)
    return _build_unified(raw, "unsw_nb15")


# ── NSL-KDD ──────────────────────────────────────────────────────────────────

NSL_COLS = [
    "duration","protocol_type","service","flag","src_bytes","dst_bytes","land",
    "wrong_fragment","urgent","hot","num_failed_logins","logged_in","num_compromised",
    "root_shell","su_attempted","num_root","num_file_creations","num_shells",
    "num_access_files","num_outbound_cmds","is_host_login","is_guest_login","count",
    "srv_count","serror_rate","srv_serror_rate","rerror_rate","srv_rerror_rate",
    "same_srv_rate","diff_srv_rate","srv_diff_host_rate","dst_host_count",
    "dst_host_srv_count","dst_host_same_srv_rate","dst_host_diff_srv_rate",
    "dst_host_same_src_port_rate","dst_host_srv_diff_host_rate","dst_host_serror_rate",
    "dst_host_srv_serror_rate","dst_host_rerror_rate","dst_host_srv_rerror_rate",
    LABEL_COLUMN, "difficulty",
]
FLAG_SYN = {"S0", "S1", "S2", "S3", "SF"}
FLAG_RST = {"REJ", "RSTO", "RSTOS0", "RSTR", "RSTRH"}

def load_nsl_kdd(path: Path) -> pd.DataFrame:
    files = list(path.glob("*.csv")) + list(path.glob("*.txt")) + list(path.glob("*.arff"))
    if not files:
        logger.warning("No files in %s", path)
        return pd.DataFrame()
    frames = []
    for f in files:
        try:
            chunk = pd.read_csv(f, header=None, low_memory=False, comment="@")
            chunk.columns = NSL_COLS[: chunk.shape[1]]
            frames.append(chunk)
        except Exception as e:
            logger.error("Read error %s: %s", f, e)
    if not frames:
        return pd.DataFrame()
    raw = pd.concat(frames, ignore_index=True)
    if "flag" in raw.columns:
        raw["syn_flag_count"] = raw["flag"].isin(FLAG_SYN).astype(int)
        raw["rst_flag_count"] = raw["flag"].isin(FLAG_RST).astype(int)
    raw["flow_duration"]      = pd.to_numeric(raw.get("duration", 0), errors="coerce").fillna(0)
    raw["fwd_packets"]        = pd.to_numeric(raw.get("count", 0), errors="coerce").fillna(0)
    raw["bwd_packets"]        = pd.to_numeric(raw.get("srv_count", 0), errors="coerce").fillna(0)
    raw["packet_count"]       = raw["fwd_packets"] + raw["bwd_packets"]
    sb  = pd.to_numeric(raw.get("src_bytes", 0), errors="coerce").fillna(0)
    db_ = pd.to_numeric(raw.get("dst_bytes", 0), errors="coerce").fillna(0)
    raw["fwd_bytes"]          = sb
    raw["bwd_bytes"]          = db_
    raw["byte_count"]         = sb + db_
    raw["payload_length"]     = sb
    raw["avg_packet_size"]    = raw["byte_count"] / raw["packet_count"].replace(0, 1)
    raw["flow_bytes_per_sec"] = raw["byte_count"] / raw["flow_duration"].replace(0, 1)
    raw["ack_flag_count"]     = 0
    raw["fin_flag_count"]     = raw["syn_flag_count"]   # SF flag ≈ FIN in NSL-KDD
    raw["psh_flag_count"]     = 0
    return _build_unified(raw, "nsl_kdd")


# ── Unified builder ───────────────────────────────────────────────────────────

def _build_unified(raw: pd.DataFrame, source: str) -> pd.DataFrame:
    result = {}
    for feat in UNIFIED_FEATURES:
        if feat in raw.columns:
            result[feat] = _safe_clip(pd.to_numeric(raw[feat], errors="coerce"))
        else:
            result[feat] = pd.Series(0.0, index=raw.index)

    # Derived ratios (computed after raw mapping)
    fwd = result["fwd_packets"].replace(0, np.nan)
    bwd = result["bwd_packets"].replace(0, np.nan)
    result["fwd_bwd_ratio"] = (fwd / bwd).fillna(0).clip(0, 1e6)

    if result["packet_count"].sum() == 0:
        result["packet_count"] = result["fwd_packets"] + result["bwd_packets"]

    if result["flow_packets_per_sec"].sum() == 0:
        dur = result["flow_duration"].replace(0, 1)
        result["flow_packets_per_sec"] = (result["packet_count"] / dur).clip(0, 1e9)

    if result["payload_entropy"].sum() == 0:
        result["payload_entropy"] = _entropy(result["payload_length"])

    if LABEL_COLUMN in raw.columns:
        result[LABEL_COLUMN] = raw[LABEL_COLUMN].apply(_norm_label)
    else:
        result[LABEL_COLUMN] = pd.Series("BENIGN", index=raw.index)

    df = pd.DataFrame(result)
    df = _fill(df)
    logger.info("[%s] Loaded %d records", source, len(df))
    return df


# ── Auto-detect ───────────────────────────────────────────────────────────────

DATASET_LOADERS = {
    "cicids2017": lambda p: load_cicids(p, "2017"),
    "cicids2018": lambda p: load_cicids(p, "2018"),
    "unsw_nb15":  load_unsw_nb15,
    "nsl_kdd":    load_nsl_kdd,
}

def load_all_datasets(datasets_dir: Path) -> pd.DataFrame:
    def has_data(p: Path) -> bool:
        return any(p.glob("*.csv")) or any(p.glob("*.parquet")) \
            or any(p.glob("*.txt")) or any(p.glob("*.arff"))

    frames = []
    for name, loader in DATASET_LOADERS.items():
        sub = datasets_dir / name
        if sub.is_dir() and has_data(sub):
            logger.info("Detected dataset: %s", name)
            try:
                df = loader(sub)
                if not df.empty:
                    df["_source"] = name
                    frames.append(df)
            except Exception as e:
                logger.error("Error loading %s: %s", name, e)

    if not frames:
        raise RuntimeError(
            f"No datasets found in '{datasets_dir}'. "
            "Place CSV/Parquet files in datasets/<name>/ subdirectories."
        )
    combined = pd.concat(frames, ignore_index=True)
    logger.info("Total records: %d", len(combined))
    return combined
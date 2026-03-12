"""
SentinelIDS Training Pipeline
Usage: python training/training_pipeline.py
"""
from __future__ import annotations
import json, logging, os, sys
from pathlib import Path
from collections import Counter
import os
import numpy as np
from dotenv import load_dotenv

# Load .env before reading any os.getenv() calls
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from training.dataset_loader    import load_all_datasets, UNIFIED_FEATURES
from training.feature_alignment import align_features, encode_labels, compute_class_weights
from training.preprocessing     import (preprocess, split_data, get_benign_mask,
                                         save_scaler, save_label_encoder)
from training.train_classifier  import train_classifier
from training.train_autoencoder import train_autoencoder
from training.evaluation        import evaluate_classifier, evaluate_autoencoder

DATASETS_DIR = Path(os.getenv("DATASETS_DIR", "datasets"))
MODELS_DIR   = Path(os.getenv("MODELS_DIR",   "models"))
EPOCHS       = int(os.getenv("EPOCHS",   "60"))
BATCH_SIZE   = int(os.getenv("BATCH_SIZE","1024"))
LR           = float(os.getenv("LEARNING_RATE", "0.0005"))
TEST_SPLIT   = float(os.getenv("TEST_SPLIT",    "0.2"))
SEED         = int(os.getenv("RANDOM_SEED",     "42"))
AE_PCT       = float(os.getenv("ANOMALY_THRESHOLD_PERCENTILE", "95"))
FOCAL_GAMMA  = float(os.getenv("FOCAL_LOSS_GAMMA", "1.5"))
BENIGN_CAP   = int(os.getenv("BENIGN_CAP",        "500000"))
MIN_CLASS    = int(os.getenv("MIN_CLASS_SAMPLES",  "200"))

MODELS_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout),
              logging.FileHandler(MODELS_DIR / "training.log")],
)
logger = logging.getLogger("sentinelids.pipeline")


def resample(X: np.ndarray, y: np.ndarray, label_map: dict,
             benign_cap: int, min_class: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Two-step resampling to fix class imbalance:
      1. Undersample BENIGN down to benign_cap.
      2. Oversample (duplicate with tiny noise) any class below min_class.

    This keeps training manageable while giving rare attacks enough examples.
    """
    rng = np.random.default_rng(seed)
    benign_idx = label_map.get("BENIGN", -1)

    # ── Step 1: undersample BENIGN ──────────────────────────────────────────
    all_idx = np.arange(len(y))
    benign_mask = y == benign_idx

    benign_positions = all_idx[benign_mask]
    other_positions  = all_idx[~benign_mask]

    if len(benign_positions) > benign_cap:
        benign_positions = rng.choice(benign_positions, benign_cap, replace=False)
        logger.info("BENIGN undersampled: %d → %d", benign_mask.sum(), benign_cap)

    keep = np.concatenate([benign_positions, other_positions])
    X, y = X[keep], y[keep]

    # ── Step 1b: cap oversized attack classes ────────────────────────────────
    ATTACK_CAP = int(os.getenv("ATTACK_CAP", "150000"))
    counts_before = Counter(y.tolist())
    X_capped, y_capped = [], []
    for cls, cnt in counts_before.items():
        cls_idx = np.where(y == cls)[0]
        if cls != benign_idx and cnt > ATTACK_CAP:
            cls_idx = rng.choice(cls_idx, ATTACK_CAP, replace=False)
            logger.info("Class %d capped: %d → %d", cls, cnt, ATTACK_CAP)
        X_capped.append(X[cls_idx])
        y_capped.append(y[cls_idx])
    X = np.concatenate(X_capped)
    y = np.concatenate(y_capped)

    # ── Step 2: oversample rare attack classes ───────────────────────────────
    counts = Counter(y.tolist())
    X_extra, y_extra = [], []

    for cls, cnt in counts.items():
        if cls == benign_idx:
            continue
        if cnt < min_class:
            need    = min_class - cnt
            cls_idx = np.where(y == cls)[0]
            chosen  = rng.choice(cls_idx, need, replace=True)
            noise   = rng.normal(0, 0.01, (need, X.shape[1])).astype(np.float32)
            X_extra.append(X[chosen] + noise)
            y_extra.append(np.full(need, cls, dtype=y.dtype))
            logger.info("Class %d oversampled: %d → %d", cls, cnt, min_class)

    if X_extra:
        X = np.concatenate([X] + X_extra)
        y = np.concatenate([y] + y_extra)

    # Shuffle
    perm = rng.permutation(len(y))
    logger.info("After resampling: %d total samples | class dist: %s",
                len(y), dict(sorted(Counter(y.tolist()).items())))
    return X[perm], y[perm]


def run():
    logger.info("=== STEP 1: Load datasets ===")
    df = load_all_datasets(DATASETS_DIR)
    logger.info("Raw records: %d", len(df))

    logger.info("=== STEP 2: Align features ===")
    df = align_features(df)

    logger.info("=== STEP 3: Encode labels ===")
    df, label_map = encode_labels(df)
    num_classes = len(label_map)
    save_label_encoder(label_map, MODELS_DIR / "label_encoder.json")
    logger.info("Classes: %d", num_classes)

    logger.info("=== STEP 4: Preprocess (scale) ===")
    X, y, scaler = preprocess(df)
    save_scaler(scaler, MODELS_DIR / "scaler.pkl")

    # Split BEFORE resampling so the test set stays realistic
    X_tr, X_te, y_tr, y_te = split_data(X, y, TEST_SPLIT, SEED)
    logger.info("Raw split — train: %d  test: %d", len(X_tr), len(X_te))

    logger.info("=== STEP 4b: Resample training set ===")
    X_tr, y_tr = resample(X_tr, y_tr, label_map, BENIGN_CAP, MIN_CLASS, SEED)

    # Recompute class weights on the resampled distribution
    weights = compute_class_weights(y_tr, num_classes)

    logger.info("=== STEP 5: Train classifier ===")
    clf = train_classifier(
        X_tr, y_tr, X_te, y_te,
        num_classes, weights,
        MODELS_DIR / "ids_classifier.pt",
        epochs=EPOCHS, batch_size=BATCH_SIZE,
        lr=LR, focal_gamma=FOCAL_GAMMA,
    )

    logger.info("=== STEP 6: Train autoencoder ===")
    benign_mask = get_benign_mask(y_tr, label_map)
    ae, threshold = train_autoencoder(
        X_tr[benign_mask], MODELS_DIR / "anomaly_autoencoder.pt",
        epochs=EPOCHS, batch_size=BATCH_SIZE, lr=LR, threshold_percentile=AE_PCT,
    )

    logger.info("=== STEP 7: Evaluate (on UNSAMPLED test set) ===")
    clf_m = evaluate_classifier(clf, X_te, y_te, label_map)
    b_mask = get_benign_mask(y_te, label_map)
    ae_m   = evaluate_autoencoder(ae, X_te[b_mask], X_te[~b_mask], threshold) \
             if (~b_mask).sum() > 0 else {}

    logger.info("=== STEP 8: Save metadata ===")
    meta = {
        "feature_names": UNIFIED_FEATURES,
        "num_features":  len(UNIFIED_FEATURES),
        "num_classes":   num_classes,
        "label_map":     label_map,
        "anomaly_threshold": threshold,
        "version": "1.0.0",
        "classifier_metrics": {"accuracy": clf_m["accuracy"]},
        "autoencoder_metrics": ae_m,
        "training_config": {
            "epochs": EPOCHS, "batch_size": BATCH_SIZE, "lr": LR,
            "focal_gamma": FOCAL_GAMMA, "benign_cap": BENIGN_CAP,
            "min_class_samples": MIN_CLASS,
        },
    }
    with open(MODELS_DIR / "metadata.json",     "w") as f: json.dump(meta, f, indent=2)
    with open(MODELS_DIR / "feature_names.json","w") as f: json.dump(UNIFIED_FEATURES, f, indent=2)
    logger.info("Training complete. Models saved in '%s'", MODELS_DIR)


if __name__ == "__main__":
    run()

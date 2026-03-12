"""Classifier and autoencoder evaluation metrics."""
from __future__ import annotations
import logging
import numpy as np
import torch
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)


def evaluate_classifier(model, X_test, y_test, label_map, batch_size=1024):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device).eval()

    ld = DataLoader(
        TensorDataset(torch.tensor(X_test, dtype=torch.float32)),
        batch_size=batch_size, shuffle=False,
    )
    preds = []
    with torch.no_grad():
        for (xb,) in ld:
            preds.append(model(xb.to(device)).argmax(1).cpu().numpy())

    y_pred = np.concatenate(preds)
    acc = accuracy_score(y_test, y_pred)
    idx2lbl = {v: k for k, v in label_map.items()}
    names = [idx2lbl[i] for i in sorted(idx2lbl)]

    logger.info("Classifier accuracy: %.4f", acc)
    logger.info("\n%s", classification_report(
        y_test, y_pred, target_names=names, zero_division=0
    ))
    return {
        "accuracy": acc,
        "classification_report": classification_report(
            y_test, y_pred, target_names=names, zero_division=0, output_dict=True
        ),
    }


def evaluate_autoencoder(model, X_benign, X_attack, threshold, batch_size=1024):
    """Always runs autoencoder on CPU to avoid device mismatch."""
    model = model.cpu().eval()

    def get_errors(X: np.ndarray) -> np.ndarray:
        ld = DataLoader(
            TensorDataset(torch.tensor(X, dtype=torch.float32)),
            batch_size=batch_size, shuffle=False,
        )
        out = []
        with torch.no_grad():
            for (xb,) in ld:
                # xb is already on CPU, model is on CPU — no device issue
                out.append(model.reconstruction_error(xb).numpy())
        return np.concatenate(out)

    benign_errors = get_errors(X_benign)
    attack_errors = get_errors(X_attack)

    all_errors = np.concatenate([benign_errors, attack_errors])
    all_labels = np.array([0] * len(benign_errors) + [1] * len(attack_errors))

    preds = (all_errors > threshold).astype(int)
    tp = ((preds == 1) & (all_labels == 1)).sum()
    fp = ((preds == 1) & (all_labels == 0)).sum()
    tn = ((preds == 0) & (all_labels == 0)).sum()
    fn = ((preds == 0) & (all_labels == 1)).sum()

    tpr = tp / max(tp + fn, 1)
    fpr = fp / max(fp + tn, 1)
    try:
        auc = roc_auc_score(all_labels, all_errors)
    except ValueError:
        auc = 0.0

    logger.info("Autoencoder  TPR=%.4f  FPR=%.4f  AUC=%.4f", tpr, fpr, auc)
    return {"tpr": tpr, "fpr": fpr, "auc_roc": auc, "threshold": threshold}
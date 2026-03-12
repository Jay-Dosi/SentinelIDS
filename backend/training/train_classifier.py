"""
IDS Classifier with Focal Loss.
Architecture: Input → 512 → BN → 256 → BN → 128 → 64 → Output
"""
from __future__ import annotations
import logging
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)


class FocalLoss(nn.Module):
    def __init__(self, gamma=1.5, weight=None):
        super().__init__()
        self.gamma = gamma
        self.weight = weight

    def forward(self, logits, targets):
        ce = F.cross_entropy(logits, targets, weight=self.weight, reduction="none")
        pt = torch.exp(-ce)
        return ((1 - pt) ** self.gamma * ce).mean()

class IDSClassifier(nn.Module):
    def __init__(self, input_dim: int, num_classes: int, dropout: float = 0.3):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 512),
            nn.ReLU(),
            nn.BatchNorm1d(512),
            nn.Dropout(dropout),

            nn.Linear(512, 256),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(dropout),

            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(dropout * 0.7),

            nn.Linear(128, 64),
            nn.ReLU(),

            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


def train_classifier(
    X_train, y_train, X_val, y_val,
    num_classes, class_weights, save_path: Path,
    epochs=60, batch_size=1024, lr=5e-4, focal_gamma=2.0,
):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training classifier on %s | classes=%d | samples=%d",
                device, num_classes, len(X_train))

    input_dim = X_train.shape[1]
    model = IDSClassifier(input_dim, num_classes).to(device)

    criterion = FocalLoss(gamma=focal_gamma, weight=None)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    # DataLoaders defined BEFORE scheduler (scheduler needs len(train_ld))
    train_ld = DataLoader(
        TensorDataset(torch.tensor(X_train, dtype=torch.float32),
                      torch.tensor(y_train, dtype=torch.long)),
        batch_size=batch_size, shuffle=True, num_workers=4, pin_memory=True,
    )
    val_ld = DataLoader(
        TensorDataset(torch.tensor(X_val, dtype=torch.float32),
                      torch.tensor(y_val, dtype=torch.long)),
        batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True,
    )

    # OneCycleLR needs steps_per_epoch = len(train_ld)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(
        optimizer, max_lr=lr,
        steps_per_epoch=len(train_ld),
        epochs=epochs,
        pct_start=0.1,
    )

    save_path.parent.mkdir(parents=True, exist_ok=True)
    best_acc = -1.0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_ld:
            xb, yb = xb.to(device), yb.to(device)
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            scheduler.step()  # ← inside batch loop for OneCycleLR
            total_loss += loss.item() * len(xb)

        model.eval()
        correct = total = 0
        with torch.no_grad():
            for xb, yb in val_ld:
                preds = model(xb.to(device)).argmax(1)
                correct += (preds == yb.to(device)).sum().item()
                total += len(yb)

        acc = correct / total
        logger.info("Epoch %3d/%d  loss=%.4f  val_acc=%.4f  lr=%.6f",
                    epoch, epochs, total_loss / len(X_train), acc,
                    scheduler.get_last_lr()[0])

        if acc > best_acc:
            best_acc = acc
            torch.save({
                "model_state_dict": model.state_dict(),
                "input_dim": input_dim,
                "num_classes": num_classes,
                "val_acc": acc,
                "epoch": epoch,
            }, save_path)

    logger.info("Best val_acc=%.4f  saved to %s", best_acc, save_path)
    return model


def load_classifier(path: Path) -> IDSClassifier:
    ckpt = torch.load(path, map_location="cpu")
    m = IDSClassifier(ckpt["input_dim"], ckpt["num_classes"])
    m.load_state_dict(ckpt["model_state_dict"])
    m.eval()
    return m
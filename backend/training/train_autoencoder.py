"""
Autoencoder anomaly detector.
Architecture: Encoder(in→64→32→16) / Decoder(16→32→64→in)
Trained on benign-only traffic; high reconstruction error = anomaly.
"""
from __future__ import annotations
import logging
from pathlib import Path
import numpy as np
import torch, torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)

class IDSAutoencoder(nn.Module):
    """Symmetric autoencoder for anomaly detection."""
    def __init__(self, input_dim: int, latent_dim: int = 16):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim,64), nn.ReLU(),
            nn.Linear(64,32), nn.ReLU(),
            nn.Linear(32,latent_dim), nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim,32), nn.ReLU(),
            nn.Linear(32,64), nn.ReLU(),
            nn.Linear(64,input_dim),
        )
    def forward(self, x): return self.decoder(self.encoder(x))
    def reconstruction_error(self, x):
        with torch.no_grad(): return ((x - self.forward(x))**2).mean(dim=1)

def _errors(model, X, device, bs=512):
    ld = DataLoader(TensorDataset(torch.tensor(X,dtype=torch.float32)), batch_size=bs, shuffle=False)
    out = []
    with torch.no_grad():
        for (xb,) in ld: out.append(model.reconstruction_error(xb.to(device)).cpu().numpy())
    return np.concatenate(out)

def train_autoencoder(X_benign, save_path: Path, epochs=30, batch_size=512,
                      lr=1e-3, threshold_percentile=95.0):
    """Train autoencoder on benign-only data; compute reconstruction threshold."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training autoencoder on %s (%d benign samples)", device, len(X_benign))
    model = IDSAutoencoder(X_benign.shape[1]).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, patience=3, factor=0.5)
    ld = DataLoader(TensorDataset(torch.tensor(X_benign,dtype=torch.float32)),
                    batch_size=batch_size, shuffle=True)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    best = float("inf")
    for ep in range(1, epochs+1):
        model.train(); loss_sum = 0
        for (xb,) in ld:
            xb = xb.to(device); opt.zero_grad()
            l = nn.MSELoss()(model(xb), xb); l.backward(); opt.step()
            loss_sum += l.item()*len(xb)
        avg = loss_sum/len(X_benign); sched.step(avg)
        logger.info("AE epoch %3d/%d  loss=%.6f", ep, epochs, avg)
        if avg < best:
            best = avg; torch.save(model.state_dict(), save_path.with_suffix(".tmp.pt"))
    model.load_state_dict(torch.load(save_path.with_suffix(".tmp.pt"), map_location=device))
    model.eval()
    errs = _errors(model, X_benign, device, batch_size)
    threshold = float(np.percentile(errs, threshold_percentile))
    logger.info("Anomaly threshold (p%.0f): %.6f", threshold_percentile, threshold)
    torch.save({"model_state_dict":model.state_dict(),"input_dim":X_benign.shape[1],
                "threshold":threshold,"best_loss":best}, save_path)
    tmp = save_path.with_suffix(".tmp.pt")
    if tmp.exists(): tmp.unlink()
    logger.info("Autoencoder saved to %s", save_path)
    return model, threshold

def load_autoencoder(path: Path):
    ckpt = torch.load(path, map_location="cpu")
    m = IDSAutoencoder(ckpt["input_dim"])
    m.load_state_dict(ckpt["model_state_dict"]); m.eval()
    return m, float(ckpt["threshold"])

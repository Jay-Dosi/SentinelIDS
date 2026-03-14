"""SentinelIDS FastAPI application entry point."""
from __future__ import annotations
import logging, time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.core.database import init_db
from app.core.logging import configure_logging
from app.api.routes import router
from app.ml.model_loader import load_models
from app.rules.signature_engine import get_signature_engine

configure_logging(debug=settings.debug)
logger = logging.getLogger("sentinelids.main")

app = FastAPI(title=settings.app_name, version=settings.app_version,
              description="AI-powered Network Intrusion Detection System API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter(); response = await call_next(request)
    logger.info("endpoint=%s method=%s status=%d latency_ms=%.1f",
                request.url.path, request.method, response.status_code,
                (time.perf_counter()-t0)*1000)
    return response

@app.on_event("startup")
async def startup():
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    try: init_db(); logger.info("Database initialised")
    except Exception as e: logger.error("DB init failed: %s", e)
    try:
        b = load_models(settings.classifier_path, settings.autoencoder_path,
                        settings.scaler_path, settings.label_encoder_path, settings.metadata_path)
        if b.loaded: logger.info("Models loaded (v%s)", b.version)
        else: logger.warning("Some models failed to load — run training pipeline first")
    except Exception as e: logger.error("Model load error: %s", e)
    try:
        e = get_signature_engine(); logger.info("Signature engine ready (%d rules)", len(e.rules))
    except Exception as e: logger.error("Signature engine error: %s", e)

@app.on_event("shutdown")
async def shutdown(): logger.info("Shutting down %s", settings.app_name)

@app.exception_handler(Exception)
async def exc_handler(request: Request, exc: Exception):
    logger.error("Unhandled: %s  path=%s", exc, request.url.path)
    return JSONResponse(status_code=500, content={"detail":"Internal server error","error":str(exc)})

app.include_router(router)

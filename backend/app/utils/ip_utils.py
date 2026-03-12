"""Extract real client IP from FastAPI request."""
from fastapi import Request

def get_client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd: return fwd.split(",")[0].strip()
    if request.client and request.client.host: return request.client.host
    return "unknown"

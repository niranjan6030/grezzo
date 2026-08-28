"""
Grezzo AI service.

Two endpoints, both stateless: the storefront sends the catalogue with
every request, so this never needs its own copy and never goes stale
when a product is edited in the admin console.

  POST /recommend      LSTM next-item prediction over a browsing sequence
  POST /visual-search   CLIP zero-shot match from a photograph
  GET  /health          what is actually loaded

Run locally:   uvicorn app:app --reload --port 8000
Then set AI_SERVICE_URL=http://localhost:8000 in web/.env.local
"""

from __future__ import annotations

import os
import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import recommender
import vision

app = FastAPI(title="Grezzo AI", version="1.0.0")

# The storefront calls this server-side, so CORS is only needed if you
# ever call it straight from the browser. Locked to the site by default.
origins = [o for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MAX_IMAGE_CHARS = 9_000_000     # ~6.5MB decoded


# --------------------------------------------------------------------------
class Event(BaseModel):
    item: str
    kind: str = "view"
    at: int = 0


class CatalogueItem(BaseModel):
    id: str
    name: str | None = None
    fit: str | None = None
    rise: str | None = None
    wash: str | None = None
    tags: list[str] = Field(default_factory=list)
    vector: list[float] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    sequence: list[Event] = Field(default_factory=list)
    favourites: list[str] = Field(default_factory=list)
    cart: list[str] = Field(default_factory=list)
    catalogue: list[CatalogueItem]
    limit: int = 8


class VisualRequest(BaseModel):
    image: str
    catalogue: list[CatalogueItem]
    limit: int = 6


class AnalyseRequest(BaseModel):
    image: str


# --------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "recommender": "lstm" if recommender.RECOMMENDER.ready else "content-fallback",
        "vision": "clip" if vision.available() else "unavailable",
        "clip_model": vision.MODEL_NAME,
    }


@app.post("/recommend")
def recommend(req: RecommendRequest) -> dict:
    started = time.perf_counter()
    catalogue = [c.model_dump() for c in req.catalogue]

    items, engine = recommender.RECOMMENDER.recommend(
        [e.model_dump() for e in req.sequence],
        req.favourites,
        req.cart,
        catalogue,
        limit=max(1, min(req.limit, 24)),
    )
    return {
        "engine": engine,
        "recommendations": items,
        "ms": round((time.perf_counter() - started) * 1000, 1),
    }


@app.post("/analyse-garment")
def analyse_garment(req: AnalyseRequest) -> dict:
    """Read cut, rise and wash off a product photo, so the storefront can
    draw an accurate technical flat from them."""
    if not req.image.startswith("data:image/"):
        return {"error": "Expected a data URL image."}
    if len(req.image) > MAX_IMAGE_CHARS:
        return {"error": "Image too large."}
    if not vision.available():
        return {"error": "CLIP is not installed on this service."}

    started = time.perf_counter()
    try:
        result = vision.analyse_garment(req.image)
    except Exception as exc:                       # noqa: BLE001
        return {"error": f"Could not read that image: {exc}"}

    result["ms"] = round((time.perf_counter() - started) * 1000, 1)
    return result


@app.post("/visual-search")
def visual_search(req: VisualRequest) -> dict:
    if not req.image.startswith("data:image/"):
        return {"error": "Expected a data URL image.", "matches": []}
    if len(req.image) > MAX_IMAGE_CHARS:
        return {"error": "Image too large.", "matches": []}
    if not vision.available():
        # Say so rather than returning silence — the storefront then falls
        # back to on-device colour matching and tells the shopper which
        # engine answered.
        return {"error": "CLIP is not installed on this service.", "matches": []}

    started = time.perf_counter()
    try:
        matches = vision.search(
            req.image,
            [c.model_dump() for c in req.catalogue],
            limit=max(1, min(req.limit, 12)),
        )
    except Exception as exc:                       # noqa: BLE001
        return {"error": f"Could not read that image: {exc}", "matches": []}

    return {"matches": matches, "ms": round((time.perf_counter() - started) * 1000, 1)}

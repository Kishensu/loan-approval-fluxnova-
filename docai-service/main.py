import base64
import gc
import io
import os
import random
from typing import Optional

from fastapi import FastAPI, HTTPException
from PIL import Image, ImageStat
from pydantic import BaseModel

try:
    from pdf2image import convert_from_bytes
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = FastAPI(title="DocAI Service")


# ── Request / response models ─────────────────────────────────────────────────

class FieldSpec(BaseModel):
    name: str
    question: str


class ExtractRequest(BaseModel):
    image_base64: str
    fields: list[FieldSpec]
    media_type: Optional[str] = None


class FieldResult(BaseModel):
    value: str
    confidence: float


class ExtractResponse(BaseModel):
    fields: dict[str, FieldResult]


# ── Known sample field values ─────────────────────────────────────────────────
# Three tiers keyed by quality band: printed | mixed | handwritten

FIELD_SETS = {
    "printed": {
        "applicantName": "Sarah Johnson",
        "requestType":   "loan",
        "amount":        "125000",
        "requestDate":   "2026-07-08",
        "description":   "Commercial property purchase loan",
    },
    "mixed": {
        "applicantName": "Marcus Chen",
        "requestType":   "refund",
        "amount":        "3200",
        "requestDate":   "2026-09-15",
        "description":   "Product return request",
    },
    "handwritten": {
        "applicantName": "Rob Smith",
        "requestType":   "loan",
        "amount":        "18500",
        "requestDate":   "09/08/2026",
        "description":   "Pending documentation review",
    },
}

# Confidence ranges per tier — handwritten falls below the 0.85 review threshold
CONFIDENCE_RANGES = {
    "printed":     (0.88, 0.97),
    "mixed":       (0.78, 0.91),
    "handwritten": (0.28, 0.62),
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_image(image_base64: str, media_type: Optional[str]) -> Image.Image:
    data = base64.b64decode(image_base64)
    is_pdf = data[:4] == b"%PDF" or (media_type and "pdf" in media_type.lower())
    if is_pdf:
        if not PDF_SUPPORT:
            raise ValueError("PDF support requires pdf2image + poppler-utils")
        pages = convert_from_bytes(data, first_page=1, last_page=1)
        return pages[0].convert("RGB")
    return Image.open(io.BytesIO(data)).convert("RGB")


def quality_tier(image: Image.Image) -> str:
    """
    Classify image into printed / mixed / handwritten using grayscale contrast.
    Printed forms have sharp dark-on-white text (high std_dev).
    Handwritten/noisy forms have lower contrast and uneven backgrounds.
    """
    sample = image.convert("L").resize((300, 300))
    stat = ImageStat.Stat(sample)
    std = stat.stddev[0]

    if std >= 72:
        return "printed"
    if std >= 45:
        return "mixed"
    return "handwritten"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": True}


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    try:
        image = load_image(req.image_base64, req.media_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    tier = quality_tier(image)
    del image
    gc.collect()

    values = FIELD_SETS[tier]
    lo, hi = CONFIDENCE_RANGES[tier]

    results: dict[str, FieldResult] = {}
    for field in req.fields:
        confidence = round(random.uniform(lo, hi), 4)
        value = values.get(field.name, "")
        results[field.name] = FieldResult(value=value, confidence=confidence)

    print(f"[docai] tier={tier}  fields={list(results.keys())}")
    return ExtractResponse(fields=results)

import anthropic
import base64
import gc
import io
import json
import os
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

try:
    from pdf2image import convert_from_bytes
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

app = FastAPI(title="DocAI Service")

MODEL = "claude-haiku-4-5-20251001"


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


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_jpeg(image_base64: str, media_type: Optional[str]) -> bytes:
    """Decode any supported format and return JPEG bytes for Claude."""
    data = base64.b64decode(image_base64)
    is_pdf = data[:4] == b"%PDF" or (media_type and "pdf" in media_type.lower())
    if is_pdf:
        if not PDF_SUPPORT:
            raise ValueError("PDF support requires pdf2image + poppler-utils")
        pages = convert_from_bytes(data, first_page=1, last_page=1)
        img = pages[0].convert("RGB")
    else:
        img = Image.open(io.BytesIO(data)).convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY not set")

    try:
        jpeg_bytes = to_jpeg(req.image_base64, req.media_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    img_b64 = base64.b64encode(jpeg_bytes).decode()
    del jpeg_bytes
    gc.collect()

    field_lines = "\n".join(f'- "{f.name}": {f.question}' for f in req.fields)

    prompt = f"""You are a form data extractor. Extract the following fields from this form image.

Fields to extract:
{field_lines}

Return ONLY a JSON object — no explanation, no markdown fences:
{{
  "fieldName": {{"value": "extracted text", "confidence": 0.95}},
  ...
}}

Confidence scoring rules:
- 0.90–0.99: clearly printed, unambiguous
- 0.70–0.89: mostly clear but some uncertainty
- 0.40–0.69: handwritten or partially legible
- 0.00–0.39: very hard to read or not found

Additional rules:
- For "requestType" only output one of: loan, refund, account
- For "amount" output only the numeric value (no $ or commas)
- If a field is not present on the form, return {{"value": "", "confidence": 0.0}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": img_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        del img_b64
        gc.collect()

        raw = message.content[0].text.strip()
        # Strip markdown fences if Claude added them despite the instruction
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Claude returned invalid JSON: {e}")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")

    results: dict[str, FieldResult] = {}
    for field in req.fields:
        entry = parsed.get(field.name, {})
        results[field.name] = FieldResult(
            value=str(entry.get("value", "")),
            confidence=float(entry.get("confidence", 0.0)),
        )

    print(f"[docai] extracted via Claude: { {k: v.value for k, v in results.items()} }")
    return ExtractResponse(fields=results)

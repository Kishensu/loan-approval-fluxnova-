import base64
import io
import os
import re
import threading
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel
from transformers import DonutProcessor, VisionEncoderDecoderModel

try:
    from pdf2image import convert_from_bytes
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

MODEL_NAME = os.getenv("MODEL_NAME", "naver-clova-ix/donut-base-finetuned-docvqa")

_processor: Optional[DonutProcessor] = None
_model: Optional[VisionEncoderDecoderModel] = None
_model_error: Optional[str] = None


def _load_model():
    global _processor, _model, _model_error
    try:
        print(f"[docai] Loading {MODEL_NAME} in background…")
        _processor = DonutProcessor.from_pretrained(MODEL_NAME)
        _model = VisionEncoderDecoderModel.from_pretrained(MODEL_NAME)
        _model.eval()
        print("[docai] Model ready.")
    except Exception as exc:
        _model_error = str(exc)
        print(f"[docai] Model loading FAILED: {exc}")


# Start loading immediately so uvicorn can serve /health right away.
# The lifespan approach blocks all connections until loading completes,
# which exhausts the Docker healthcheck retries before the model is ready.
threading.Thread(target=_load_model, daemon=True).start()

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


def run_docvqa(image: Image.Image, question: str) -> tuple[str, float]:
    task_prompt = f"<s_docvqa><s_question>{question}</s_question><s_answer>"
    decoder_input_ids = _processor.tokenizer(
        task_prompt, add_special_tokens=False, return_tensors="pt"
    ).input_ids

    pixel_values = _processor(image, return_tensors="pt").pixel_values

    with torch.no_grad():
        outputs = _model.generate(
            pixel_values,
            decoder_input_ids=decoder_input_ids,
            max_new_tokens=128,
            pad_token_id=_processor.tokenizer.pad_token_id,
            eos_token_id=_processor.tokenizer.eos_token_id,
            bad_words_ids=[[_processor.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
            output_scores=True,
        )

    sequence = _processor.batch_decode(outputs.sequences)[0]
    sequence = (
        sequence
        .replace(_processor.tokenizer.eos_token, "")
        .replace(_processor.tokenizer.pad_token, "")
    )

    match = re.search(r"<s_answer>(.*?)(?:</s_answer>|$)", sequence, re.DOTALL)
    answer = match.group(1).strip() if match else ""

    if outputs.scores:
        probs = [torch.softmax(s[0], dim=-1).max().item() for s in outputs.scores]
        confidence = float(sum(probs) / len(probs)) if probs else 0.0
    else:
        confidence = 0.0

    return answer, confidence


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        image = load_image(req.image_base64, req.media_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    results: dict[str, FieldResult] = {}
    for field in req.fields:
        try:
            value, confidence = run_docvqa(image, field.question)
            results[field.name] = FieldResult(value=value, confidence=round(confidence, 4))
        except Exception as e:
            print(f"[docai] Field '{field.name}' failed: {e}")
            results[field.name] = FieldResult(value="", confidence=0.0)

    return ExtractResponse(fields=results)

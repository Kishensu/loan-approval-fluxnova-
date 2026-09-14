FROM python:3.11-slim

# poppler-utils for pdf2image; curl for Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install CPU-only PyTorch first so pip doesn't pull the larger GPU wheel later
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download model weights at build time so container startup is fast.
# WARNING: downloads ~1.5 GB (Donut weights + tokenizer + torch deps).
#          First build takes several minutes and requires internet access.
RUN python -c "\
from transformers import DonutProcessor, VisionEncoderDecoderModel; \
DonutProcessor.from_pretrained('naver-clova-ix/donut-base-finetuned-docvqa'); \
VisionEncoderDecoderModel.from_pretrained('naver-clova-ix/donut-base-finetuned-docvqa')"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

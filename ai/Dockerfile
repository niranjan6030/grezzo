# CPU-only image. The free tiers do not give you a GPU, and neither of
# these models needs one for single-request inference.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GREZZO_MODEL_DIR=/app/models \
    HF_HOME=/app/.cache

WORKDIR /app

# Torch's CPU wheels are a fraction of the CUDA ones — worth the extra line.
COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

COPY . .

# Hugging Face Spaces expects 7860; everything else reads $PORT.
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-7860}"]

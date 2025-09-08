FROM python:3.11-slim AS builder

WORKDIR /wheels

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip wheel \
      --no-cache-dir \
      --wheel-dir . \
      -r requirements.txt

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .

RUN pip install \
      --no-cache-dir \
      --no-index \
      --find-links=/wheels \
      -r requirements.txt \
 && rm -rf /wheels

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

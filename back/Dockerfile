# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /wheels

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Secret BuildKit optionnel pour un index Python privé :
# docker build --secret id=pip_config,src=$HOME/.config/pip/pip.conf ...
# Le secret n'est monté que pour cette commande et n'est jamais copié dans l'image.
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked \
    --mount=type=secret,id=pip_config,target=/run/secrets/pip.conf,required=false \
    sh -euxc 'if [ -f /run/secrets/pip.conf ]; then export PIP_CONFIG_FILE=/run/secrets/pip.conf; fi; pip wheel --wheel-dir . -r requirements.txt'

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV HOME=/home/appuser
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

RUN groupadd --system --gid 1000 appuser \
 && useradd --system --uid 1000 --gid 1000 --create-home --home-dir /home/appuser --shell /usr/sbin/nologin appuser \
 && mkdir -p /var/lib/celery \
 && chown -R 1000:1000 /app /var/lib/celery /home/appuser

USER 1000:1000

EXPOSE 8000

CMD ["gunicorn", "-c", "/app/gunicorn.conf.py", "main:app"]

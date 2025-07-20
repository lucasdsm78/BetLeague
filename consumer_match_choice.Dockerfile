# Utilise une image Python légère comme base
FROM python:3.11-slim

RUN pip install pika &&  apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*
ENV PYTHONUNBUFFERED=1
# declare the source directory
WORKDIR /app

# copy the file
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app

# start command
CMD [ "python", "consumer_match_choice_main.py" ]

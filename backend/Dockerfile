FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
ARG TORCH_EXTRA_INDEX_URL=""
RUN if [ -n "$TORCH_EXTRA_INDEX_URL" ]; then \
      pip install --no-cache-dir --extra-index-url "$TORCH_EXTRA_INDEX_URL" -r requirements.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi
COPY . .
RUN mkdir -p models datasets/cicids2017 datasets/unsw_nb15 datasets/nsl_kdd datasets/cicids2018
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

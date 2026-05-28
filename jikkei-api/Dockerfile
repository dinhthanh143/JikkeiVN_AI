FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# One image supports both modes: fast reload in dev, multi-worker robustness in production.
CMD ["sh", "-c", "if [ \"$ENVIRONMENT\" = \"production\" ]; then gunicorn app.main:app -c gunicorn.conf.py; else uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload; fi"]

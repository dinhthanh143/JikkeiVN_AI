"""
Gunicorn production server configuration for Jikkei API.

Why Gunicorn in production:
- Multiple worker processes use available CPU cores.
- Crashed workers are restarted automatically.
- Request caps and graceful shutdown reduce outage blast radius.
"""

import multiprocessing

# One async worker per CPU core provides strong throughput for I/O-bound APIs.
workers = multiprocessing.cpu_count()

# Use Uvicorn worker class so FastAPI runs as ASGI under Gunicorn supervision.
worker_class = "uvicorn.workers.UvicornWorker"

# Periodic worker recycling mitigates slow memory growth over long uptimes.
max_requests = 1000
# Jitter avoids synchronized worker restarts that would cause latency spikes.
max_requests_jitter = 100

# Timeout protects the pool from permanently hung workers.
timeout = 30
# Graceful timeout lets in-flight requests finish before forced termination.
graceful_timeout = 30

bind = "0.0.0.0:8000"
loglevel = "info"

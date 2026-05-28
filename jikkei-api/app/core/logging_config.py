"""
Structured logging setup for Jikkei API.

Why JSON logs: text logs are human-readable but hard for centralized
log systems to parse and query. JSON logs are indexable and alertable.
Why loguru: simpler setup with robust exception formatting and sinks.
"""

import logging
import sys

from loguru import logger


class InterceptHandler(logging.Handler):
    """
    Route stdlib logging through loguru so framework and app logs share one stream.
    """

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            # Preserve custom numeric levels emitted by some third-party libraries.
            level = record.levelno

        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging(log_level: str = "INFO", json_logs: bool = False) -> None:
    """
    Configure unified logging.

    Dev mode: colored, readable text.
    Prod mode: JSON for log aggregation and alerting pipelines.
    """
    logger.remove()

    if json_logs:
        logger.add(
            sys.stdout,
            level=log_level,
            format="{time:YYYY-MM-DDTHH:mm:ss.SSS}Z | {level} | {name}:{line} | {message}",
            # JSON serialization keeps each line machine-parseable in central log systems.
            serialize=True,
        )
    else:
        logger.add(
            sys.stdout,
            level=log_level,
            format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> | {message}",
            colorize=True,
        )

    # Force all stdlib logs into the same interceptor for correlation across subsystems.
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for lib in ["uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine"]:
        logging.getLogger(lib).handlers = [InterceptHandler()]
        logging.getLogger(lib).propagate = False

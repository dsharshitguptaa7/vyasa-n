import logging
import sys
from app.core.config import settings


def setup_logging() -> logging.Logger:
    """
    Configure uniform structured logging for the VYASA Core backend.
    """
    logger = logging.getLogger("vyasa.core")
    log_level = logging.DEBUG if settings.NODE_ENV == "development" else logging.INFO
    logger.setLevel(log_level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()

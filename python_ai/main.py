"""Riverr AI Service - Entry point for Cloud Run"""
import uvicorn
from api import app
from config import PORT, DEBUG


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        workers=4,
        log_level="info" if DEBUG else "warning",
        access_log=DEBUG,
    )

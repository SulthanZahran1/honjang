"""Honjang FastAPI application.

Provides:
- GET /health — health check
- WS /ws — WebSocket endpoint for translator sessions
- GET /api/sessions — list past sessions
- GET /api/sessions/{session_id}/turns — get session transcript
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.config import Settings, settings as default_settings
from app.session.store import SessionStore
from app.websocket.handler import WebSocketHandler
from app.websocket.protocol import Error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        settings: Optional settings override. Defaults to the global settings.
    """
    s = settings or default_settings
    app = FastAPI(title="Honjang Backend", version="0.1.0")

    # CORS for Expo/mobile client
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Session store (async SQLite)
    db_url = f"sqlite+aiosqlite:///{s.sqlite_path}"
    session_store = SessionStore(db_url)

    # WebSocket handler
    ws_handler = WebSocketHandler(settings=s, session_store=session_store)

    @app.on_event("startup")
    async def startup() -> None:
        await session_store.init()
        logger.info("Session store initialized at %s", s.sqlite_path)

    @app.get("/", response_class=HTMLResponse)
    async def root() -> str:
        index_path = os.path.join(os.path.dirname(__file__), "..", "static", "index.html")
        with open(index_path, encoding="utf-8") as f:
            return f.read()

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "honjang-backend", "version": "0.1.0"}

    @app.websocket("/ws")
    async def websocket_endpoint(ws: WebSocket) -> None:
        await ws_handler.handle(ws)

    @app.get("/api/sessions")
    async def list_sessions() -> list[dict]:
        return await session_store.list_sessions()

    @app.get("/api/sessions/{session_id}/turns")
    async def get_session_turns(session_id: int) -> list[dict]:
        return await session_store.get_session_turns(session_id)

    return app


app = create_app()
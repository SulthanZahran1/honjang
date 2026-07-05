from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.session.models import Base, Session, Turn


class SessionStore:
    def __init__(self, db_url: str) -> None:
        self.engine = create_async_engine(db_url)
        self.sessionmaker = async_sessionmaker(
            self.engine, expire_on_commit=False, class_=AsyncSession
        )

    async def init(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def create_session(self, llm_model: str) -> int:
        async with self.sessionmaker() as session:
            obj = Session(llm_model=llm_model)
            session.add(obj)
            await session.commit()
            return obj.id

    async def add_turn(
        self,
        session_id: int,
        direction: str,
        original_text: str,
        translated_text: str,
        detected_language: str | None = None,
    ) -> None:
        async with self.sessionmaker() as session:
            turn = Turn(
                session_id=session_id,
                direction=direction,
                original_text=original_text,
                translated_text=translated_text,
                detected_language=detected_language,
            )
            session.add(turn)
            await session.commit()

    async def get_session_turns(self, session_id: int) -> list[dict]:
        async with self.sessionmaker() as session:
            result = await session.execute(
                select(Turn).where(Turn.session_id == session_id).order_by(Turn.id)
            )
            turns = result.scalars().all()
            return [
                {
                    "id": t.id,
                    "direction": t.direction,
                    "original_text": t.original_text,
                    "translated_text": t.translated_text,
                    "detected_language": t.detected_language,
                    "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                }
                for t in turns
            ]

    async def list_sessions(self) -> list[dict]:
        async with self.sessionmaker() as session:
            result = await session.execute(select(Session).order_by(Session.id))
            sessions = result.scalars().all()
            return [
                {
                    "id": s.id,
                    "llm_model": s.llm_model,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "ended_at": s.ended_at.isoformat() if s.ended_at else None,
                }
                for s in sessions
            ]

    async def end_session(self, session_id: int) -> None:
        async with self.sessionmaker() as session:
            await session.execute(
                update(Session)
                .where(Session.id == session_id)
                .values(ended_at=datetime.utcnow())
            )
            await session.commit()
import pytest
from app.session.store import SessionStore


@pytest.fixture
async def store():
    s = SessionStore('sqlite+aiosqlite:///:memory:')
    await s.init()
    return s


@pytest.mark.asyncio
async def test_create_session(store):
    session_id = await store.create_session(llm_model='google/gemini-3.1-flash-lite')
    assert session_id is not None


@pytest.mark.asyncio
async def test_add_turn(store):
    session_id = await store.create_session(llm_model='test-model')
    await store.add_turn(
        session_id=session_id,
        direction='en_to_ko',
        original_text='Hello',
        translated_text='안녕하세요',
        detected_language='en',
    )
    turns = await store.get_session_turns(session_id)
    assert len(turns) == 1
    assert turns[0]['original_text'] == 'Hello'
    assert turns[0]['translated_text'] == '안녕하세요'


@pytest.mark.asyncio
async def test_list_sessions(store):
    s1 = await store.create_session(llm_model='model-a')
    s2 = await store.create_session(llm_model='model-b')
    sessions = await store.list_sessions()
    assert len(sessions) == 2


@pytest.mark.asyncio
async def test_end_session(store):
    session_id = await store.create_session(llm_model='test')
    await store.end_session(session_id)
    sessions = await store.list_sessions()
    assert sessions[0]['ended_at'] is not None
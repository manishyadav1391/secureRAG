from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.services import retrieval_service, llm_service
from app.auth.dependencies import get_current_user
from app.models import models
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

SYSTEM_PROMPT_TEMPLATE = """
You are an internal corporate assistant answering questions using ONLY the provided document excerpts.
If the answer cannot be confidently derived from the context, say so honestly—do not attempt to guess or hallucinate.

You must respond ONLY with a valid JSON object matching this structure:
{{
  "answer": "Your detailed answer here based strictly on the context.",
  "suggested_questions": ["Follow-up question 1?", "Follow-up question 2?"]
}}
Do not include any extra text outside of the JSON markdown wrapper.
"""


# --- Session Management ---

@router.post("/sessions")
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new chat session."""
    session = models.ChatSession(
        user_id=current_user.id,
        title=payload.title or "New Chat",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all chat sessions for the current user, newest first."""
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "message_count": len(s.messages),
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Load all messages for a specific chat session."""
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session.id,
        "title": session.title,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "source_chunks": m.source_chunks,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in session.messages
        ],
    }


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a chat session and all its messages."""
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}


@router.patch("/sessions/{session_id}")
def update_session_title(
    session_id: int,
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update the title of a chat session."""
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.title = payload.title or session.title
    db.commit()
    return {"message": "Session title updated", "title": session.title}


# --- Chat Message ---

@router.post("/message")
def handle_chat_message(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Auto-create session if none provided
    session = None
    if payload.session_id:
        session = (
            db.query(models.ChatSession)
            .filter(
                models.ChatSession.id == payload.session_id,
                models.ChatSession.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        # Create a new session with first message as title
        title = payload.message[:80] + ("..." if len(payload.message) > 80 else "")
        session = models.ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        db.commit()
        db.refresh(session)

    # Save user message
    user_msg = models.ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.message,
    )
    db.add(user_msg)
    db.commit()

    # 1. Fetch accessible fragments
    context_chunks = retrieval_service.get_accessible_chunks(
        query_text=payload.message,
        user_id=current_user.id,
        user_role=current_user.role,
        db=db,
    )

    # 2. Compile context string and collect source metadata
    context_str = ""
    source_chunks_meta = []
    for chunk in context_chunks:
        context_str += f"\n--- Excerpt from Document: {chunk.title} (Page {chunk.page_number}) ---\n{chunk.content}\n"
        source_chunks_meta.append(
            {
                "doc_title": chunk.title,
                "page_number": chunk.page_number,
                "content_preview": chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content,
            }
        )

    # 3. Check if matching restricted items exist
    restricted_hint = retrieval_service.check_for_restricted_docs(
        query_text=payload.message,
        user_id=current_user.id,
        user_role=current_user.role,
        db=db,
    )

    # 4. Build conversation history for context
    history_messages = []
    prev_messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session.id)
        .order_by(models.ChatMessage.created_at)
        .all()
    )
    # Include last 10 messages for context (excluding the just-saved user message)
    for msg in prev_messages[-11:-1]:
        history_messages.append({"role": msg.role, "content": msg.content})

    # 5. Generate prompts
    augmented_user_message = (
        f"Context Material:\n{context_str}\n\nUser Question: {payload.message}"
    )

    try:
        # Call the configured multi-provider model wrapper
        llm_response = llm_service.call_llm(
            system_prompt=SYSTEM_PROMPT_TEMPLATE,
            user_message=augmented_user_message,
            history=history_messages if history_messages else None,
            provider=payload.provider,
            model_name=payload.model_name,
        )

        # Save assistant message with source chunks
        assistant_msg = models.ChatMessage(
            session_id=session.id,
            role="assistant",
            content=llm_response.get("answer", ""),
            source_chunks=source_chunks_meta if source_chunks_meta else None,
        )
        db.add(assistant_msg)

        # Update session title if it's the first exchange
        msg_count = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.session_id == session.id)
            .count()
        )
        if msg_count <= 2:
            session.title = payload.message[:80] + ("..." if len(payload.message) > 80 else "")

        db.commit()

        # Inject the restricted reference metadata if discovered
        llm_response["restricted_reference"] = restricted_hint
        llm_response["session_id"] = session.id
        llm_response["source_chunks"] = source_chunks_meta
        return llm_response

    except Exception as e:
        logger.error(f"LLM Processing Failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"LLM Processing Failed: {str(e)}"
        )
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import models
from app.auth.dependencies import get_current_user, RoleChecker
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Admin-Only Endpoints ---

@router.get("/users", dependencies=[Depends(RoleChecker(["admin"]))])
def list_all_users(db: Session = Depends(get_db)):
    """List all registered users."""
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.delete("/users/{user_id}", dependencies=[Depends(RoleChecker(["admin"]))])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_user),
):
    """Delete a user by ID. Admins cannot delete themselves."""
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=400, detail="You cannot delete your own account."
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    logger.info(f"Admin {current_admin.email} deleted user {user.email}")
    return {"message": f"User '{user.name}' deleted successfully."}


@router.get("/stats", dependencies=[Depends(RoleChecker(["admin"]))])
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get aggregate stats for the admin dashboard."""
    total_users = db.query(func.count(models.User.id)).scalar()
    total_documents = db.query(func.count(models.Document.id)).scalar()
    total_chunks = db.query(func.count(models.DocumentChunk.id)).scalar()
    pending_requests = (
        db.query(func.count(models.AccessRequest.id))
        .filter(models.AccessRequest.status == "pending")
        .scalar()
    )
    total_sessions = db.query(func.count(models.ChatSession.id)).scalar()

    return {
        "total_users": total_users,
        "total_documents": total_documents,
        "total_chunks": total_chunks,
        "pending_requests": pending_requests,
        "total_sessions": total_sessions,
    }


@router.get("/documents", dependencies=[Depends(RoleChecker(["admin"]))])
def list_all_documents(db: Session = Depends(get_db)):
    """List all documents with metadata."""
    docs = db.query(models.Document).order_by(models.Document.created_at.desc()).all()
    result = []
    for doc in docs:
        chunk_count = (
            db.query(func.count(models.DocumentChunk.id))
            .filter(models.DocumentChunk.document_id == doc.id)
            .scalar()
        )
        result.append(
            {
                "id": doc.id,
                "filename": doc.filename,
                "title": doc.title,
                "min_role": doc.min_role,
                "is_critical": doc.is_critical,
                "chunk_count": chunk_count,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
            }
        )
    return result

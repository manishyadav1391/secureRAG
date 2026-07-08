from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime
import logging
from app.database import get_db
from app.models import models
from app.auth.dependencies import get_current_user, RoleChecker
from app.services import email_service

logger = logging.getLogger(__name__)

router = APIRouter()

class RequestCreate(BaseModel):
    document_id: int
    reason: str

class DecisionUpdate(BaseModel):
    status: str # 'approved' or 'denied'

# --- 1. User Endpoints ---

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_access_request(
    payload: RequestCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Verify document exists
    doc = db.query(models.Document).filter(models.Document.id == payload.document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Check if a pending request already exists
    existing = db.query(models.AccessRequest).filter(
        models.AccessRequest.user_id == current_user.id,
        models.AccessRequest.document_id == payload.document_id,
        models.AccessRequest.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Pending request already exists for this document")

    # Create request
    new_req = models.AccessRequest(
        user_id=current_user.id,
        document_id=payload.document_id,
        reason=payload.reason
    )
    db.add(new_req)
    db.commit()
    
    # Trigger email notification (non-blocking — don't fail if email fails)
    try:
        doc_title = doc.title or doc.filename or f"Document #{doc.id}"
        email_service.send_access_request_email_to_admin(
            current_user.name, doc_title, payload.reason
        )
    except Exception as e:
        logger.error(f"Failed to send admin notification email: {e}")
    
    return {"message": "Access request submitted successfully."}


# --- 2. Admin Endpoints ---

@router.get("/pending", dependencies=[Depends(RoleChecker(["admin"]))])
def get_pending_requests(db: Session = Depends(get_db)):
    requests = db.query(models.AccessRequest).filter(models.AccessRequest.status == "pending").all()
    # Enrich with user name and document title
    result = []
    for req in requests:
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
        doc = db.query(models.Document).filter(models.Document.id == req.document_id).first()
        result.append({
            "id": req.id,
            "user_id": req.user_id,
            "user_name": user.name if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "document_id": req.document_id,
            "document_title": doc.title if doc else f"Doc #{req.document_id}",
            "reason": req.reason,
            "status": req.status,
            "requested_at": req.requested_at.isoformat() if req.requested_at else None,
        })
    return result

@router.patch("/{request_id}", dependencies=[Depends(RoleChecker(["admin"]))])
def resolve_access_request(
    request_id: int, 
    payload: DecisionUpdate, 
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_current_user)
):
    if payload.status not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'denied'")
        
    req = db.query(models.AccessRequest).filter(models.AccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request has already been decided")

    # Update request status
    req.status = payload.status
    req.decided_by = current_admin.id
    req.decided_at = datetime.utcnow()
    
    doc = db.query(models.Document).filter(models.Document.id == req.document_id).first()
    user = db.query(models.User).filter(models.User.id == req.user_id).first()

    # If approved, grant permanent override
    if payload.status == "approved":
        override = models.UserDocumentOverride(
            user_id=req.user_id,
            document_id=req.document_id,
            granted_by=current_admin.id
        )
        db.add(override)
        
    db.commit()
    
    # Notify user via email (non-blocking — don't fail if email fails)
    if user and doc:
        try:
            doc_title = doc.title or doc.filename or f"Document #{doc.id}"
            email_service.send_decision_email_to_user(
                user.email, doc_title, payload.status
            )
        except Exception as e:
            logger.error(f"Failed to send decision email to {user.email}: {e}")
    else:
        logger.warning(
            f"Could not send decision email: user={user is not None}, doc={doc is not None}"
        )
    
    return {"message": f"Request {payload.status} successfully."}
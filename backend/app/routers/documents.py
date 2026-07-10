from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import models
from app.services import doc_parser, embedding_service
import os
import shutil
from app.auth.dependencies import RoleChecker

router = APIRouter()

# Ensure an uploads directory exists
os.makedirs("uploads", exist_ok=True)

@router.post("/upload",dependencies=[Depends(RoleChecker(["admin"]))])
async def upload_document(
    file: UploadFile = File(...),
    min_role: str = Form("employee"),
    is_critical: bool = Form(False),
    db: Session = Depends(get_db)
):
    import uuid
    if min_role not in ["admin", "manager", "employee"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    # Extract only the base filename to prevent directory traversal
    safe_filename = os.path.basename(file.filename)

    # 1. Save file locally with a unique name
    unique_filename = f"{uuid.uuid4()}_{safe_filename}"
    file_path = f"uploads/{unique_filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Extract text based on file type
    file_bytes = open(file_path, "rb").read()
    if safe_filename.endswith(".pdf"):
        text = doc_parser.extract_text_from_pdf(file_bytes)
    elif safe_filename.endswith(".docx"):
        text = doc_parser.extract_text_from_docx(file_bytes)
    else:
        # Cleanup the file if it's unsupported
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="Unsupported file format")

    # 3. Create Document record in DB
    new_doc = models.Document(
        filename=safe_filename,
        title=safe_filename, # You can enhance this to accept a custom title
        min_role=min_role,
        is_critical=is_critical,
        file_path=file_path
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # 4. Chunk text and create embeddings
    chunks = doc_parser.chunk_text(text)
    embeddings = embedding_service.get_embeddings(chunks)

    # 5. Save chunks and vectors to DB
    for chunk_text, embedding in zip(chunks, embeddings):
        doc_chunk = models.DocumentChunk(
            document_id=new_doc.id,
            content=chunk_text,
            embedding=embedding,
            min_role=min_role
        )
        db.add(doc_chunk)
    
    db.commit()

    return {"message": f"Successfully processed {len(chunks)} chunks for {safe_filename}", "document_id": new_doc.id}

@router.delete("/{doc_id}", dependencies=[Depends(RoleChecker(["admin"]))])
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    # 1. Fetch document from DB
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. Delete the physical file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            # Log error but proceed to clean database
            print(f"Error removing physical file {doc.file_path}: {e}")

    # 3. Clean database records
    # Delete dependent overrides
    db.query(models.UserDocumentOverride).filter(models.UserDocumentOverride.document_id == doc_id).delete()
    # Delete dependent access requests
    db.query(models.AccessRequest).filter(models.AccessRequest.document_id == doc_id).delete()
    # Delete chunks
    db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id == doc_id).delete()
    # Delete document record
    db.delete(doc)
    db.commit()

    return {"message": f"Document '{doc.filename}' and all its associated chunks and metadata have been deleted."}

@router.get("/download/{doc_id}", dependencies=[Depends(RoleChecker(["admin"]))])
def download_document(doc_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found on disk")

    return FileResponse(
        path=doc.file_path,
        filename=doc.filename,
        media_type="application/octet-stream"
    )
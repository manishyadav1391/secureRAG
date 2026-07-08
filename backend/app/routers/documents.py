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
    if min_role not in ["admin", "manager", "employee"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    # 1. Save file locally
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 2. Extract text based on file type
    file_bytes = open(file_path, "rb").read()
    if file.filename.endswith(".pdf"):
        text = doc_parser.extract_text_from_pdf(file_bytes)
    elif file.filename.endswith(".docx"):
        text = doc_parser.extract_text_from_docx(file_bytes)
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format")

    # 3. Create Document record in DB
    new_doc = models.Document(
        filename=file.filename,
        title=file.filename, # You can enhance this to accept a custom title
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

    return {"message": f"Successfully processed {len(chunks)} chunks for {file.filename}", "document_id": new_doc.id}
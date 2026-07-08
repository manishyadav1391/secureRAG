from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services import embedding_service

ROLE_HIERARCHY = {
    "admin": ["admin", "manager", "employee"],
    "manager": ["manager", "employee"],
    "employee": ["employee"]
}

def get_accessible_chunks(query_text: str, user_id: int, user_role: str, db: Session, limit: int = 5):
    """Retrieves document chunks authorized by role OR by a specific user override."""
    query_embedding = embedding_service.get_embeddings([query_text])[0]
    allowed_roles = ROLE_HIERARCHY.get(user_role, ["employee"])
    
    sql = text("""
        SELECT dc.content, dc.document_id, dc.page_number, d.title
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        LEFT JOIN user_document_overrides udo 
            ON d.id = udo.document_id AND udo.user_id = :user_id
        WHERE (dc.min_role IN :allowed_roles OR udo.id IS NOT NULL)
        ORDER BY dc.embedding <=> :embedding
        LIMIT :limit
    """)
    
    results = db.execute(sql, {
        "allowed_roles": tuple(allowed_roles),
        "user_id": user_id,
        "embedding": str(query_embedding), 
        "limit": limit
    }).fetchall()
    
    return results

def check_for_restricted_docs(query_text: str, user_id: int, user_role: str, db: Session, limit: int = 2):
    """
    Checks for highly relevant chunks the user is NOT authorized to see, 
    ensuring we don't flag documents they already have an override for.
    """
    query_embedding = embedding_service.get_embeddings([query_text])[0]
    allowed_roles = ROLE_HIERARCHY.get(user_role, ["employee"])
    
    sql = text("""
        SELECT DISTINCT d.id, d.title, dc.embedding <=> :embedding as distance
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        LEFT JOIN user_document_overrides udo 
            ON d.id = udo.document_id AND udo.user_id = :user_id
        WHERE dc.min_role NOT IN :allowed_roles
          AND udo.id IS NULL
        ORDER BY distance
        LIMIT :limit
    """)
    
    results = db.execute(sql, {
        "allowed_roles": tuple(allowed_roles),
        "user_id": user_id,
        "embedding": str(query_embedding), 
        "limit": limit
    }).fetchall()
    
    restricted_docs = []
    for row in results:
        if row.distance < 0.6: 
            restricted_docs.append({"document_id": row.id, "title": row.title})
            
    return restricted_docs[0] if restricted_docs else None
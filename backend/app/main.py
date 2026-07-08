from fastapi import FastAPI
from app.models import models
from app.database import engine
from app.routers import documents, chat, auth, access_requests, admin

from fastapi.middleware.cors import CORSMiddleware

# Create database tables automatically
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Internal Doc Q&A Chatbot")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(access_requests.router, prefix="/access-requests", tags=["Access Requests"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])

@app.get("/")
def read_root():
    return {"status": "API is running"}
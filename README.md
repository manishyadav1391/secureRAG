# SecurRAG — Secured Knowledge Base RAG Chatbot

SecurRAG is an enterprise-grade, internal corporate knowledge base chatbot powered by Retrieval-Augmented Generation (RAG) and JWT-based Role-Based Access Control (RBAC). It enables employees, managers, and administrators to securely query corporate documents (PDFs, DOCX) while strictly respecting document-level access permissions.

---

## 🚀 Key Features

### 🔒 Role-Based Access Control (RBAC)
- Three defined user roles: `admin`, `manager`, and `employee`.
- Document uploading allows configuring the minimum role level required to access files.
- Documents marked as "Critical" receive extra layer auditing.

### ⚙️ Context-Aware RAG Chatbot
- Ask questions about corporate files securely.
- **Source Referencing**: Expands to show exactly which document and page number were referenced, complete with a content excerpt.
- **Markdown Rendering**: Beautiful rendering of list formatting, bold markers, headers, and tables returned by the LLM.
- **Session Persistence**: Complete chat history sidebar. Save, delete, rename, and continue past chat sessions.
- **Multi-LLM Provider Support**: Toggleable settings for **Ollama** (default, `gpt-oss:120b`), Gemini (`gemini-1.5-flash`), OpenAI, or Anthropic.

### 🔑 Interactive Access Request System
- If relevant details to your query reside in a restricted document, SecurRAG returns a warning block stating that matching information exists in a file you don't have access to.
- Includes a built-in **"Request Access"** prompt allowing users to submit access requests directly in the chat interface.
- Sends SMTP-based email alerts to administrators for approval, and notifies the requesting user on approval or denial.
- Admin dashboard allows visual management (approve/deny) of all pending requests.

### 📊 Admin Panel & User Registry
- High-level metrics: Total users, documents indexed, database chunks, and pending requests.
- Registry to register new users, specify roles (`employee`/`manager`/`admin`), or remove users.
- Document processor to upload files, configure minimum roles, and review the chunk index.

---

## 🛠 Tech Stack

- **Backend**: Python 3.x, FastAPI, SQLite (SQLAlchemy ORM), Uvicorn.
- **Frontend**: Next.js 15+ (App Router), React 19, Tailwind CSS v4, TypeScript, Lucide Icons, React Markdown.
- **Authentication**: JWT (JSON Web Tokens) with secure password hashing.
- **Email Service**: SMTP integration with HTML email templates and inline styling.

---

## 📁 Repository Structure

```
chatbot-project/
├── backend/                  # FastAPI Backend API
│   ├── app/
│   │   ├── auth/             # JWT, Auth Dependencies, and Role Middleware
│   │   ├── models/           # SQL Database Schemas (User, Doc, Session, Request)
│   │   ├── routers/          # API Endpoints (Auth, Chat, Admin, Docs, Requests)
│   │   ├── services/         # LLM service, Retrieval, Parsers, Email, Embeddings
│   │   ├── database.py       # SQL Database Session setup
│   │   ├── main.py           # FastAPI entrypoint
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # Next.js Frontend App
│   ├── app/                  # Next.js App Router (login, chat, admin dashboards)
│   ├── components/           # Reusable UI Components (Chat, Request Button, upload)
│   ├── lib/                  # API Client (Axios instances & interceptors)
│   ├── globals.css           # Custom scrollbars, glassmorphism utilities & animation styles
│   └── package.json          # Node dependencies
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (with npm)
- [Ollama](https://ollama.com/) (running locally, default model: `gpt-oss:120b` or configure to another model)

---

### 2. Backend Setup
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Mac/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables. Create a `.env` file in the `backend/` directory:
   ```env
   DATABASE_URL=sqlite:///./app.db
   SECRET_KEY=your-super-secret-jwt-key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=120

   # LLM Provider Configuration
   LLM_PROVIDER=ollama
   LLM_MODEL_NAME=gpt-oss:120b
   OLLAMA_HOST=http://localhost:11434

   # SMTP Configuration (Optional for notifications)
   SMTP_SERVER=smtp.example.com
   SMTP_PORT=587
   SMTP_EMAIL=your-email@example.com
   SMTP_PASSWORD=your-password
   ADMIN_EMAIL=admin@example.com
   FRONTEND_URL=http://localhost:3000
   ```
5. Run the backend server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   *The SQLite database (`app.db`) is automatically initialized on the first startup.*

---

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3000`.

---

## 🔑 Default Credentials

If the database is clean, run the backend to auto-initialize it. You can register users via the frontend admin registration form once signed in as an admin.

To set up an initial admin account directly, register or seed it in the database with the role `'admin'`.
- Default UI login redirects automatically based on role:
  - `admin` role -> redirects to `/admin`
  - `manager`/`employee` role -> redirects to `/chat`

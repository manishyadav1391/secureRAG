import io
# from pypdf import PdfReader
import pdfplumber
import docx

# def extract_text_from_pdf(file_bytes: bytes) -> str:
#     reader = PdfReader(io.BytesIO(file_bytes))
#     text = ""
#     for page in reader.pages:
#         if page.extract_text():
#             text += page.extract_text() + "\n"
#     return text

def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    # pdfplumber is much better at preserving table layouts and spacing
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            # extract_text(layout=True) keeps the visual spacing of tables!
            page_text = page.extract_text(layout=True) 
            if page_text:
                text += page_text + "\n\n"
    return text

def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """Splits text into chunks by character count with a slight overlap."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
        
    return chunks
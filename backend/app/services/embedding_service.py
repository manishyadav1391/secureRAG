from sentence_transformers import SentenceTransformer

# Load the free, local embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Generates vector embeddings for a list of text chunks."""
    embeddings = model.encode(texts)
    return embeddings.tolist()
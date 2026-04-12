import os
import chromadb
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_store/")

# Lazy load the model as a singleton
_embed_model = None

def get_model():
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _embed_model

def get_chroma_client():
    os.makedirs(CHROMA_PATH, exist_ok=True)
    return chromadb.PersistentClient(path=CHROMA_PATH)

def embed_columns(columns_with_descriptions: dict[str, str], session_id: str):
    """
    Creates ChromaDB docs for each column.
    """
    client = get_chroma_client()
    collection_name = f"schema_{session_id.replace('-','_')}"
    
    # Create or get collection
    collection = client.get_or_create_collection(name=collection_name)
    
    model = get_model()
    
    docs = []
    metadatas = []
    ids = []
    embeddings = []
    
    for col_name, desc in columns_with_descriptions.items():
        doc_text = f"{col_name}: {desc}"
        docs.append(doc_text)
        metadatas.append({"column_name": col_name, "session_id": session_id})
        ids.append(col_name)
        
    if docs:
        embeddings = model.encode(docs).tolist()
        collection.add(
            documents=docs,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

def search_relevant_columns(question: str, session_id: str, top_k: int = 5) -> list[dict]:
    client = get_chroma_client()
    collection_name = f"schema_{session_id.replace('-','_')}"
    try:
        collection = client.get_collection(name=collection_name)
    except Exception:
        return []

    model = get_model()
    q_emb = model.encode([question]).tolist()
    
    results = collection.query(
        query_embeddings=q_emb,
        n_results=top_k
    )
    
    columns = []
    if results['metadatas'] and len(results['metadatas'][0]) > 0:
        for i in range(len(results['metadatas'][0])):
            meta = results['metadatas'][0][i]
            doc = results['documents'][0][i]
            # Extracted part after ": " is the description
            desc = doc.split(": ", 1)[1] if ": " in doc else doc
            columns.append({
                "column_name": meta["column_name"],
                "description": desc
            })
    return columns

def delete_collection(session_id: str):
    client = get_chroma_client()
    collection_name = f"schema_{session_id.replace('-','_')}"
    try:
        client.delete_collection(name=collection_name)
    except Exception:
        pass

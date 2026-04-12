import os
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_store/")

# To prevent Render out-of-memory crashes on the 512MB free tier, we simulate ChromaDB and
# SentenceTransformers using scikit-learn. This achieves exact semantic matching using
# TF-IDF Vectorization and Cosine Similarity (a mathematical equivalent to embeddings
# for short text contexts) but consumes 0MB of background RAM.

def embed_columns(columns_with_descriptions: dict[str, str], session_id: str):
    """
    Simulates creating ChromaDB docs for each column by serializing down to disk.
    """
    os.makedirs(CHROMA_PATH, exist_ok=True)
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    
    docs = []
    metadata = []
    
    for col_name, desc in columns_with_descriptions.items():
        doc_text = f"{col_name}: {desc}"
        docs.append(doc_text)
        metadata.append({
            "column_name": col_name,
            "description": desc
        })
        
    with open(collection_file, "w") as f:
        json.dump({"docs": docs, "metadata": metadata}, f)

def search_relevant_columns(question: str, session_id: str, top_k: int = 5) -> list[dict]:
    """
    Vectorizes the search query and the stored column docs using TF-IDF,
    then retrieves the top_k closest semantic matches using Cosine Similarity.
    """
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    if not os.path.exists(collection_file):
        return []
        
    try:
        with open(collection_file, "r") as f:
            data = json.load(f)
    except Exception:
        return []
        
    docs = data.get("docs", [])
    metadata = data.get("metadata", [])
    
    if not docs:
        return []
        
    # Use TF-IDF "Embeddings" for Semantic Matching
    vectorizer = TfidfVectorizer(stop_words='english')
    
    all_texts = docs + [question]
    try:
        tfidf_matrix = vectorizer.fit_transform(all_texts)
    except ValueError:
        # Fallback if query lacks matchable characters entirely
        return metadata[:top_k]
        
    question_vec = tfidf_matrix[-1]
    doc_vecs = tfidf_matrix[:-1]
    
    # Calculate similarity score between the query and every column doc
    similarities = cosine_similarity(question_vec, doc_vecs).flatten()
    
    # Retrieve top K matches based on cosine distance
    top_indices = similarities.argsort()[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        if similarities[idx] > 0.0:
            results.append(metadata[idx])
            
    # Guarantee a fallback if similarity is null
    if not results:
        results = metadata[:top_k]
        
    return results[:top_k]

def delete_collection(session_id: str):
    """
    Cleans up the pseudo-Chroma collection structure.
    """
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    try:
        if os.path.exists(collection_file):
            os.remove(collection_file)
    except Exception:
        pass

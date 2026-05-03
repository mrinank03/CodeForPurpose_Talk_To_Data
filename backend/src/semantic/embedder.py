import os
import json
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_store/")

# To prevent Render out-of-memory crashes on the 512MB free tier, we simulate ChromaDB and
# SentenceTransformers using scikit-learn. This achieves semantic matching using
# TF-IDF Vectorization and Cosine Similarity but consumes 0MB of background RAM.


def _stem_simple(word: str) -> str:
    """Minimal rule-based stemmer to handle plurals and common suffixes.
    TF-IDF has no built-in stemming, so 'categories' != 'category'.
    This fixes the most common mismatches without adding nltk dependency."""
    w = word.lower().strip()
    if len(w) <= 3:
        return w
    # Plurals
    if w.endswith("ies"):
        return w[:-3] + "y"       # categories -> category
    if w.endswith("ses") or w.endswith("xes") or w.endswith("zes"):
        return w[:-2]              # addresses -> address
    if w.endswith("s") and not w.endswith("ss"):
        return w[:-1]              # transactions -> transaction
    # -ing
    if w.endswith("ing") and len(w) > 5:
        return w[:-3]              # spending -> spend
    # -tion
    if w.endswith("tion"):
        return w[:-4] + "t"        # classification -> classificat (close enough for TF-IDF)
    return w


def _stem_text(text: str) -> str:
    """Apply simple stemming to every word in a text string."""
    words = re.findall(r'[a-zA-Z]+', text.lower())
    return " ".join(_stem_simple(w) for w in words)


def _direct_column_score(question: str, metadata: list[dict]) -> np.ndarray:
    """
    Direct column name matching as a fallback signal.
    If a word in the user's question is a substring of a column name (or vice versa),
    boost that column's score. This catches cases TF-IDF completely misses.
    """
    q_words = set(re.findall(r'[a-zA-Z]+', question.lower()))
    q_stems = set(_stem_simple(w) for w in q_words)
    
    scores = np.zeros(len(metadata))
    for i, meta in enumerate(metadata):
        col_name = meta["column_name"].lower().replace("_", " ")
        col_words = set(re.findall(r'[a-zA-Z]+', col_name))
        col_stems = set(_stem_simple(w) for w in col_words)
        
        # Check for direct word overlap or stem overlap
        word_overlap = q_words & col_words
        stem_overlap = q_stems & col_stems
        
        # Check substring matching (e.g., "spend" in "spending_category")
        substr_match = False
        for qw in q_words:
            if len(qw) >= 4:  # Only check meaningful words
                for cw in col_words:
                    if qw in cw or cw in qw:
                        substr_match = True
                        break
        
        if word_overlap:
            scores[i] = 0.8
        elif stem_overlap:
            scores[i] = 0.6
        elif substr_match:
            scores[i] = 0.4
    
    return scores


def embed_columns(columns_with_descriptions: dict[str, str], session_id: str):
    """
    Creates searchable document store for each column by serializing to disk.
    Stores both raw and stemmed versions for better matching.
    """
    os.makedirs(CHROMA_PATH, exist_ok=True)
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    
    docs = []
    stemmed_docs = []
    metadata = []
    
    for col_name, desc in columns_with_descriptions.items():
        doc_text = f"{col_name}: {desc}"
        docs.append(doc_text)
        stemmed_docs.append(_stem_text(doc_text))
        metadata.append({
            "column_name": col_name,
            "description": desc
        })
        
    with open(collection_file, "w") as f:
        json.dump({"docs": docs, "stemmed_docs": stemmed_docs, "metadata": metadata}, f)


def search_relevant_columns(question: str, session_id: str, top_k: int = 10) -> tuple[list[dict], float]:
    """
    Multi-strategy column matching:
      1. Raw TF-IDF on original text
      2. Stemmed TF-IDF (catches plurals like categories/category)
      3. Direct column name matching (catches substring matches)
      4. Condensed keyword pass for long queries (>20 words)
    Returns the element-wise maximum score across all strategies.
    """
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    if not os.path.exists(collection_file):
        return [], 0.0
        
    try:
        with open(collection_file, "r") as f:
            data = json.load(f)
    except Exception:
        return [], 0.0
        
    docs = data.get("docs", [])
    metadata = data.get("metadata", [])
    
    # Load stemmed docs (backward compatible with old format)
    stemmed_docs = data.get("stemmed_docs", [_stem_text(d) for d in docs])
    
    if not docs:
        return [], 0.0
    
    n_docs = len(docs)
    best_similarities = np.zeros(n_docs)
    
    # ── Strategy 1: Raw TF-IDF ──
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        all_texts = docs + [question]
        tfidf_matrix = vectorizer.fit_transform(all_texts)
        raw_sims = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1]).flatten()
        best_similarities = np.maximum(best_similarities, raw_sims)
    except ValueError:
        pass
    
    # ── Strategy 2: Stemmed TF-IDF ──
    try:
        stemmed_question = _stem_text(question)
        stemmed_vectorizer = TfidfVectorizer(stop_words='english')
        stemmed_texts = stemmed_docs + [stemmed_question]
        stemmed_matrix = stemmed_vectorizer.fit_transform(stemmed_texts)
        stemmed_sims = cosine_similarity(stemmed_matrix[-1], stemmed_matrix[:-1]).flatten()
        best_similarities = np.maximum(best_similarities, stemmed_sims)
    except ValueError:
        pass
    
    # ── Strategy 3: Direct column name matching ──
    direct_scores = _direct_column_score(question, metadata)
    best_similarities = np.maximum(best_similarities, direct_scores)
    
    # ── Strategy 4: Condensed keyword pass for long queries ──
    words_in_question = set(question.lower().split())
    if len(words_in_question) > 20:
        doc_words = set()
        for d in docs:
            doc_words.update(d.lower().split())
        
        overlap_words = words_in_question & doc_words
        if overlap_words:
            condensed_query = " ".join(overlap_words)
            try:
                condensed_texts = docs + [condensed_query]
                condensed_vectorizer = TfidfVectorizer(stop_words='english')
                condensed_matrix = condensed_vectorizer.fit_transform(condensed_texts)
                condensed_sims = cosine_similarity(condensed_matrix[-1], condensed_matrix[:-1]).flatten()
                best_similarities = np.maximum(best_similarities, condensed_sims)
            except Exception:
                pass
    
    # ── Retrieve top K ──
    top_indices = best_similarities.argsort()[-top_k:][::-1]
    
    results = []
    for idx in top_indices:
        if best_similarities[idx] > 0.0:
            results.append(metadata[idx])
            
    max_score = float(best_similarities[top_indices[0]]) if top_indices.size > 0 else 0.0
    
    if max_score == 0.0:
        return [], 0.0
        
    return results[:top_k], max_score


def delete_collection(session_id: str):
    """
    Cleans up the collection file.
    """
    collection_file = os.path.join(CHROMA_PATH, f"schema_{session_id}.json")
    try:
        if os.path.exists(collection_file):
            os.remove(collection_file)
    except Exception:
        pass

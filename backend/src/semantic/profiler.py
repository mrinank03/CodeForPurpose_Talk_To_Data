import json
import pandas as pd
from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_narrator_llm
from src.semantic.embedder import embed_columns

def infer_semantic_type(col_series: pd.Series) -> str:
    if pd.api.types.is_numeric_dtype(col_series):
        # Could be dimension if few unique
        if col_series.nunique() < 10 and len(col_series) > 50:
            return "dimension"
        return "measure"
    elif pd.api.types.is_datetime64_any_dtype(col_series):
        return "time"
    else:
        # Check if text looks like time roughly or just dimension
        if col_series.dropna().astype(str).str.contains(r'^\d{4}-\d{2}-\d{2}').any():
             # basic heuristics
             try:
                 pd.to_datetime(col_series.dropna().head(10))
                 return "time"
             except:
                 pass
        return "dimension"

def profile_dataset(df: pd.DataFrame, session_id: str) -> tuple[dict, dict]:
    """
    Profiles the dataframe, generates metric dict via LLM, embeds it, and returns (profile, metric_dict)
    """
    profile = {}
    for col in df.columns:
        series = df[col]
        null_pct = series.isnull().mean() * 100
        unique_cnt = series.nunique()
        sem_type = infer_semantic_type(series)
        
        sample_vals = []
        import math
        
        # Safe float conversion
        def safe_float(v):
            f = float(v)
            if math.isnan(f) or math.isinf(f):
                return None
            return f
            
        if sem_type == "dimension":
            sample_vals = series.dropna().value_counts().head(5).index.astype(str).tolist()
        elif sem_type == "measure":
            if not series.dropna().empty:
                s_min = safe_float(series.min())
                s_max = safe_float(series.max())
                s_med = safe_float(series.median())
                sample_vals = [f"min: {s_min}", f"median: {s_med}", f"max: {s_max}"]
        else: # time
            if not series.dropna().empty:
                sample_vals = series.dropna().astype(str).head(3).tolist()
                
        profile[col] = {
            "null_pct": safe_float(null_pct) if null_pct is not None else 0,
            "unique_count": int(unique_cnt) if pd.notna(unique_cnt) else 0,
            "type": sem_type,
            "samples": sample_vals
        }
    
    # Generate metric dictionary
    llm = get_narrator_llm()
    prompt_temp = PromptTemplate.from_template(
        "You are a data analyst. Given these column names and sample values from a business dataset, "
        "write a one-sentence plain-English description for each column explaining what it likely represents in a business context.\n\n"
        "Profile:\n{profile_json}\n\n"
        "Output ONLY a valid JSON object with column names as keys and descriptions as values. "
        "No markdown. No explanation. No preamble."
    )
    chain = prompt_temp | llm
    
    try:
        res = chain.invoke({"profile_json": json.dumps(profile)})
        content = res.content
        # Extract JSON strictly (in case of markdown blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        metric_dict = json.loads(content.strip())
    except Exception as e:
        # Fallback
        metric_dict = {col: "Business metric" for col in profile}
        
    # Make sure all columns are present
    for col in profile:
        if col not in metric_dict:
            metric_dict[col] = "Business metric"
            
    # Embed
    embed_columns(metric_dict, session_id)
    
    return profile, metric_dict

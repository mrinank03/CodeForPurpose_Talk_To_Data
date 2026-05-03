import json
from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_narrator_llm
from src.utils.chart_advisor import recommend_chart_type
import re

def _build_data_summary(data: list[dict], column_names: list[str]) -> dict:
    """
    Pre-compute summary statistics in Python so the LLM doesn't have to infer
    patterns from a tiny sample. This eliminates the root cause of hallucination.
    """
    summary = {
        "total_rows": len(data),
        "columns": column_names,
        "column_stats": {}
    }
    
    for col in column_names:
        values = [row.get(col) for row in data if row.get(col) is not None]
        if not values:
            continue
            
        # Check if numeric
        numeric_vals = []
        for v in values:
            try:
                numeric_vals.append(float(v))
            except (ValueError, TypeError):
                pass
        
        if numeric_vals and len(numeric_vals) > len(values) * 0.5:
            summary["column_stats"][col] = {
                "type": "numeric",
                "min": round(min(numeric_vals), 2),
                "max": round(max(numeric_vals), 2),
                "sum": round(sum(numeric_vals), 2),
                "avg": round(sum(numeric_vals) / len(numeric_vals), 2),
                "count": len(numeric_vals)
            }
        else:
            # Categorical — show value counts (top 10)
            from collections import Counter
            counts = Counter(str(v) for v in values)
            top = counts.most_common(10)
            summary["column_stats"][col] = {
                "type": "categorical",
                "unique_count": len(counts),
                "top_values": [{"value": v, "count": c} for v, c in top]
            }
    
    return summary


def narrate_result(question: str, data: list[dict], column_names: list[str], initial_chart_type: str) -> tuple[str, str, float]:
    if not data:
        return "No data to narrate.", "none", 0.5
        
    # Verify chart type — Always validate against the actual data shape and user intent
    confirmed_chart_type = recommend_chart_type(data, column_names, question)
    
    # If the LLM suggested a specific chart (like 'pie' or 'line') and it's valid for this data,
    # we can respect it, but recommend_chart_type is the source of truth for 'none'.
    if initial_chart_type in ("bar", "line", "pie") and len(data) > 1:
        # Only override if the recommendation was 'table' (neutral)
        if confirmed_chart_type == "table":
            confirmed_chart_type = initial_chart_type
    
    # Build pre-computed summary stats (Python, not LLM)
    data_summary = _build_data_summary(data, column_names)
    
    # Pass full data for small results, sample for large ones
    if len(data) <= 50:
        display_data = data
    else:
        display_data = data[:20]
    
    prompt = PromptTemplate.from_template(
        "You are a business analyst writing for non-technical users.\n"
        "User Question: {question}\n\n"
        "═══ PRE-COMPUTED STATISTICS (verified) ═══\n{summary}\n\n"
        "═══ DATA RESULT ({row_count} rows shown) ═══\n{data}\n\n"
        "Write a 1–3 sentence plain-English summary of what the data shows. "
        "No jargon. Do not mention SQL or technical terms. Be specific with numbers. "
        "Do not format with Markdown headers.\n\n"
        "CRITICAL:\n"
        "- Only refer to columns explicitly present in the result: {columns}.\n"
        "- Do NOT mention entities like company names, people, or categories unless they are present in the output columns.\n"
        "- Do NOT infer meaning (e.g., do not say 'salary', 'employer', 'discretionary') unless that exact word appears in a column value.\n"
        "- Use the PRE-COMPUTED STATISTICS above for any totals, averages, min/max values. Do NOT compute your own.\n"
        "- Do NOT invent or extrapolate numbers not present in the statistics or data."
    )
    
    llm = get_narrator_llm()
    chain = prompt | llm
    res = chain.invoke({
        "question": question,
        "summary": json.dumps(data_summary, indent=2),
        "data": json.dumps(display_data),
        "row_count": len(display_data),
        "columns": ", ".join(column_names)
    })
    
    narration = res.content.strip()
    
    # ═══ GROUNDING CHECK: LLM + Python numerical verification ═══
    grounding_score = 1.0
    
    # Pass 1: Python numerical consistency check
    # Extract numbers from narration and verify against pre-computed stats
    numbers_in_narration = re.findall(r'[\d,]+\.?\d*', narration.replace(',', ''))
    numbers_in_narration = [float(n) for n in numbers_in_narration if len(n) > 0]
    
    # Collect all valid reference numbers from the data
    reference_numbers = set()
    for stat in data_summary.get("column_stats", {}).values():
        if stat["type"] == "numeric":
            for key in ["min", "max", "sum", "avg", "count"]:
                if key in stat:
                    reference_numbers.add(round(float(stat[key]), 2))
    for row in data:
        for v in row.values():
            try:
                reference_numbers.add(round(float(v), 2))
            except (ValueError, TypeError):
                pass
    reference_numbers.add(float(len(data)))  # row count
    
    # Check if narration numbers are close to any reference number
    if numbers_in_narration:
        unverified = 0
        for num in numbers_in_narration:
            matched = False
            for ref in reference_numbers:
                if ref == 0:
                    continue
                # Allow 1% tolerance for rounding
                if abs(num - ref) / max(abs(ref), 1) < 0.01:
                    matched = True
                    break
            if not matched:
                unverified += 1
        
        if unverified > len(numbers_in_narration) * 0.5:
            grounding_score = 0.3  # Partial penalty, not full kill
    
    # Pass 2: LLM adversarial grounding (with full stats, not just 10 rows)
    grounding_prompt = PromptTemplate.from_template(
        "You are an exact factual verifier.\n"
        "Pre-computed Statistics:\n{summary}\n\n"
        "Data Result:\n{data}\n\n"
        "Claim/Narration:\n{narration}\n\n"
        "Extract up to 3 atomic claims from the narration (especially 'highest', 'lowest', totals, percentages, or exact numbers).\n"
        "Verify each claim against the statistics and data above.\n"
        "If ALL claims are fully supported, output EXACTLY AND ONLY 'SUPPORTED'.\n"
        "If ANY claim is false or cannot be verified, output EXACTLY AND ONLY 'UNSUPPORTED'."
    )
    
    try:
        grounding_chain = grounding_prompt | llm
        grounding_res = grounding_chain.invoke({
            "summary": json.dumps(data_summary, indent=2),
            "data": json.dumps(display_data),
            "narration": narration
        })
        grounding_output = grounding_res.content.strip().upper()
        
        if "UNSUPPORTED" in grounding_output:
            grounding_score = min(grounding_score, 0.2)
    except Exception:
        pass  # If grounding LLM call fails, keep Python-based score
        
    return narration, confirmed_chart_type, grounding_score

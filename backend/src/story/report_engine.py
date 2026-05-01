"""
Report Engine — Generates comprehensive data reports with:
  1. Statistical summaries per selected column
  2. Anomaly detection (Z-score + IQR)
  3. Concentration risk analysis
  4. Trend/spike detection for time-series
  5. Chart data for visualization
  6. LLM-generated executive narrative
"""
import json
import math
import pandas as pd
import numpy as np
from typing import List, Optional


# ──────────────────────────────────────────────────────────────────────────────
# Anomaly Detection
# ──────────────────────────────────────────────────────────────────────────────

def detect_anomalies(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    """
    Detect anomalies using Z-score and IQR methods on selected numeric columns.
    Returns a list of alert dicts with severity, type, message, and affected values.
    """
    alerts = []
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 5:
            continue

        mean_val = series.mean()
        std_val = series.std()

        # ── Z-Score Outliers (> 3 standard deviations) ──
        if std_val > 0:
            z_scores = ((series - mean_val) / std_val).abs()
            outlier_mask = z_scores > 3
            outlier_count = outlier_mask.sum()

            if outlier_count > 0:
                outlier_vals = series[outlier_mask].tolist()[:5]
                alerts.append({
                    "severity": "high",
                    "type": "outlier",
                    "column": col,
                    "message": f"{outlier_count} value(s) in '{_nice(col)}' are more than 3 standard deviations from the mean ({mean_val:,.2f})",
                    "values": [round(v, 2) for v in outlier_vals],
                    "method": "Z-Score (>3σ)"
                })

        # ── IQR Fence Outliers ──
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr > 0:
            lower_fence = q1 - 1.5 * iqr
            upper_fence = q3 + 1.5 * iqr
            iqr_outliers = series[(series < lower_fence) | (series > upper_fence)]

            if len(iqr_outliers) > 0 and len(iqr_outliers) != outlier_count if std_val > 0 else True:
                alerts.append({
                    "severity": "medium",
                    "type": "iqr_outlier",
                    "column": col,
                    "message": f"{len(iqr_outliers)} value(s) in '{_nice(col)}' fall outside the interquartile range [{lower_fence:,.2f} — {upper_fence:,.2f}]",
                    "values": [round(v, 2) for v in iqr_outliers.tolist()[:5]],
                    "method": "IQR Fence (1.5×IQR)"
                })

    # ── Concentration Risk ──
    text_cols = [c for c in columns if not pd.api.types.is_numeric_dtype(df[c])]
    for cat_col in text_cols:
        if df[cat_col].nunique() < 2 or df[cat_col].nunique() > 50:
            continue
        for num_col in numeric_cols:
            try:
                grp = df.groupby(cat_col)[num_col].sum()
                total = grp.sum()
                if total == 0:
                    continue
                top_pct = (grp.max() / total) * 100
                if top_pct > 60:
                    top_cat = grp.idxmax()
                    alerts.append({
                        "severity": "medium",
                        "type": "concentration",
                        "column": f"{cat_col} × {num_col}",
                        "message": f"'{top_cat}' accounts for {top_pct:.1f}% of total {_nice(num_col)} — potential concentration risk",
                        "values": [f"{top_cat}: {grp.max():,.2f} / {total:,.2f}"],
                        "method": "Concentration Analysis"
                    })
            except Exception:
                pass

    # ── Spike Detection (for time-like columns) ──
    date_cols = [c for c in columns if _is_date_like(df[c])]
    for date_col in date_cols:
        for num_col in numeric_cols:
            try:
                df_copy = df.copy()
                df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors="coerce")
                df_copy = df_copy.dropna(subset=[date_col])
                if len(df_copy) < 3:
                    continue
                df_copy["_period"] = df_copy[date_col].dt.to_period("M").astype(str)
                monthly = df_copy.groupby("_period")[num_col].sum()
                if len(monthly) < 2:
                    continue
                pct_change = monthly.pct_change().dropna()
                spikes = pct_change[pct_change.abs() > 0.5]  # >50% change
                for period, change in spikes.items():
                    direction = "increased" if change > 0 else "decreased"
                    alerts.append({
                        "severity": "high" if abs(change) > 1.0 else "medium",
                        "type": "spike",
                        "column": f"{date_col} × {num_col}",
                        "message": f"{_nice(num_col)} {direction} by {abs(change)*100:.0f}% in {period}",
                        "values": [f"{change*100:+.1f}%"],
                        "method": "Month-over-Month Change"
                    })
            except Exception:
                pass

    # Deduplicate and limit
    seen_messages = set()
    unique_alerts = []
    for a in alerts:
        if a["message"] not in seen_messages:
            seen_messages.add(a["message"])
            unique_alerts.append(a)
    return unique_alerts[:15]


# ──────────────────────────────────────────────────────────────────────────────
# Statistical Summary
# ──────────────────────────────────────────────────────────────────────────────

def generate_column_stats(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    """Generate statistical summary for each selected column."""
    stats = []
    for col in columns:
        series = df[col]
        stat = {
            "column": col,
            "display_name": _nice(col),
            "total_rows": len(series),
            "null_count": int(series.isna().sum()),
            "null_pct": round(series.isna().mean() * 100, 1),
            "unique_count": int(series.nunique()),
        }

        if pd.api.types.is_numeric_dtype(series):
            stat["type"] = "numeric"
            clean = series.dropna()
            if len(clean) > 0:
                stat["min"] = _safe_num(clean.min())
                stat["max"] = _safe_num(clean.max())
                stat["mean"] = _safe_num(clean.mean())
                stat["median"] = _safe_num(clean.median())
                stat["std_dev"] = _safe_num(clean.std())
                stat["sum"] = _safe_num(clean.sum())
        else:
            stat["type"] = "categorical"
            top_vals = series.value_counts().head(5)
            stat["top_values"] = {str(k): int(v) for k, v in top_vals.items()}

        stats.append(stat)
    return stats


# ──────────────────────────────────────────────────────────────────────────────
# Chart Insights (reuses precompute logic but scoped to selected columns)
# ──────────────────────────────────────────────────────────────────────────────

def generate_report_charts(df: pd.DataFrame, columns: list[str]) -> list[dict]:
    """Generate chart-based insight cards for the selected columns."""
    cards = []
    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    cat_cols = [c for c in columns if not pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique() <= 30 and df[c].nunique() >= 2]

    if not numeric_cols:
        return cards

    main_num = numeric_cols[0]
    main_cat = cat_cols[0] if cat_cols else None

    # Bar: Total by category
    if main_cat:
        try:
            grp = df.groupby(main_cat)[main_num].sum().nlargest(10).reset_index()
            grp.columns = [main_cat, f"total_{main_num}"]
            grp[f"total_{main_num}"] = grp[f"total_{main_num}"].round(2)
            if len(grp) >= 2:
                cards.append({
                    "headline": f"Total {_nice(main_num)} by {_nice(main_cat)}",
                    "explanation": f"'{grp.iloc[0, 0]}' leads with {grp.iloc[0, 1]:,.2f}.",
                    "chart_type": "bar",
                    "chart_data": _safe_records(grp),
                    "drill_in_question": f"Which {main_cat} has the highest {main_num}?",
                    "sql": "",
                })
        except Exception:
            pass

    # Pie: Distribution
    if main_cat and df[main_cat].nunique() <= 10:
        try:
            dist = df[main_cat].value_counts().head(8).reset_index()
            dist.columns = [main_cat, "count"]
            cards.append({
                "headline": f"{_nice(main_cat)} Distribution",
                "explanation": f"'{dist.iloc[0, 0]}' is the most common ({dist.iloc[0, 1]} records).",
                "chart_type": "pie",
                "chart_data": _safe_records(dist),
                "drill_in_question": f"Show breakdown by {main_cat}",
                "sql": "",
            })
        except Exception:
            pass

    # Additional numeric columns
    if len(numeric_cols) > 1 and main_cat:
        for sec_num in numeric_cols[1:3]:
            try:
                grp2 = df.groupby(main_cat)[sec_num].sum().nlargest(8).reset_index()
                grp2.columns = [main_cat, f"total_{sec_num}"]
                grp2[f"total_{sec_num}"] = grp2[f"total_{sec_num}"].round(2)
                if len(grp2) >= 2:
                    cards.append({
                        "headline": f"{_nice(sec_num)} by {_nice(main_cat)}",
                        "explanation": f"'{grp2.iloc[0, 0]}' leads with {grp2.iloc[0, 1]:,.2f}.",
                        "chart_type": "bar",
                        "chart_data": _safe_records(grp2),
                        "drill_in_question": f"Show {sec_num} by {main_cat}",
                        "sql": "",
                    })
            except Exception:
                pass

    return cards


# ──────────────────────────────────────────────────────────────────────────────
# LLM Executive Summary
# ──────────────────────────────────────────────────────────────────────────────

def generate_narrative(prompt: str, charts: list[dict]) -> str:
    """Use the LLM to write an executive summary based on the prompt and the retrieved charts."""
    try:
        from src.utils.llm_factory import get_narrator_llm
        from langchain_core.prompts import PromptTemplate

        context = {
            "original_prompt": prompt,
            "chart_headlines": [c["headline"] for c in charts],
            "chart_summaries": json.dumps([{
                "headline": c["headline"],
                "explanation": c["explanation"],
                "data_points": len(c["chart_data"]) if c.get("chart_data") else 0
            } for c in charts])
        }

        template = (
            "You are a senior data analyst. The user requested a report with the following prompt: '{original_prompt}'.\n"
            "We have queried the dataset and generated the following analytical charts to answer this:\n"
            "{chart_summaries}\n\n"
            "Write a cohesive, professional 2-3 paragraph Executive Summary for this report. "
            "Synthesize the findings, highlight the most important metrics, and address the user's original request. "
            "Do NOT mention 'based on the charts' or 'the data shows'. Just state the facts professionally."
        )
        
        prompt_obj = PromptTemplate.from_template(template)
        llm = get_narrator_llm()
        res = (prompt_obj | llm).invoke(context)
        return res.content.strip()
    except Exception as e:
        print(f"[ReportEngine] Narrative generation failed: {e}")
        return "Executive summary could not be generated. Please review the charts below for key insights."


# ──────────────────────────────────────────────────────────────────────────────
# Full Report Generator
# ──────────────────────────────────────────────────────────────────────────────

async def generate_full_report(session_id: str, df: pd.DataFrame, user_prompt: str) -> dict:
    """
    Master function: generates the complete report payload using agentic decomposition.
    Returns { insights, narrative, metadata }.
    """
    from src.utils.llm_factory import get_narrator_llm
    from langchain_core.prompts import PromptTemplate
    
    from src.agents.intent_classifier import classify_intent
    from src.agents.schema_resolver import resolve_schema
    from src.agents.sql_planner import generate_sql_plan
    from src.agents.executor import execute_with_retry
    from src.agents.validator import validate_execution
    from src.agents.narrator import narrate_result
    
    # 1. Prompt Decomposition
    # Break the user's prompt into 3 distinct analytical questions.
    try:
        decomp_prompt = PromptTemplate.from_template(
            "You are an AI reporting agent. The user wants a report based on this prompt: '{prompt}'.\n"
            "Available columns in the dataset: {columns}\n\n"
            "Break this request down into exactly 3 distinct, specific analytical questions that can be answered with SQL. "
            "Return ONLY a JSON array of 3 strings. Example: [\"What is the total revenue by region?\", \"What are the top 5 products?\"]"
        )
        llm = get_narrator_llm()
        decomp_res = (decomp_prompt | llm).invoke({
            "prompt": user_prompt,
            "columns": list(df.columns)
        })
        
        import re
        import json
        json_match = re.search(r'\[.*\]', decomp_res.content, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group(0))
        else:
            questions = [
                f"Breakdown of {user_prompt}",
                "Overall trends over time",
                "Top segments or categories"
            ]
    except Exception as e:
        print(f"[ReportEngine] Decomposition failed: {e}")
        questions = ["Show an overview of the data", "Show top categories", "Show key metrics"]

    # Limit to 3
    questions = questions[:3]
    
    # 2. Execute Queries
    # Since we don't have async process_query easily accessible here without event loop issues,
    # we use asyncio.run or standard sync if it's already sync.
    # process_query is async, but we are inside a sync function? Wait, generate_full_report is called synchronously.
    # Actually, we can just use the existing generate_report_charts logic but powered by the LLM?
    # No, wait, let's just make it simpler if process_query is strictly async and we are in a sync function.
    
    # Wait, the user specifically mentioned "3 distinct specific analytical queries".
    # I can use asyncio.run since we are in a ThreadPoolExecutor from FastAPI.
    
    charts = []
    
    for q in questions:
        try:
            print(f"[ReportEngine] Processing question: {q}")
            intent = classify_intent(q)
            resolved_schema = resolve_schema(q, session_id)
            plan = generate_sql_plan(q, intent, resolved_schema, history=[])
            
            if not plan.sql:
                continue
                
            exec_result = execute_with_retry(q, plan.sql, session_id, resolved_schema.full_schema_str)
            val_result = validate_execution(exec_result, resolved_schema, intent)
            
            if val_result.answer_text: # Error or empty
                continue
                
            ans, final_chart_type, _ = narrate_result(q, val_result.data, val_result.columns_used, plan.chart_type)
            
            charts.append({
                "headline": ans,
                "explanation": "", 
                "chart_type": final_chart_type,
                "chart_data": val_result.data,
                "sql": exec_result.final_sql
            })
        except Exception as e:
            print(f"[ReportEngine] Query failed for '{q}': {e}")
            continue

    # 3. Generate Narrative
    narrative = generate_narrative(user_prompt, charts)

    return {
        "metadata": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns_analyzed": list(df.columns),
            "prompt": user_prompt
        },
        "summary": [], # Removed old static stats
        "anomalies": [], # Removed anomalies
        "insights": charts,
        "narrative": narrative,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _nice(col_name: str) -> str:
    return col_name.replace("_", " ").title()

def _safe_num(v) -> Optional[float]:
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 2)
    except (ValueError, TypeError):
        return None

def _safe_records(df: pd.DataFrame) -> list:
    records = []
    for record in df.to_dict("records"):
        clean = {}
        for k, v in record.items():
            if isinstance(v, float) and (pd.isna(v) or np.isinf(v)):
                clean[k] = None
            else:
                clean[k] = v
        records.append(clean)
    return records

def _is_date_like(series: pd.Series) -> bool:
    if pd.api.types.is_datetime64_any_dtype(series):
        return True
    sample = series.dropna().head(10).astype(str)
    return any(
        any(sep in v for sep in ["-", "/"]) and len(v) >= 8
        for v in sample
    )

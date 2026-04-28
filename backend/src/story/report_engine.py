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

def generate_narrative(stats: list[dict], anomalies: list[dict], charts: list[dict]) -> str:
    """Use the LLM to write an executive summary of the report findings."""
    try:
        from src.utils.llm_factory import get_narrator_llm
        from langchain_core.prompts import PromptTemplate

        context = {
            "stats_summary": json.dumps(stats[:10], default=str)[:3000],
            "anomaly_count": len(anomalies),
            "anomaly_details": json.dumps(anomalies[:5], default=str)[:2000],
            "chart_headlines": [c["headline"] for c in charts],
        }

        prompt = PromptTemplate.from_template(
            "You are a senior data analyst writing an executive summary for a business report. "
            "Based on the following analysis results, write a clear, concise 3-5 paragraph summary "
            "that highlights the key findings, anomalies, and actionable insights.\n\n"
            "Statistical Summary:\n{stats_summary}\n\n"
            "Anomalies Found: {anomaly_count}\n{anomaly_details}\n\n"
            "Key Charts: {chart_headlines}\n\n"
            "Write the summary in professional business language. "
            "Use bullet points for key metrics. "
            "Highlight any anomalies or risks in bold. "
            "Keep it under 300 words. No markdown code blocks."
        )

        llm = get_narrator_llm()
        res = (prompt | llm).invoke(context)
        return res.content.strip()
    except Exception as e:
        print(f"[ReportEngine] Narrative generation failed: {e}")
        return "Executive summary could not be generated. Please review the charts and anomaly alerts above for key insights."


# ──────────────────────────────────────────────────────────────────────────────
# Full Report Generator
# ──────────────────────────────────────────────────────────────────────────────

def generate_full_report(df: pd.DataFrame, selected_columns: list[str]) -> dict:
    """
    Master function: generates the complete report payload.
    Returns { summary, anomalies, insights, narrative, metadata }.
    """
    # Filter to valid columns only
    valid_cols = [c for c in selected_columns if c in df.columns]
    if not valid_cols:
        return {"error": "No valid columns selected"}

    # 1. Statistical summary
    stats = generate_column_stats(df, valid_cols)

    # 2. Anomaly detection
    anomalies = detect_anomalies(df, valid_cols)

    # 3. Chart insights
    charts = generate_report_charts(df, valid_cols)

    # 4. Executive narrative
    narrative = generate_narrative(stats, anomalies, charts)


    return {
        "metadata": {
            "total_rows": len(df),
            "total_columns": len(valid_cols),
            "columns_analyzed": valid_cols,
        },
        "summary": stats,
        "anomalies": anomalies,
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

"""
Production-grade insight precomputation engine.

Generates meaningful, context-aware StoryCard dicts from any DataFrame,
including data parsed from PDFs/images. Applies data quality filters to
avoid generating charts from garbage columns.
"""
import pandas as pd
import numpy as np
from typing import List


def _safe_records(df: pd.DataFrame) -> list:
    """Convert DataFrame to list of dicts with NaN replaced by None."""
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


def _nice(col_name: str) -> str:
    """Convert column_name to Column Name."""
    return col_name.replace("_", " ").title()


def _is_meaningful_column(series: pd.Series, col_name: str) -> bool:
    """
    Filter out garbage columns that would produce meaningless charts.
    Returns False for:
      - ID/index-like columns (monotonically increasing integers)
      - Columns with >80% nulls
      - Columns whose name looks like an artifact (single char, all digits, etc.)
    """
    name = str(col_name).lower().strip()

    # Skip obvious IDs
    if name in ("id", "index", "row", "sr", "sno", "s_no", "serial", "unnamed_0"):
        return False
    if name.startswith("unnamed"):
        return False

    # Too many nulls
    if series.isna().sum() / max(len(series), 1) > 0.8:
        return False

    # Single-character column name (likely OCR artifact)
    if len(name) <= 1:
        return False

    # If numeric and monotonically increasing → likely an index
    if pd.api.types.is_numeric_dtype(series):
        if series.dropna().is_monotonic_increasing and series.nunique() > len(series) * 0.9:
            return False

    return True


def _classify_columns(df: pd.DataFrame) -> dict:
    """
    Classify columns into semantic categories for intelligent charting.
    Only includes columns that pass quality checks.
    """
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    text_cols = df.select_dtypes(include="object").columns.tolist()

    # Filter out garbage
    numeric_cols = [c for c in numeric_cols if _is_meaningful_column(df[c], c)]
    text_cols = [c for c in text_cols if _is_meaningful_column(df[c], c)]

    # Sub-classify text columns
    date_cols = []
    categorical_cols = []
    for col in text_cols:
        nunique = df[col].nunique()
        sample_vals = df[col].dropna().head(10).astype(str)

        # Date detection: check for date-like patterns
        is_date_like = any(
            any(sep in v for sep in ["-", "/"]) and len(v) >= 8
            for v in sample_vals
        )
        if is_date_like and nunique > 10:
            date_cols.append(col)
        elif nunique <= 30 and nunique >= 2:  # Good range for grouping
            categorical_cols.append(col)

    # Sort by cardinality (low first = better for pie/bar)
    categorical_cols.sort(key=lambda c: df[c].nunique())

    # Sub-classify numeric columns
    binary_cols = []
    continuous_cols = []
    amount_cols = []  # NEW: specifically identify monetary columns
    for col in numeric_cols:
        unique_vals = df[col].dropna().unique()
        col_lower = col.lower()

        if len(unique_vals) <= 2 and set(unique_vals).issubset({0, 1, 0.0, 1.0}):
            binary_cols.append(col)
        elif any(kw in col_lower for kw in ["amount", "balance", "debit", "credit", "total", "price", "revenue", "salary", "cost", "fee", "payment"]):
            amount_cols.append(col)
            continuous_cols.append(col)
        else:
            continuous_cols.append(col)

    return {
        "categorical": categorical_cols,
        "continuous": continuous_cols,
        "binary": binary_cols,
        "date": date_cols,
        "amount": amount_cols,
    }


def precompute_insights(df: pd.DataFrame) -> List[dict]:
    """Return a list of StoryCard-shaped dicts built from the DataFrame."""
    cards: List[dict] = []
    cols = _classify_columns(df)

    cat_cols = cols["categorical"]
    num_cols = cols["continuous"]
    bin_cols = cols["binary"]
    date_cols = cols["date"]
    amount_cols = cols["amount"]

    if not num_cols:
        return cards

    # Prefer amount columns as the primary metric
    main_num = amount_cols[0] if amount_cols else num_cols[0]
    main_cat = cat_cols[0] if cat_cols else None
    sec_cat = cat_cols[1] if len(cat_cols) > 1 else None

    # ── Card 1: Key metric by top category (bar) ──
    if main_cat:
        try:
            grp = df.groupby(main_cat)[main_num].sum().nlargest(8).reset_index()
            grp.columns = [main_cat, f"total_{main_num}"]
            grp[f"total_{main_num}"] = grp[f"total_{main_num}"].round(2)
            if len(grp) >= 2:
                cards.append({
                    "headline": f"Total {_nice(main_num)} by {_nice(main_cat)}",
                    "explanation": f"'{grp.iloc[0, 0]}' leads with {grp.iloc[0, 1]:,.2f} total {_nice(main_num)}.",
                    "chart_type": "bar",
                    "chart_data": _safe_records(grp),
                    "drill_in_question": f"Which {main_cat} has the highest {main_num}?",
                    "sql": "",
                })
        except Exception:
            pass

    # ── Card 2: Distribution of low-cardinality category (pie) ──
    pie_cat = None
    if main_cat and df[main_cat].nunique() <= 10:
        pie_cat = main_cat
    elif sec_cat and df[sec_cat].nunique() <= 10:
        pie_cat = sec_cat

    if pie_cat:
        try:
            dist = df[pie_cat].value_counts().head(8).reset_index()
            dist.columns = [pie_cat, "count"]
            cards.append({
                "headline": f"{_nice(pie_cat)} Distribution",
                "explanation": f"'{dist.iloc[0, 0]}' is the most common with {int(dist.iloc[0, 1])} records ({dist.iloc[0, 1] / len(df) * 100:.1f}% of total).",
                "chart_type": "pie",
                "chart_data": _safe_records(dist),
                "drill_in_question": f"Show me {main_num} breakdown by {pie_cat}",
                "sql": "",
            })
        except Exception:
            pass

    # ── Card 3: Average metric comparison (bar) ──
    compare_cat = sec_cat if sec_cat and sec_cat != main_cat else None
    if compare_cat:
        try:
            avg_ = df.groupby(compare_cat)[main_num].mean().nlargest(8).reset_index()
            avg_.columns = [compare_cat, f"avg_{main_num}"]
            avg_[f"avg_{main_num}"] = avg_[f"avg_{main_num}"].round(2)
            if len(avg_) >= 2:
                cards.append({
                    "headline": f"Average {_nice(main_num)} by {_nice(compare_cat)}",
                    "explanation": f"Highest average is in '{avg_.iloc[0, 0]}' at {avg_.iloc[0, 1]:,.2f}.",
                    "chart_type": "bar",
                    "chart_data": _safe_records(avg_),
                    "drill_in_question": f"Compare average {main_num} across {compare_cat}",
                    "sql": "",
                })
        except Exception:
            pass

    # ── Card 4: Binary flag analysis ──
    if bin_cols and main_cat:
        try:
            flag = bin_cols[0]
            flag_rate = df.groupby(main_cat)[flag].mean().reset_index()
            flag_rate.columns = [main_cat, f"{flag}_rate"]
            flag_rate[f"{flag}_rate"] = (flag_rate[f"{flag}_rate"] * 100).round(1)
            flag_rate = flag_rate.sort_values(f"{flag}_rate", ascending=False).head(8)
            if len(flag_rate) >= 2:
                cards.append({
                    "headline": f"{_nice(flag)} Rate by {_nice(main_cat)}",
                    "explanation": f"'{flag_rate.iloc[0, 0]}' has the highest {_nice(flag)} rate at {flag_rate.iloc[0, 1]}%.",
                    "chart_type": "bar",
                    "chart_data": _safe_records(flag_rate),
                    "drill_in_question": f"Which {main_cat} has the highest {flag} rate?",
                    "sql": "",
                })
        except Exception:
            pass

    # ── Card 5: Time trend (line) ──
    if date_cols:
        date_col = date_cols[0]
        try:
            df_copy = df.copy()
            df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors="coerce")
            df_copy = df_copy.dropna(subset=[date_col])

            if len(df_copy) >= 3:
                df_copy["_month"] = df_copy[date_col].dt.to_period("M").astype(str)
                monthly = df_copy.groupby("_month")[main_num].sum().reset_index()
                monthly.columns = ["month", f"total_{main_num}"]
                monthly[f"total_{main_num}"] = monthly[f"total_{main_num}"].round(2)
                monthly = monthly.tail(12)

                if len(monthly) >= 3:
                    cards.append({
                        "headline": f"Monthly {_nice(main_num)} Trend",
                        "explanation": f"Showing {len(monthly)} months. Latest: {monthly.iloc[-1, 1]:,.2f}.",
                        "chart_type": "line",
                        "chart_data": _safe_records(monthly),
                        "drill_in_question": f"What is the trend of {main_num} over time?",
                        "sql": "",
                    })
        except Exception:
            pass

    # ── Card 6: Secondary numeric metric (bar) ──
    if len(num_cols) > 1 and main_cat:
        sec_num = [c for c in num_cols if c != main_num]
        if sec_num:
            try:
                sn = sec_num[0]
                grp2 = df.groupby(main_cat)[sn].sum().nlargest(8).reset_index()
                grp2.columns = [main_cat, f"total_{sn}"]
                grp2[f"total_{sn}"] = grp2[f"total_{sn}"].round(2)
                if len(grp2) >= 2:
                    cards.append({
                        "headline": f"{_nice(sn)} by {_nice(main_cat)}",
                        "explanation": f"'{grp2.iloc[0, 0]}' leads with {grp2.iloc[0, 1]:,.2f} total {_nice(sn)}.",
                        "chart_type": "bar",
                        "chart_data": _safe_records(grp2),
                        "drill_in_question": f"Show me {sn} by {main_cat}",
                        "sql": "",
                    })
            except Exception:
                pass

    # ── Card 7: Top N summary table (for bank statements) ──
    if amount_cols and len(df) >= 5:
        try:
            amt_col = amount_cols[0]
            top_n = df.nlargest(5, amt_col)
            display_cols = [c for c in df.columns if _is_meaningful_column(df[c], c)][:4]
            if amt_col not in display_cols:
                display_cols.append(amt_col)
            summary = top_n[display_cols].head(5)
            cards.append({
                "headline": f"Top 5 by {_nice(amt_col)}",
                "explanation": f"Largest value is {top_n[amt_col].iloc[0]:,.2f}.",
                "chart_type": "table",
                "chart_data": _safe_records(summary),
                "drill_in_question": f"Show me the top transactions by {amt_col}",
                "sql": "",
            })
        except Exception:
            pass

    return cards

"""
Intelligent chart type recommender.
Analyzes result shape, column names, and data patterns to recommend
the most meaningful visualization type.
"""


def recommend_chart_type(result_data: list[dict], column_names: list[str], question: str = "") -> str:
    """Recommends a chart type based on data shape, semantics, and user intent from the question."""
    if not result_data:
        return "none"

    num_cols = len(column_names)
    num_rows = len(result_data)
    q_lower = question.lower()

    # Intent detection from question
    is_ranking_q = any(kw in q_lower for kw in ["top", "best", "worst", "rank", "most", "least", "highest", "lowest", "limit"])
    is_composition_q = any(kw in q_lower for kw in ["share", "percentage", "proportion", "distribution", "ratio", "breakdown", "split", "parts"])

    # Keyword-based column detection
    time_keywords = ["date", "time", "month", "year", "quarter", "day", "week", "period"]
    amount_keywords = ["amount", "balance", "debit", "credit", "total", "sum", "avg",
                       "revenue", "price", "cost", "count", "rate", "salary", "fee"]

    has_time_col = any(any(kw in col.lower() for kw in time_keywords) for col in column_names)
    has_amount_col = any(any(kw in col.lower() for kw in amount_keywords) for col in column_names)

    # Check actual data types from sample
    sample = result_data[0]
    numeric_cols = [c for c in column_names if isinstance(sample.get(c), (int, float))]
    text_cols = [c for c in column_names if isinstance(sample.get(c), str)]

    # ── Single-row results ──
    if num_rows == 1:
        return "none"  # Singular answer, no comparison visualization needed

    # ── Time series → line chart ──
    if has_time_col and len(numeric_cols) >= 1 and num_rows >= 3:
        return "line"

    # ── 2-column results (Category + Value) ──
    if num_cols == 2:
        col2 = column_names[1]
        is_col2_numeric = isinstance(sample.get(col2), (int, float))

        if is_col2_numeric:
            # If specifically asking for shares/proportions
            if is_composition_q and 2 <= num_rows <= 8:
                return "pie"
            
            # For everything else (especially rankings), use Bar
            if num_rows <= 15:
                return "bar"
            
            return "table"

    # ── Aggregated results with amounts ──
    if has_amount_col and len(text_cols) >= 1 and num_rows >= 2:
        if is_composition_q and num_rows <= 8:
            return "pie"
        if num_rows <= 15:
            return "bar"
        return "table"

    # ── Multi-column data tables ──
    if num_cols >= 3:
        return "table"

    return "table"

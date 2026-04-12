"""
Intelligent chart type recommender.
Analyzes result shape, column names, and data patterns to recommend
the most meaningful visualization type.
"""


def recommend_chart_type(result_data: list[dict], column_names: list[str]) -> str:
    """Recommends a chart type based on the result shape and column semantics."""
    if not result_data:
        return "none"

    num_cols = len(column_names)
    num_rows = len(result_data)

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

    # ── Single-value results ──
    if num_rows == 1 and num_cols == 1:
        return "none"  # Scalar answer, no chart needed

    # ── Time series → line chart ──
    if has_time_col and len(numeric_cols) >= 1 and num_rows >= 3:
        return "line"

    # ── 2-column results ──
    if num_cols == 2:
        col1, col2 = column_names[0], column_names[1]
        is_col2_numeric = isinstance(sample.get(col2), (int, float))

        if is_col2_numeric:
            if num_rows <= 6:
                return "pie"  # Small category set → pie
            else:
                return "bar"  # Larger set → bar

    # ── Aggregated results with amounts ──
    if has_amount_col and len(text_cols) >= 1 and num_rows >= 2:
        if num_rows <= 6:
            return "pie"
        return "bar"

    # ── Multi-column data tables ──
    if num_cols >= 3:
        return "table"

    return "table"

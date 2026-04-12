import pandas as pd
from src.semantic.profiler import infer_semantic_type

def test_infer_semantic_type():
    df = pd.DataFrame({
        "revenue": [10.5, 20.2, 30.1, 40.5, 50.0, 60.1, 70.1, 80.2],
        "category": ["A", "B", "A", "B", "C", "A", "B", "C"],
        "date": pd.to_datetime(["2023-01-01", "2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-07", "2023-01-08"])
    })
    
    # Needs to be a measure
    assert infer_semantic_type(df["revenue"]) == "measure"
    
    # String with < 10 unique -> dimension
    assert infer_semantic_type(df["category"]) == "dimension"
    
    # Date type
    assert infer_semantic_type(df["date"]) == "time"

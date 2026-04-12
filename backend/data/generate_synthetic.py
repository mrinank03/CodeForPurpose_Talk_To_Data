import os
import pandas as pd
import numpy as np
from datetime import datetime
import random
from faker import Faker

def generate_data():
    fake = Faker()
    num_rows = 15000
    
    # Pre-generate dates in 2023-2024
    start_date = datetime(2023, 1, 1).toordinal()
    end_date = datetime(2024, 12, 31).toordinal()
    random_days = np.random.randint(start_date, end_date, num_rows)
    dates = [datetime.fromordinal(d) for d in random_days]
    
    regions = ["North", "South", "East", "West", "Central"]
    categories = ["Loans", "Savings", "Credit Cards", "Mortgages", "Insurance"]
    channels = ["Mobile App", "Branch", "Online", "ATM"]
    segments = ["Retail", "Business", "Premium", "Student"]
    
    data = {
        "transaction_date": dates,
        "region": np.random.choice(regions, num_rows, p=[0.3, 0.2, 0.2, 0.15, 0.15]), # North higher
        "product_category": np.random.choice(categories, num_rows),
        "channel": np.random.choice(channels, num_rows),
        "customer_segment": np.random.choice(segments, num_rows),
        "transaction_amount": np.random.lognormal(mean=7, sigma=1.5, size=num_rows),
        "monthly_active_users": np.random.randint(100, 5000, num_rows),
        "churn_flag": np.random.choice([0, 1], num_rows, p=[0.92, 0.08]), # 8% churn
        "support_tickets": np.random.randint(0, 21, num_rows),
        "marketing_spend": np.random.uniform(1000, 50000, num_rows)
    }
    
    df = pd.DataFrame(data)
    
    # Adjust Premium churn to be lower
    premium_mask = df["customer_segment"] == "Premium"
    num_premium = premium_mask.sum()
    df.loc[premium_mask, "churn_flag"] = np.random.choice([0, 1], num_premium, p=[0.98, 0.02])
    
    # Cap values and format
    df["transaction_amount"] = df["transaction_amount"].clip(50, 500000).round(2)
    df["marketing_spend"] = df["marketing_spend"].round(2)
    df["transaction_date"] = df["transaction_date"].dt.strftime('%Y-%m-%d')
    
    out_path = os.path.join(os.path.dirname(__file__), "sample_retail_banking.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated {num_rows} rows at {out_path}")

if __name__ == "__main__":
    generate_data()

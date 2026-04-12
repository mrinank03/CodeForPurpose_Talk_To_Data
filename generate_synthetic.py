import csv
import random
from datetime import datetime, timedelta

def generate_banking_data(filename, num_records=500):
    categories = ['Groceries', 'Utilities', 'Salary', 'Entertainment', 'Dining', 'Transport', 'Rent']
    merchants = {
        'Groceries': ['Tesco', 'Sainsburys', 'Asda', 'Waitrose'],
        'Utilities': ['British Gas', 'Thames Water', 'O2', 'EE'],
        'Salary': ['Tech Corp Ltd', 'NatWest Group', 'NHS'],
        'Entertainment': ['Netflix', 'Spotify', 'Vue Cinemas', 'Steam'],
        'Dining': ['Nandos', 'Pizza Express', 'Wagamama', 'Costa Coffee'],
        'Transport': ['TfL', 'Uber', 'Trainline', 'BP Shell'],
        'Rent': ['Estate Agents', 'Private Landlord']
    }
    
    start_date = datetime.now() - timedelta(days=90)
    current_balance = 5000.00
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Transaction_ID', 'Date', 'Description', 'Category', 'Type', 'Amount', 'Balance'])
        
        for i in range(num_records):
            # Sort chronologically by adding random hours
            date_obj = start_date + timedelta(days=random.randint(0, 90), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            date_str = date_obj.strftime('%Y-%m-%d')
            
            category = random.choice(categories)
            description = random.choice(merchants[category])
            
            # Determine if credit or debit
            if category == 'Salary':
                txn_type = 'Credit'
                amount = round(random.uniform(2000, 4500), 2)
                current_balance += amount
            else:
                txn_type = 'Debit'
                if category == 'Rent':
                    amount = round(random.uniform(800, 1500), 2)
                else:
                    amount = round(random.uniform(5, 150), 2)
                current_balance -= amount
                
            writer.writerow([
                f"TXN-{10000+i}",
                date_str,
                description,
                category,
                txn_type,
                amount,
                round(current_balance, 2)
            ])
            
    print(f"✅ Generated {filename} with {num_records} records.")

if __name__ == "__main__":
    import os
    os.makedirs('sample_data', exist_ok=True)
    generate_banking_data('sample_data/retail_banking_transactions.csv', 500)
    

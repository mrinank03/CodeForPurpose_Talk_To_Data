#!/bin/bash
set -e

echo "Setting up DataLens..."
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
echo "Backend setup complete."

cd ../frontend
npm install
cp .env.example .env
echo "Frontend setup complete."

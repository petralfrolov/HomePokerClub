#!/bin/bash
# deploy.sh — Build & restart HomePokerClub on server
set -e

cd "$(dirname "$0")"

echo "==> Pulling latest code..."
git pull origin main

echo "==> Setting up Python venv..."
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "==> Building frontend..."
cd frontend
npm ci
npm run build
cd ..

echo "==> Running database migrations..."
source .venv/bin/activate
alembic upgrade head 2>/dev/null || echo "No migrations to run (using auto-create)"

echo "==> Restarting service..."
sudo systemctl restart homepoker

echo "==> Done!"

.PHONY: setup install start backend frontend frontend-install db-setup test lint build

setup:
	./setup.sh

install: setup

start:
	./start.sh

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

frontend-install:
	cd frontend && npm ci --no-audit --no-fund --loglevel=info

db-setup:
	cd backend && ./apply-db-schema.sh

test:
	cd backend && .venv/bin/pytest

lint:
	cd backend && .venv/bin/ruff check .

build:
	cd frontend && npm run build

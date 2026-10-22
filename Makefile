.PHONY: all dev test lint build clean

# Pulse Monorepo Makefile

API_DIR = services/api
WEB_DIR = apps/web

all: dev

dev:
	@echo "Starting Pulse API, Worker, and Web App..."
	@npm run dev

test:
	@echo "Testing Go services..."
	@cd $(API_DIR) && go test -v ./...
	@echo "Testing Web app..."
	@cd $(WEB_DIR) && npm test --if-present

lint:
	@echo "Linting Go services..."
	@cd $(API_DIR) && go vet ./...
	@echo "Linting Web app..."
	@cd $(WEB_DIR) && npm run lint

build:
	@echo "Building Go API & Worker..."
	@cd $(API_DIR) && go build -o bin/api.exe ./cmd/api
	@cd $(API_DIR) && go build -o bin/worker.exe ./cmd/worker
	@echo "Building Web app..."
	@cd $(WEB_DIR) && npm run build

clean:
	@rm -rf $(API_DIR)/bin
	@rm -rf $(WEB_DIR)/.next

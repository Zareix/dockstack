.PHONY: dev build run test lint vet openapi clean web-dist

# Copy the built SPA into the embed location before building Go.
web-dist:
	@if [ -d web/dist ]; then rm -rf internal/server/web-dist && cp -R web/dist internal/server/web-dist; else mkdir -p internal/server/web-dist; fi

dev:
	@echo "1) Start the Go backend (port 3000):"
	@echo "     ADMIN_EMAIL=you@example.com AUTH_SECRET=secret go run ./cmd/dockstack"
	@echo "2) In another terminal, start the frontend dev server (port 5173, proxying /api to :3000):"
	@echo "     bun run web:dev"

build: web-dist
	go build -o bin/dockstack ./cmd/dockstack

run: build
	./bin/dockstack

test:
	go test ./...

vet:
	go vet ./...

lint:
	golangci-lint run 2>/dev/null || go vet ./...

openapi:
	swag init -g internal/server/server.go -o wiki --parseDependency --parseInternal
	mv -f wiki/swagger.yaml wiki/openapi.yaml
	rm -f wiki/docs.go wiki/swagger.json

clean:
	rm -rf bin internal/server/web-dist
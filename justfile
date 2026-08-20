dev-backend:
    go run ./cmd/dockstack

dev-frontend:
    bun run web:dev

[parallel]
dev: dev-backend dev-frontend

web-build:
    bun run web:build
    @if [ -d web/dist ]; then rm -rf internal/server/web-dist && cp -R web/dist internal/server/web-dist; else mkdir -p internal/server/web-dist; fi

build: web-build
    go build -o bin/dockstack ./cmd/dockstack

run: build
    ./bin/dockstack

test:
    go test ./...

vet:
    go vet ./...

lint:
    golangci-lint run 2>/dev/null || go vet ./...
    bun run --filter dockstack-web lint

openapi:
    swag init -g internal/server/server.go -o wiki --parseDependency --parseInternal
    mv -f wiki/swagger.yaml wiki/openapi.yaml
    rm -f wiki/docs.go wiki/swagger.json

clean:
    rm -rf bin internal/server/web-dist

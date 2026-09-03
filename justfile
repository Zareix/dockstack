air := `command -v air 2>/dev/null || echo "$(go env GOPATH)/bin/air"`

[group('dev')]
dev-backend:
    {{air}}

[group('dev')]
dev-frontend:
    bun run web:dev

[group('dev')]
[parallel]
dev: dev-backend dev-frontend

[group('build')]
web-build:
    bun run web:build
    @if [ -d web/dist ]; then rm -rf internal/server/web-dist && cp -R web/dist internal/server/web-dist; else mkdir -p internal/server/web-dist; fi

[group('build')]
build: web-build
    go build -o bin/dockstack ./cmd/dockstack

run: build
    ./bin/dockstack

[group('wiki')]
openapi:
    go run ./cmd/openapi-gen wiki/openapi.yaml

test:
    go test ./...

vet:
    go vet ./...

lint:
    golangci-lint run 2>/dev/null || go vet ./...
    bun run web:lint

clean:
    rm -rf bin internal/server/web-dist

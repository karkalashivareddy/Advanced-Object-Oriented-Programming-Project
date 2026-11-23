# LifeLink developer entry points. Run from the repository root or this directory.
# Use `make -C project <target>` from the repository root.

.PHONY: dev build test lint clean

dev:
	bash ./scripts/dev.sh

build:
	chmod +x backend/mvnw
	cd backend && ./mvnw -B -DskipTests package
	cd frontend && npm ci && npm run build
	cd docker && docker compose build

test:
	chmod +x backend/mvnw
	cd backend && ./mvnw -B verify
	cd frontend && npm test

lint:
	chmod +x backend/mvnw
	cd backend && ./mvnw -B checkstyle:check
	cd frontend && npm run lint

clean:
	rm -rf backend/target frontend/dist
	cd docker && docker compose down --remove-orphans

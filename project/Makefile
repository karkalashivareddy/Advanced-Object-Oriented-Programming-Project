# LifeLink developer entry points. Run from the repository root or this directory.
# Use `make -C project <target>` from the repository root.

.PHONY: dev build test typecheck clean

dev:
	@echo "Starting the frontend dev server; start the backend separately with ./mvnw spring-boot:run"
	npm --prefix frontend run dev

build:
	chmod +x backend/mvnw
	cd backend && ./mvnw -B -DskipTests package
	cd frontend && npm ci && npm run build
	cd docker && docker compose build

test:
	chmod +x backend/mvnw
	cd backend && ./mvnw -B verify
	cd frontend && npm test

typecheck:
	cd frontend && npm run typecheck

clean:
	rm -rf backend/target frontend/dist
	cd docker && docker compose down --remove-orphans

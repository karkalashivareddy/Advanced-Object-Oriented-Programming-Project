ALTER TABLE dispatches ADD COLUMN idempotency_key VARCHAR(120) UNIQUE;

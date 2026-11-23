-- Access tokens carry this opaque, monotonic user version. Incrementing it on every
-- password or account-status transition makes revocation irreversible: reactivating an
-- account must not make a token issued before the lock/disable valid again.
ALTER TABLE users ADD COLUMN token_version BIGINT NOT NULL DEFAULT 0;

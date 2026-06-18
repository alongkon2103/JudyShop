-- Bumped on logout / password change. Sessions whose `tv` claim
-- no longer matches this column are rejected by `requireAdmin()`.
ALTER TABLE "AdminUser" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

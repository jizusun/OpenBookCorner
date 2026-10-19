-- Backfill slugs for libraries created before the slug column existed (ADR 0003).
-- New libraries get a unique slug at creation (TenantAdminService.create); this
-- covers pre-existing rows. Derive a simple slug from the lowercased name
-- (spaces → hyphens, strip other non-alnum/hyphen). Only touches NULL slugs.
-- NOTE: this is a best-effort backfill; it does not guarantee global uniqueness
-- for pathological duplicate names — the app's create/update paths enforce
-- uniqueness going forward, and admins can rename a slug via the tenant UI.
UPDATE libraries
SET slug = trim(
  replace(
    replace(lower(name), ' ', '-'),
    '--', '-'
  ),
  '-'
)
WHERE slug IS NULL AND name IS NOT NULL AND length(trim(lower(name))) >= 2;

-- Migration 054: Change deals.contact_id from SET NULL to CASCADE.
-- When a contact is deleted, their pipeline deals are also removed
-- instead of becoming orphaned (NULL contact_id) in the kanban.
-- Broadcast recipients, flow runs, automation logs, and other
-- non-pipeline references retain their SET NULL behaviour
-- (migration 004).
--
-- This is additive — the CASCADE delete from contacts.deals is
-- independent of the existing CASCADE chain: contacts →
-- conversations → messages.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_contact_id_fkey'
      AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals
      DROP CONSTRAINT deals_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE deals
  ADD CONSTRAINT deals_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE CASCADE;

-- Restore NOT NULL after the re-add so Postgres does not complain.
-- If the column was previously made nullable (migration 004), this
-- preserves that — CASCADE works regardless of nullability.

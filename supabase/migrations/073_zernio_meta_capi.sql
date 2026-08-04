CREATE TABLE IF NOT EXISTS zernio_connections (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  zernio_profile_id    TEXT NOT NULL UNIQUE,
  connected_accounts   JSONB NOT NULL DEFAULT '[]',
  last_sync_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zernio_connections_account  ON zernio_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_zernio_connections_profile  ON zernio_connections(zernio_profile_id);

ALTER TABLE zernio_connections ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS meta_capi_configs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  pixel_id               TEXT,
  access_token           TEXT,
  default_action_source  TEXT NOT NULL DEFAULT 'business_messaging',
  event_source_url       TEXT,
  event_mapping          JSONB DEFAULT '{}'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_configs_account ON meta_capi_configs(account_id);

ALTER TABLE meta_capi_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS meta_capi_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_name       TEXT NOT NULL,
  contact_id       UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id          UUID REFERENCES deals(id) ON DELETE SET NULL,
  event_id         TEXT NOT NULL,
  request_payload  JSONB,
  response_status  INTEGER,
  response_body    JSONB,
  error_message    TEXT,
  success          BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_capi_events_account ON meta_capi_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_contact ON meta_capi_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_meta_capi_events_deal    ON meta_capi_events(deal_id);

ALTER TABLE meta_capi_events ENABLE ROW LEVEL SECURITY;
-- ---- zernio_connections -------------------------------------------
DROP POLICY IF EXISTS zernio_connections_select ON zernio_connections;
DROP POLICY IF EXISTS zernio_connections_insert ON zernio_connections;
DROP POLICY IF EXISTS zernio_connections_update ON zernio_connections;
DROP POLICY IF EXISTS zernio_connections_delete ON zernio_connections;
CREATE POLICY zernio_connections_select ON zernio_connections FOR SELECT USING (is_account_member(account_id));
CREATE POLICY zernio_connections_insert ON zernio_connections FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY zernio_connections_update ON zernio_connections FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY zernio_connections_delete ON zernio_connections FOR DELETE USING (is_account_member(account_id, 'admin'));
-- ---- meta_capi_configs --------------------------------------------
DROP POLICY IF EXISTS meta_capi_configs_select ON meta_capi_configs;
DROP POLICY IF EXISTS meta_capi_configs_insert ON meta_capi_configs;
DROP POLICY IF EXISTS meta_capi_configs_update ON meta_capi_configs;
DROP POLICY IF EXISTS meta_capi_configs_delete ON meta_capi_configs;
CREATE POLICY meta_capi_configs_select ON meta_capi_configs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY meta_capi_configs_insert ON meta_capi_configs FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY meta_capi_configs_update ON meta_capi_configs FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY meta_capi_configs_delete ON meta_capi_configs FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ---- meta_capi_events ---------------------------------------------
DROP POLICY IF EXISTS meta_capi_events_select ON meta_capi_events;
DROP POLICY IF EXISTS meta_capi_events_insert ON meta_capi_events;
CREATE POLICY meta_capi_events_select ON meta_capi_events FOR SELECT USING (is_account_member(account_id));
CREATE POLICY meta_capi_events_insert ON meta_capi_events FOR INSERT WITH CHECK (is_account_member(account_id));

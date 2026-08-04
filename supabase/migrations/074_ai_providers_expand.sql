-- Allow Kimi (Moonshot), Grok (xAI) and Gemini as AI assistant providers.
-- All three expose OpenAI-compatible Chat Completions endpoints, so the app
-- dispatches them through a shared adapter keyed on ai_configs.provider.

ALTER TABLE ai_configs DROP CONSTRAINT ai_configs_provider_check;

ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'kimi', 'grok', 'gemini'));

grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

insert into private.ai_providers (
  id,key,display_name,approved,zdr_capable,training_policy,retention_reviewed_at
) values
  ('99010000-0000-4000-8000-000000000006','azure','Azure via OpenRouter',true,true,'no_training','2026-09-27T00:00:00Z'),
  ('99010000-0000-4000-8000-000000000007','google-vertex','Google Vertex via OpenRouter',true,true,'no_training','2026-09-27T00:00:00Z')
on conflict (id) do update set
  key=excluded.key,
  display_name=excluded.display_name,
  approved=excluded.approved,
  zdr_capable=excluded.zdr_capable,
  training_policy=excluded.training_policy,
  retention_reviewed_at=excluded.retention_reviewed_at,
  deleted_at=null;

insert into private.ai_models (
  id,provider_id,model_id,capabilities,approved,max_context,structured_output,cost_policy
) values
  ('99020000-0000-4000-8000-000000000008','99010000-0000-4000-8000-000000000006',
   'openai/gpt-6-luna',array['text','structured_output'],true,1050000,true,
   '{"prompt":"0.00000011","completion":"0.00000055","reviewedAt":"2026-09-27"}'),
  ('99020000-0000-4000-8000-000000000009','99010000-0000-4000-8000-000000000007',
   'google/gemini-3.1-flash-lite',array['text','structured_output'],true,1048576,true,
   '{"prompt":"0.000000275","completion":"0.00000165","reviewedAt":"2026-09-27"}')
on conflict (model_id) do update set
  provider_id=excluded.provider_id,
  capabilities=excluded.capabilities,
  approved=excluded.approved,
  max_context=excluded.max_context,
  structured_output=excluded.structured_output,
  cost_policy=excluded.cost_policy,
  deleted_at=null;

update private.ai_feature_routes
set primary_model_id=(select id from private.ai_models where model_id='openai/gpt-6-luna'),
    fallback_model_ids=array[(select id from private.ai_models where model_id='google/gemini-3.1-flash-lite')],
    provider_allowlist=array['azure','google-vertex'],
    max_price='{"prompt":"0.000000275","completion":"0.00000165"}',
    limits=jsonb_set(limits,'{monthlyBudget}','"2.00000000"'::jsonb),
    enabled=false
where workload='financial_assistant';

update private.system_settings
set value='2.00000000'::jsonb
where setting_key='ai.global.monthly_budget';

reset role;
revoke masarifi_migration from current_user granted by current_user;

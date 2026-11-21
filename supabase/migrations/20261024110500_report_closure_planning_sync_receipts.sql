grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Keep the Phase 07 planning queue contract while retaining durable authentication
-- time, immutable replay checks and the re-verification transition.
do $migration$
declare
  definition text:=pg_get_functiondef('private.receive_client_mutation(text,uuid,integer,uuid,text,text,integer,uuid[],text,text,bigint,text,jsonb)'::regprocedure);
  domains text:=$needle$p_domain not in ('accounts','categories','transactions')$needle$;
  resources text:=$needle$or (p_domain='transactions' and p_resource_type='transaction'))$needle$;
begin
  if strpos(definition,domains)=0 or strpos(definition,resources)=0
    or strpos(definition,'authenticated_at')=0 then
    raise exception 'PLANNING_SYNC_REAUTHENTICATION_BASELINE_MISMATCH';
  end if;
  definition:=replace(definition,domains,$replacement$p_domain not in ('accounts','categories','transactions','planning')$replacement$);
  definition:=replace(definition,resources,$replacement$or (p_domain='transactions' and p_resource_type='transaction')
      or (p_domain='planning' and p_resource_type in ('salary-profile','salary-receipt','budget','budget-category',
        'obligation','obligation-schedule','obligation-payment','payment-match','savings-goal','savings-movement')))$replacement$);
  execute definition;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;

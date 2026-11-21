grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- Only an already verified content-cohort capture obtains temporary owner
-- context. Ordinary tracking admission and general ledger authentication stay intact.
do $$ declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.commit_tracking_nominal_capture(uuid,uuid)'::regprocedure);
  definition:=replace(definition,'transaction_id uuid; count_value integer; payload jsonb; finalized jsonb;',
    'transaction_id uuid; count_value integer; payload jsonb; finalized jsonb; previous_claims text; dev_context boolean;');
  needle:='    select * into claim from private.claim_idempotency_key(i.user_id,''tracking.nominal.commit'',key_hash,request_hash,interval ''1 minute'');';
  if position(needle in definition)=0 then raise exception 'TRACKING_COMMIT_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,$guard$    dev_context:=i.normalized_payload#>>'{metadata,sourceAdmissionPolicy}'='financial_content_v1'
      and exists(select 1 from private.tracking_content_cohort(i.user_id,i.normalized_payload#>>'{transport,deviceId}'))
      and coalesce((private.tracking_nominal_source(i.id)->>'eligible')::boolean,false);
    previous_claims:=current_setting('request.jwt.claims',true);
    begin
    if dev_context then
      perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',i.user_id)::text,true);
    end if;
$guard$||needle);
  needle:='    perform private.complete_idempotency_key(i.user_id,''tracking.nominal.commit'',key_hash,request_hash,201,receipt,transaction_id::text);';
  if position(needle in definition)=0 then raise exception 'TRACKING_COMMIT_DEFINITION_UNEXPECTED'; end if;
  definition:=replace(definition,needle,needle||$restore$
    if dev_context then perform pg_catalog.set_config('request.jwt.claims',coalesce(previous_claims,''),true); end if;
    exception when others then
      if dev_context then perform pg_catalog.set_config('request.jwt.claims',coalesce(previous_claims,''),true); end if;
      raise;
    end;
$restore$);
  execute definition;
end $$;
reset role;
revoke masarifi_migration from current_user granted by current_user;

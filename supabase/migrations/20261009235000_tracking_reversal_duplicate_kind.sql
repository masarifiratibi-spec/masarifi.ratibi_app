grant masarifi_migration to current_user with set true, inherit false;
set local role masarifi_migration;

-- A reversal capture invokes the reversal ledger operation even though its
-- incoming review payload uses refund. Compare the actual accounting kind.
do $migration$
declare definition text; updated text;
begin
  definition:=pg_get_functiondef('private.compute_duplicate_candidates_fresh(uuid)'::regprocedure);
  updated:=replace(definition,
    'case when i.normalized_payload->>''kind''=''fee'' then ''expense'' else i.normalized_payload->>''kind'' end',
    'case when i.normalized_payload#>>''{classification,subtype}''=''reversal'' then ''reversal'' when i.normalized_payload->>''kind''=''fee'' then ''expense'' else i.normalized_payload->>''kind'' end');
  if updated=definition then raise exception 'TRACKING_REVERSAL_DUPLICATE_PRECONDITION'; end if;
  execute updated;
end $migration$;

reset role;
revoke masarifi_migration from current_user granted by current_user;

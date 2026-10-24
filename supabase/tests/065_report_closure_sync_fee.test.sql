begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
grant masarifi_migration,masarifi_api,masarifi_worker to current_user with inherit true,set true;
grant usage on schema extensions to masarifi_api,masarifi_worker;
set local role masarifi_migration;
insert into public.profiles(id,status) values ('closure_owner','active');
insert into public.user_devices(id,user_id,device_fingerprint,clerk_session_id,platform,app_version) values
 ('65000000-0000-4000-8000-000000000001','closure_owner','h1:'||repeat('a',64),'closure-session','android','1.0.0'),
 ('65000000-0000-4000-8000-000000000002','closure_owner','h1:'||repeat('b',64),'other-session','android','1.0.0');
insert into public.accounts(id,user_id,name,type,currency_code) values
 ('65000000-0000-4000-8000-000000000011','closure_owner','Source','bank','SAR'),
 ('65000000-0000-4000-8000-000000000012','closure_owner','Destination','cash','SAR');
reset role;
select set_config('request.jwt.claims','{"sub":"closure_owner","sid":"closure-session","role":"authenticated"}',true);
set local role masarifi_api;
create temporary table closure_first as select * from private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',600,
 '65000000-0000-4000-8000-000000000021','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('a',64),'{"amountMinor":100}');
select is((select status from closure_first),'received','protected operation is received');
select ok((select authenticated_at between clock_timestamp()-interval '602 seconds' and clock_timestamp()-interval '599 seconds'
 from public.client_mutations where id=(select mutation_id from closure_first)),'authentication instant is durable');
reset role;
set local role masarifi_worker;
create temporary table closure_claim as select * from private.claim_client_mutations('closure-worker',1,60);
select lives_ok(format($$select private.complete_client_mutation('%s','%s','rejected',null,'{"code":"RECENT_AUTH_REQUIRED"}')$$,
 (select id from closure_claim),(select lease_token from closure_claim)),'expired authentication completes without financial side effects');
reset role;
set local role masarifi_api;
select is((select status from private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',600,
 '65000000-0000-4000-8000-000000000021','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('a',64),'{"amountMinor":100}')),'rejected','stale retry cannot requeue');
select is((select outcome from private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',0,
 '65000000-0000-4000-8000-000000000021','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('a',64),'{"amountMinor":101}')),'hash_mismatch','changed payload cannot reuse the operation');
select is((select status from private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',0,
 '65000000-0000-4000-8000-000000000021','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('a',64),'{"amountMinor":100}')),'received','fresh verification requeues the same operation');
select is((select count(*)::integer from public.client_mutations where user_id='closure_owner'),1,'reauthentication never duplicates the mutation');
reset role;
set local role masarifi_worker;
create temporary table closure_reclaim as select * from private.claim_client_mutations('closure-worker',1,60);
select ok((select authenticated_at >= clock_timestamp()-interval '5 seconds' from closure_reclaim),'worker consumes refreshed authentication time');
select lives_ok(format($$select private.complete_client_mutation('%s','%s','applied','{}',null)$$,
 (select id from closure_reclaim),(select lease_token from closure_reclaim)),'reauthenticated operation completes once');
reset role;
set local role masarifi_api;
select is((select status from private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',0,
 '65000000-0000-4000-8000-000000000021','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('a',64),'{"amountMinor":100}')),'applied','an applied operation cannot execute again');
select throws_ok($$select private.receive_client_mutation(
 'closure_owner','65000000-0000-4000-8000-000000000001',0,
 '65000000-0000-4000-8000-000000000029','transactions','transaction',1,'{}','invented','local-expense',1,
 'sha256:'||repeat('a',64),'{}')$$,'22023','SYNC_MUTATION_INVALID','unknown operation remains rejected');

-- A queued dependent waits for the protected parent instead of becoming permanently rejected.
select * from private.receive_client_mutation('closure_owner','65000000-0000-4000-8000-000000000001',600,
 '65000000-0000-4000-8000-000000000031','transactions','transaction',1,'{}','update','local-expense',1,
 'sha256:'||repeat('b',64),'{}');
select * from private.receive_client_mutation('closure_owner','65000000-0000-4000-8000-000000000001',600,
 '65000000-0000-4000-8000-000000000032','transactions','transaction',1,
 array['65000000-0000-4000-8000-000000000031'::uuid],'update','local-expense',2,'sha256:'||repeat('c',64),'{}');
reset role;
set local role masarifi_worker;
create temporary table closure_parent as select * from private.claim_client_mutations('closure-worker',1,60);
select private.complete_client_mutation(id,lease_token,'rejected',null,'{"code":"RECENT_AUTH_REQUIRED"}') from closure_parent;
select is((select count(*)::integer from private.claim_client_mutations('closure-worker',10,60)),0,'dependent waits while parent needs re-verification');
reset role;
set local role masarifi_migration;
select is((select status from public.client_mutations where operation_id='65000000-0000-4000-8000-000000000032'),'received','dependent stays resumable');
reset role;
set local role masarifi_api;

-- Malformed fee conversion produces controlled domain errors before ledger mutation.
create temporary table closure_transfer(command jsonb);
insert into closure_transfer values ('{"sourceAccountId":"65000000-0000-4000-8000-000000000011","destinationAccountId":"65000000-0000-4000-8000-000000000012","amountMinor":1000,"currency":"SAR","occurredAt":"2026-10-01T00:00:00Z","title":"Transfer"}');
select throws_ok(format('select private.transfer_funds(''closure_owner'',%L::jsonb)',command||jsonb_build_object('feeMinor',value)),
 '22023','VALIDATION_FAILED','malformed/fractional/overflow fee is a validation error')
 from closure_transfer cross join (values ('bad'),('1.5'),('999999999999999999999999999')) f(value);
select throws_ok(format('select private.transfer_funds(''closure_owner'',%L::jsonb)',command||'{"feeMinor":-1}'),
 '22023','TRANSFER_ACCOUNTS_INVALID','negative fee is a controlled domain error') from closure_transfer;
select lives_ok(format('select private.transfer_funds(''closure_owner'',%L::jsonb)',command),'missing fee means explicit zero') from closure_transfer;
select lives_ok(format('select private.transfer_funds(''closure_owner'',%L::jsonb)',command||'{"feeMinor":10}'),'valid fee posts normally') from closure_transfer;
select is((select count(*)::integer from public.transactions where user_id='closure_owner' and kind='transfer'),2,'only valid commands created transfers');
reset role;
select * from finish();
rollback;

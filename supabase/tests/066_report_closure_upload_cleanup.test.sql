begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
select has_function('private','list_due_account_upload_erasure_owners',array['integer']);
select ok(has_function_privilege('masarifi_worker','private.list_due_account_upload_erasure_owners(integer)','execute'),'worker can discover due cleanup');
select ok(not has_function_privilege('masarifi_api','private.list_due_account_upload_erasure_owners(integer)','execute'),'API cannot enumerate erased owners');
select ok(not has_function_privilege('authenticated','private.list_due_account_upload_erasure_owners(integer)','execute'),'owners cannot enumerate cleanup');
select throws_ok('select * from private.list_due_account_upload_erasure_owners(0)','42501','ERASURE_PURGE_FORBIDDEN','invalid work budget fails closed');
insert into public.profiles(id,status) values
 ('closure_cleanup_due','active'),('closure_cleanup_future','active'),
 ('closure_cleanup_leased','active'),('closure_cleanup_active','active');
update public.profiles set status='deleted',deleted_at=clock_timestamp() where id in ('closure_cleanup_due','closure_cleanup_future','closure_cleanup_leased');
insert into private.account_deletion_requests(id,user_id,status,requested_at,verified_at,cooling_off_ends_at) values
 ('d8000000-0000-4000-8000-000000000001','closure_cleanup_due','processing',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'),
 ('d8000000-0000-4000-8000-000000000002','closure_cleanup_future','processing',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'),
 ('d8000000-0000-4000-8000-000000000003','closure_cleanup_leased','processing',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour'),
 ('d8000000-0000-4000-8000-000000000004','closure_cleanup_active','verified',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour');
insert into private.account_upload_erasure_tombstones(request_id,user_id,storage_ref,capability_expires_at,next_attempt_at,lease_token,lease_until)
select d.id,d.user_id,'support/'||d.id||'/'||d.id,clock_timestamp()+interval '1 hour',
 case when d.user_id='closure_cleanup_future' then clock_timestamp()+interval '30 seconds' else clock_timestamp()-interval '1 second' end,
 case when d.user_id='closure_cleanup_leased' then d.id else null end,
 case when d.user_id='closure_cleanup_leased' then clock_timestamp()+interval '5 minutes' else null end
from private.account_deletion_requests d where d.user_id like 'closure_cleanup_%';
select is(array(select user_id from private.list_due_account_upload_erasure_owners(16) where user_id like 'closure_cleanup_%'),array['closure_cleanup_due'],'future, leased and active-owner records are excluded');
select ok((select count(*) from private.list_due_account_upload_erasure_owners(1))<=1,'owner work is bounded');
update private.account_upload_erasure_tombstones set lease_until=clock_timestamp()-interval '1 second' where user_id='closure_cleanup_leased';
select is(array(select user_id from private.list_due_account_upload_erasure_owners(16) where user_id like 'closure_cleanup_%' order by user_id),array['closure_cleanup_due','closure_cleanup_leased'],'expired leases retry without admitting active owners');
select * from finish();
rollback;

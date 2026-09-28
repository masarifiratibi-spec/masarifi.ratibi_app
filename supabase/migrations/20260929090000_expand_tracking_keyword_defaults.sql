create or replace function private.restore_default_keyword_rules(p_user_id text) returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer; request_id text:=private.tracking_request_id();
begin
  perform private.assert_active_profile(p_user_id);
  delete from public.user_keyword_rules where user_id=p_user_id and origin='default';
  insert into public.user_keyword_rules(user_id,keyword,group_key,language_code,origin,match_type,priority,enabled)
  select p_user_id,v.keyword,v.group_key,v.language_code,'default','contains',100,true
  from (values
    ('مصروف','expense','ar'),('شراء','expense','ar'),('شراء إنترنت','expense','ar'),('دفع','expense','ar'),('سداد','expense','ar'),('خصم','expense','ar'),
    ('Grocery','expense','en'),('Used for','expense','en'),('Debit transaction','expense','en'),('Debited','expense','en'),('Purchase','expense','en'),('Payment','expense','en'),('Spent','expense','en'),('Charged','expense','en'),
    ('راتب','income','ar'),('إضافة','income','ar'),('استلام','income','ar'),('تحويل وارد','income','ar'),
    ('Salary','income','en'),('Credited','income','en'),('Credit transaction','income','en'),('Cr. transaction','income','en'),('Received','income','en'),('Incoming transfer','income','en'),
    ('تحويل','transfer','ar'),('تحويل إلى','transfer','ar'),('تم التحويل','transfer','ar'),
    ('Transfer','transfer','en'),('Transferred to','transfer','en'),('Sent','transfer','en'),
    ('سحب','withdrawal','ar'),('سحب نقدي','withdrawal','ar'),
    ('Withdrawal','withdrawal','en'),('Withdrawn','withdrawal','en'),('Cash withdrawal','withdrawal','en'),('ATM','withdrawal','en'),
    ('إيداع','deposit','ar'),('Deposit','deposit','en'),
    ('استرداد','refund','ar'),('مسترد','refund','ar'),('Refund','refund','en'),('Refunded','refund','en'),
    ('اشتراك','subscription','ar'),('Subscription','subscription','en'),
    ('قسط','installment','ar'),('Installment','installment','en'),
    ('رسوم','fee','ar'),('عمولة','fee','ar'),('Fee','fee','en'),('Service fee','fee','en'),('Foreign transaction fee','fee','en'),('Commission','fee','en'),
    ('عملية فاشلة','failed_transaction','ar'),('فشل','failed_transaction','ar'),('مرفوضة','failed_transaction','ar'),('لم تتم','failed_transaction','ar'),('غير ناجحة','failed_transaction','ar'),('رصيد غير كاف','failed_transaction','ar'),
    ('Failed transaction','failed_transaction','en'),('Failed','failed_transaction','en'),('Declined','failed_transaction','en'),('Rejected','failed_transaction','en'),('Unsuccessful','failed_transaction','en'),('Insufficient funds','failed_transaction','en'),('Exceeded PIN attempts','failed_transaction','en'),
    ('عكس قيد','reversal','ar'),('ملغاة','reversal','ar'),('Reversal','reversal','en'),('Reversed','reversal','en'),('Cancelled','reversal','en')
  ) v(keyword,group_key,language_code)
  where not exists (
    select 1 from public.user_keyword_rules existing
    where existing.user_id=p_user_id
      and existing.origin='custom'
      and existing.match_type='contains'
      and lower(existing.keyword)=lower(v.keyword)
  );
  get diagnostics inserted_count=row_count;
  perform audit.append_event(p_user_id,'user','tracking.keyword-defaults-restored','tracking_preference',p_user_id,null,null,null,request_id,
    jsonb_build_object('count',inserted_count));
  return inserted_count;
end $$;

alter function private.restore_default_keyword_rules(text) owner to masarifi_migration;
revoke all on function private.restore_default_keyword_rules(text) from public;
grant execute on function private.restore_default_keyword_rules(text) to masarifi_api;

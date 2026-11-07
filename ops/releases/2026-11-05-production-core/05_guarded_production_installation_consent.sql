-- Exact current-state guard around the unchanged canonical production-consent migration.
-- Isolated restore qualification only; hosted execution requires approval. No history stamping.
set local statement_timeout='10s';
set local lock_timeout='1s';
do $guard$
begin
  if current_user<>'postgres' or session_user<>'postgres' or (select rolsuper from pg_roles where rolname=current_user) then raise exception 'CONSENT_ACTUAL_EXECUTOR_REQUIRED'; end if;
  if current_setting('server_version_num')<>'170006' then raise exception 'CONSENT_SERVER_DRIFT'; end if;
  if not pg_try_advisory_xact_lock(5574319470126001) then raise exception 'MIGRATION_LOCK_UNAVAILABLE'; end if;
  if (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')),'definitionMd5Lf',md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname IN ('assert_active_profile','commit_tracking_nominal_capture','commit_tracking_nominal_capture_before_production','configure_tracking_installation','create_import_session','create_import_session_before_production','create_review_item','finalize_import_session','finalize_import_session_before_production','get_tracking_device_rule_snapshot','get_tracking_device_rule_snapshot_before_production','get_tracking_rule_snapshot','lock_tracking_installation','revoke_tracking_installation_authority','tracking_capture_auto_enabled','tracking_capture_auto_enabled_before_production','tracking_content_cohort','tracking_content_cohort_before_production','tracking_installation_active','tracking_installation_configuration','tracking_installation_event_admitted','tracking_installations','tracking_nominal_source','tracking_nominal_source_before_production')) is distinct from $expected$[{"name":"assert_active_profile","arguments":"p_user_id text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"1ffdad9399e4fcceeed4d475f9ae6cc9","definitionMd5Lf":"2f01630f355758a8f735c37003e87eaa"},{"name":"commit_tracking_nominal_capture","arguments":"p_item uuid, p_fence uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"f7c6fc19128ef5d70b0a58bcf1c70bd4","definitionMd5Lf":"192c74c0147f5ed02a9c7a9c1ae77fa7"},{"name":"create_import_session","arguments":"p_user_id text, p_source_type text, p_source_name text, p_schema_version integer, p_request_hash text, p_events jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"8806de295633612fe929b49375366bed","definitionMd5Lf":"5ca511e1acb850bd72bad1ad5436babd"},{"name":"create_review_item","arguments":"p_import_item_id uuid, p_reason text, p_proposed_values jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"8a507c772f402752628623baaf03cc94","definitionMd5Lf":"5603347ca62dedb275ad677f840e0b9a"},{"name":"finalize_import_session","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"9f19a8e2d79483b9695bebc213367ec9","definitionMd5Lf":"8efc0fb95a6f77a7d176a08ceebc3f16"},{"name":"get_tracking_device_rule_snapshot","arguments":"p_user_id text, p_device_id text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"d919eccda58e45154105f03180730e53","definitionMd5Lf":"c030db0a238c5dc2593f919f7140c879"},{"name":"get_tracking_rule_snapshot","arguments":"p_user_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"fa76607377bd632b36a42dc5a46ccd3c","definitionMd5Lf":"e6d7690856cef6e8e066f815b128aa0f"},{"name":"tracking_capture_auto_enabled","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"031defd1ca932a2a80908d0c271c552d","definitionMd5Lf":"0405041a6d2bc2b5bc42a00f5792c2ef"},{"name":"tracking_content_cohort","arguments":"p_user_id text, p_device_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"60c74ec83856b9e844d4b07135e3f387","definitionMd5Lf":"8b4de7e58c75a8b1b0010f22ab97c3d6"},{"name":"tracking_nominal_source","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"e79915676df84636c401375720021c8e","definitionMd5Lf":"927b087b10396d3a8704442e72ea9cef"}]$expected$::jsonb then raise exception 'CONSENT_FUNCTION_PREREQUISITES_DRIFT'; end if;
  if (SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
   'rls',c.relrowsecurity,'forcedRls',c.relforcerowsecurity,'acl',c.relacl::text,
   'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,
      'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',(SELECT jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'definition',pg_get_constraintdef(x.oid)) ORDER BY x.conname)
      FROM pg_constraint x WHERE x.conrelid=c.oid)) ORDER BY n.nspname,c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private','audit') AND c.relkind IN ('r','p','v','m') AND c.relname IN ('tracking_automatic_cohorts','dev_mobile_installations','user_devices','profiles','tracking_preferences','import_items','import_sessions','tracking_rule_releases','tracking_rule_channels','tracking_installations')) is distinct from $expected$[{"acl":null,"rls":true,"kind":"r","name":"dev_mobile_installations","owner":"masarifi_migration","schema":"private","columns":[{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"tracking_device_id","type":"text","default":null,"notNull":true},{"name":"notification_device_id","type":"uuid","default":null,"notNull":true},{"name":"enabled","type":"boolean","default":"true","notNull":true},{"name":"reminders_enabled","type":"boolean","default":"false","notNull":true},{"name":"reminder_locale","type":"text","default":null,"notNull":false},{"name":"reminder_timezone","type":"text","default":null,"notNull":false},{"name":"last_foreground_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"enrolled_at","type":"timestamp with time zone","default":"clock_timestamp()","notNull":true}],"forcedRls":true,"constraints":[{"name":"dev_mobile_installations_notification_device_id_fkey","type":"f","definition":"FOREIGN KEY (notification_device_id) REFERENCES user_devices(id) ON DELETE CASCADE"},{"name":"dev_mobile_installations_pkey","type":"p","definition":"PRIMARY KEY (user_id, tracking_device_id)"},{"name":"dev_mobile_installations_reminder_locale_check","type":"c","definition":"CHECK ((reminder_locale = ANY (ARRAY['ar'::text, 'en'::text])))"},{"name":"dev_mobile_installations_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE"},{"name":"dev_mobile_installations_user_id_notification_device_id_key","type":"u","definition":"UNIQUE (user_id, notification_device_id)"}]},{"acl":null,"rls":true,"kind":"r","name":"tracking_automatic_cohorts","owner":"masarifi_migration","schema":"private","columns":[{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"device_id","type":"text","default":null,"notNull":true},{"name":"release_id","type":"uuid","default":null,"notNull":true},{"name":"engine_version","type":"text","default":null,"notNull":true},{"name":"enabled","type":"boolean","default":"true","notNull":true},{"name":"expires_at","type":"timestamp with time zone","default":null,"notNull":true},{"name":"reason","type":"text","default":null,"notNull":true},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notNull":true},{"name":"source_admission_policy","type":"text","default":"'financial_sources'::text","notNull":true},{"name":"capture_started_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"sms_activation_id","type":"text","default":"'0'::text","notNull":true},{"name":"currency_account_policy","type":"text","default":"'default_account_nominal_v1'::text","notNull":true},{"name":"installation_managed","type":"boolean","default":"false","notNull":true}],"forcedRls":true,"constraints":[{"name":"tracking_automatic_cohorts_currency_account_policy_check","type":"c","definition":"CHECK ((currency_account_policy = ANY (ARRAY['default_account_nominal_v1'::text, 'source_currency_v1'::text])))"},{"name":"tracking_automatic_cohorts_device_id_check","type":"c","definition":"CHECK (((char_length(device_id) >= 8) AND (char_length(device_id) <= 200)))"},{"name":"tracking_automatic_cohorts_engine_version_check","type":"c","definition":"CHECK ((engine_version = '2.0.0'::text))"},{"name":"tracking_automatic_cohorts_pkey","type":"p","definition":"PRIMARY KEY (user_id, device_id)"},{"name":"tracking_automatic_cohorts_reason_check","type":"c","definition":"CHECK (((char_length(reason) >= 10) AND (char_length(reason) <= 500)))"},{"name":"tracking_automatic_cohorts_release_id_fkey","type":"f","definition":"FOREIGN KEY (release_id) REFERENCES tracking_rule_releases(id)"},{"name":"tracking_automatic_cohorts_sms_activation_id_check","type":"c","definition":"CHECK (((sms_activation_id ~ '^[0-9]{1,19}$'::text) AND ((sms_activation_id)::numeric <= ('9223372036854775807'::bigint)::numeric)))"},{"name":"tracking_automatic_cohorts_source_admission_policy_check","type":"c","definition":"CHECK ((source_admission_policy = ANY (ARRAY['financial_sources'::text, 'financial_content_v1'::text])))"},{"name":"tracking_automatic_cohorts_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE"},{"name":"tracking_cohort_expiry","type":"c","definition":"CHECK (((expires_at <= (created_at + '7 days'::interval)) OR (installation_managed AND (expires_at = 'infinity'::timestamp with time zone))))"},{"name":"tracking_content_boundary_required","type":"c","definition":"CHECK (((source_admission_policy <> 'financial_content_v1'::text) OR (capture_started_at IS NOT NULL)))"}]},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration}","rls":true,"kind":"r","name":"import_items","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notNull":true},{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"session_id","type":"uuid","default":null,"notNull":true},{"name":"source_item_key","type":"text","default":null,"notNull":true},{"name":"normalized_hash","type":"text","default":null,"notNull":true},{"name":"source_hash","type":"text","default":null,"notNull":true},{"name":"parser_version_id","type":"uuid","default":null,"notNull":false},{"name":"applied_rule_ids","type":"uuid[]","default":"'{}'::uuid[]","notNull":true},{"name":"occurred_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"amount_minor","type":"bigint","default":null,"notNull":false},{"name":"currency_code","type":"character(3)","default":null,"notNull":false},{"name":"merchant","type":"text","default":null,"notNull":false},{"name":"normalized_payload","type":"jsonb","default":"'{}'::jsonb","notNull":true},{"name":"confidence_basis_points","type":"integer","default":"0","notNull":true},{"name":"status","type":"text","default":"'parsed'::text","notNull":true},{"name":"transaction_id","type":"uuid","default":null,"notNull":false},{"name":"operation_id","type":"uuid","default":null,"notNull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true},{"name":"canonical_identity_hash","type":"text","default":null,"notNull":false}],"forcedRls":true,"constraints":[{"name":"import_items_amount_minor_check","type":"c","definition":"CHECK (((amount_minor IS NULL) OR ((amount_minor >= '-9007199254740991'::bigint) AND (amount_minor <= '9007199254740991'::bigint) AND (amount_minor <> 0))))"},{"name":"import_items_applied_rule_ids_check","type":"c","definition":"CHECK ((cardinality(applied_rule_ids) <= 32))"},{"name":"import_items_check","type":"c","definition":"CHECK (((status = ANY (ARRAY['accepted'::text, 'duplicate'::text])) = (transaction_id IS NOT NULL)))"},{"name":"import_items_confidence_basis_points_check","type":"c","definition":"CHECK (((confidence_basis_points >= 0) AND (confidence_basis_points <= 10000)))"},{"name":"import_items_currency_code_fkey","type":"f","definition":"FOREIGN KEY (currency_code) REFERENCES currencies(code) ON UPDATE RESTRICT ON DELETE RESTRICT"},{"name":"import_items_id_user_id_key","type":"u","definition":"UNIQUE (id, user_id)"},{"name":"import_items_merchant_check","type":"c","definition":"CHECK (((merchant IS NULL) OR ((merchant = btrim(merchant)) AND ((char_length(merchant) >= 1) AND (char_length(merchant) <= 160)) AND (merchant !~ '[[:cntrl:]]'::text))))"},{"name":"import_items_normalized_hash_check","type":"c","definition":"CHECK ((normalized_hash ~ '^[0-9a-f]{64}$'::text))"},{"name":"import_items_normalized_payload_check","type":"c","definition":"CHECK (((jsonb_typeof(normalized_payload) = 'object'::text) AND (pg_column_size(normalized_payload) <= 8192)))"},{"name":"import_items_parser_version_id_fkey","type":"f","definition":"FOREIGN KEY (parser_version_id) REFERENCES parser_rule_versions(id) ON UPDATE RESTRICT ON DELETE RESTRICT"},{"name":"import_items_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"name":"import_items_session_owner_fk","type":"f","definition":"FOREIGN KEY (session_id, user_id) REFERENCES import_sessions(id, user_id) ON UPDATE RESTRICT ON DELETE CASCADE"},{"name":"import_items_source_hash_check","type":"c","definition":"CHECK ((source_hash ~ '^[0-9a-f]{64}$'::text))"},{"name":"import_items_source_item_key_check","type":"c","definition":"CHECK (((source_item_key = btrim(source_item_key)) AND ((char_length(source_item_key) >= 1) AND (char_length(source_item_key) <= 160)) AND (source_item_key !~ '[[:cntrl:]]'::text)))"},{"name":"import_items_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['parsed'::text, 'review'::text, 'accepted'::text, 'rejected'::text, 'duplicate'::text, 'failed'::text])))"},{"name":"import_items_transaction_owner_fk","type":"f","definition":"FOREIGN KEY (transaction_id, user_id) REFERENCES transactions(id, user_id) ON UPDATE RESTRICT ON DELETE RESTRICT"},{"name":"import_items_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON UPDATE RESTRICT ON DELETE CASCADE"},{"name":"import_items_version_check","type":"c","definition":"CHECK ((version > 0))"}]},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration}","rls":true,"kind":"r","name":"import_sessions","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notNull":true},{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"source_type","type":"text","default":null,"notNull":true},{"name":"source_name","type":"text","default":null,"notNull":false},{"name":"schema_version","type":"integer","default":"1","notNull":true},{"name":"request_hash","type":"text","default":null,"notNull":true},{"name":"status","type":"text","default":"'received'::text","notNull":true},{"name":"item_count","type":"integer","default":"0","notNull":true},{"name":"accepted_count","type":"integer","default":"0","notNull":true},{"name":"rejected_count","type":"integer","default":"0","notNull":true},{"name":"attempt_count","type":"integer","default":"0","notNull":true},{"name":"claim_token","type":"uuid","default":null,"notNull":false},{"name":"claimed_by","type":"text","default":null,"notNull":false},{"name":"lease_until","type":"timestamp with time zone","default":null,"notNull":false},{"name":"next_attempt_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"last_error_code","type":"text","default":null,"notNull":false},{"name":"started_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"completed_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true}],"forcedRls":true,"constraints":[{"name":"import_sessions_accepted_count_check","type":"c","definition":"CHECK ((accepted_count >= 0))"},{"name":"import_sessions_attempt_count_check","type":"c","definition":"CHECK (((attempt_count >= 0) AND ((schema_version = 3) OR (attempt_count <= 20))))"},{"name":"import_sessions_check","type":"c","definition":"CHECK (((accepted_count + rejected_count) <= item_count))"},{"name":"import_sessions_check1","type":"c","definition":"CHECK ((((claim_token IS NULL) AND (claimed_by IS NULL) AND (lease_until IS NULL)) OR ((claim_token IS NOT NULL) AND (claimed_by IS NOT NULL) AND (lease_until IS NOT NULL))))"},{"name":"import_sessions_check2","type":"c","definition":"CHECK (((status = ANY (ARRAY['complete'::text, 'failed'::text, 'cancelled'::text])) = (completed_at IS NOT NULL)))"},{"name":"import_sessions_id_user_id_key","type":"u","definition":"UNIQUE (id, user_id)"},{"name":"import_sessions_item_count_check","type":"c","definition":"CHECK (((item_count >= 0) AND (item_count <= 10000)))"},{"name":"import_sessions_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"name":"import_sessions_rejected_count_check","type":"c","definition":"CHECK ((rejected_count >= 0))"},{"name":"import_sessions_request_hash_check","type":"c","definition":"CHECK ((request_hash ~ '^[0-9a-f]{64}$'::text))"},{"name":"import_sessions_schema_version_check","type":"c","definition":"CHECK ((schema_version = ANY (ARRAY[1, 2, 3])))"},{"name":"import_sessions_source_name_check","type":"c","definition":"CHECK (((source_name IS NULL) OR ((source_name = btrim(source_name)) AND ((char_length(source_name) >= 1) AND (char_length(source_name) <= 120)) AND (source_name !~ '[[:cntrl:]]'::text) AND (POSITION(('/'::text) IN (source_name)) = 0) AND (POSITION((chr(92)) IN (source_name)) = 0))))"},{"name":"import_sessions_source_type_check","type":"c","definition":"CHECK ((source_type = ANY (ARRAY['sms'::text, 'file'::text, 'manual'::text, 'provider'::text])))"},{"name":"import_sessions_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['received'::text, 'processing'::text, 'review'::text, 'complete'::text, 'failed'::text, 'cancelled'::text])))"},{"name":"import_sessions_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON UPDATE RESTRICT ON DELETE CASCADE"},{"name":"import_sessions_version_check","type":"c","definition":"CHECK ((version > 0))"}]},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=r/masarifi_migration,masarifi_worker=ar/masarifi_migration}","rls":true,"kind":"r","name":"profiles","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"text","default":null,"notNull":true},{"name":"primary_email","type":"text","default":null,"notNull":false},{"name":"phone_e164","type":"text","default":null,"notNull":false},{"name":"display_name","type":"text","default":null,"notNull":false},{"name":"locale","type":"text","default":"'ar'::text","notNull":true},{"name":"timezone","type":"text","default":"'Asia/Riyadh'::text","notNull":true},{"name":"status","type":"text","default":"'active'::text","notNull":true},{"name":"last_seen_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"deleted_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true}],"forcedRls":true,"constraints":[{"name":"profiles_deleted_at_check","type":"c","definition":"CHECK (((status = 'deleted'::text) = (deleted_at IS NOT NULL)))"},{"name":"profiles_display_name_check","type":"c","definition":"CHECK (((display_name IS NULL) OR ((display_name = btrim(display_name)) AND ((char_length(display_name) >= 1) AND (char_length(display_name) <= 100)))))"},{"name":"profiles_id_check","type":"c","definition":"CHECK (((id = btrim(id)) AND ((char_length(id) >= 1) AND (char_length(id) <= 128))))"},{"name":"profiles_locale_check","type":"c","definition":"CHECK ((locale = ANY (ARRAY['ar'::text, 'en'::text])))"},{"name":"profiles_phone_e164_check","type":"c","definition":"CHECK (((phone_e164 IS NULL) OR (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'::text)))"},{"name":"profiles_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"name":"profiles_primary_email_check","type":"c","definition":"CHECK (((primary_email IS NULL) OR ((primary_email = lower(btrim(primary_email))) AND ((char_length(primary_email) >= 1) AND (char_length(primary_email) <= 320)))))"},{"name":"profiles_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deletion_pending'::text, 'deleted'::text])))"},{"name":"profiles_timezone_check","type":"c","definition":"CHECK (((timezone = btrim(timezone)) AND ((char_length(timezone) >= 1) AND (char_length(timezone) <= 64))))"},{"name":"profiles_version_check","type":"c","definition":"CHECK ((version > 0))"}]},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,authenticated=r/masarifi_migration,masarifi_api=r/masarifi_migration}","rls":true,"kind":"r","name":"tracking_preferences","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notNull":true},{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"enabled","type":"boolean","default":"false","notNull":true},{"name":"review_required","type":"boolean","default":"true","notNull":true},{"name":"duplicate_window_seconds","type":"integer","default":"86400","notNull":true},{"name":"source_retention_days","type":"integer","default":"30","notNull":true},{"name":"history_retention_days","type":"integer","default":"365","notNull":true},{"name":"created_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true}],"forcedRls":true,"constraints":[{"name":"tracking_preferences_duplicate_window_seconds_check","type":"c","definition":"CHECK (((duplicate_window_seconds >= 60) AND (duplicate_window_seconds <= 2592000)))"},{"name":"tracking_preferences_history_retention_days_check","type":"c","definition":"CHECK (((history_retention_days >= 30) AND (history_retention_days <= 730)))"},{"name":"tracking_preferences_id_user_id_key","type":"u","definition":"UNIQUE (id, user_id)"},{"name":"tracking_preferences_pkey","type":"p","definition":"PRIMARY KEY (user_id)"},{"name":"tracking_preferences_source_retention_days_check","type":"c","definition":"CHECK (((source_retention_days >= 1) AND (source_retention_days <= 365)))"},{"name":"tracking_preferences_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON UPDATE RESTRICT ON DELETE CASCADE"},{"name":"tracking_preferences_version_check","type":"c","definition":"CHECK ((version > 0))"}]},{"acl":null,"rls":true,"kind":"r","name":"tracking_rule_channels","owner":"masarifi_migration","schema":"public","columns":[{"name":"environment","type":"text","default":"'default'::text","notNull":true},{"name":"market","type":"text","default":"'global'::text","notNull":true},{"name":"channel","type":"text","default":"'all'::text","notNull":true},{"name":"release_id","type":"uuid","default":null,"notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true},{"name":"mode","type":"text","default":"'review'::text","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","notNull":true}],"forcedRls":true,"constraints":[{"name":"tracking_rule_channels_mode_check","type":"c","definition":"CHECK ((mode = ANY (ARRAY['shadow'::text, 'review'::text, 'automatic'::text])))"},{"name":"tracking_rule_channels_pkey","type":"p","definition":"PRIMARY KEY (environment, market, channel)"},{"name":"tracking_rule_channels_release_id_fkey","type":"f","definition":"FOREIGN KEY (release_id) REFERENCES tracking_rule_releases(id)"}]},{"acl":null,"rls":true,"kind":"r","name":"tracking_rule_releases","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notNull":true},{"name":"release_no","type":"bigint","default":null,"notNull":true},{"name":"schema_version","type":"integer","default":null,"notNull":true},{"name":"engine_version","type":"text","default":null,"notNull":true},{"name":"status","type":"text","default":"'draft'::text","notNull":true},{"name":"snapshot","type":"jsonb","default":null,"notNull":true},{"name":"content_hash","type":"text","default":null,"notNull":true},{"name":"validated_hash","type":"text","default":null,"notNull":false},{"name":"corpus_result","type":"jsonb","default":null,"notNull":false},{"name":"created_by","type":"text","default":null,"notNull":true},{"name":"published_by","type":"text","default":null,"notNull":false},{"name":"published_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"reason","type":"text","default":null,"notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notNull":true}],"forcedRls":true,"constraints":[{"name":"tracking_rule_releases_content_hash_check","type":"c","definition":"CHECK ((content_hash ~ '^[a-f0-9]{64}$'::text))"},{"name":"tracking_rule_releases_engine_version_check","type":"c","definition":"CHECK ((engine_version = '2.0.0'::text))"},{"name":"tracking_rule_releases_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"name":"tracking_rule_releases_reason_check","type":"c","definition":"CHECK (((char_length(reason) >= 10) AND (char_length(reason) <= 500)))"},{"name":"tracking_rule_releases_release_no_key","type":"u","definition":"UNIQUE (release_no)"},{"name":"tracking_rule_releases_schema_version_check","type":"c","definition":"CHECK ((schema_version = 2))"},{"name":"tracking_rule_releases_snapshot_check","type":"c","definition":"CHECK (((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 262144)))"},{"name":"tracking_rule_releases_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['draft'::text, 'validated'::text, 'published'::text])))"}]},{"acl":"{masarifi_migration=arwdDxtm/masarifi_migration,masarifi_api=ar/masarifi_migration,masarifi_worker=r/masarifi_migration}","rls":true,"kind":"r","name":"user_devices","owner":"masarifi_migration","schema":"public","columns":[{"name":"id","type":"uuid","default":"extensions.gen_random_uuid()","notNull":true},{"name":"user_id","type":"text","default":null,"notNull":true},{"name":"device_fingerprint","type":"text","default":null,"notNull":true},{"name":"clerk_session_id","type":"text","default":null,"notNull":false},{"name":"platform","type":"text","default":null,"notNull":true},{"name":"app_version","type":"text","default":null,"notNull":true},{"name":"device_name","type":"text","default":null,"notNull":false},{"name":"trusted_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"last_seen_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"revoked_at","type":"timestamp with time zone","default":null,"notNull":false},{"name":"created_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"updated_at","type":"timestamp with time zone","default":"now()","notNull":true},{"name":"version","type":"bigint","default":"1","notNull":true}],"forcedRls":true,"constraints":[{"name":"user_devices_app_version_check","type":"c","definition":"CHECK (((app_version = btrim(app_version)) AND (app_version ~ '^[A-Za-z0-9._+-]{1,32}$'::text)))"},{"name":"user_devices_fingerprint_check","type":"c","definition":"CHECK ((device_fingerprint ~ '^h1:[0-9a-f]{64}$'::text))"},{"name":"user_devices_name_check","type":"c","definition":"CHECK (((device_name IS NULL) OR ((device_name = btrim(device_name)) AND ((char_length(device_name) >= 1) AND (char_length(device_name) <= 80)))))"},{"name":"user_devices_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"name":"user_devices_platform_check","type":"c","definition":"CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))"},{"name":"user_devices_session_check","type":"c","definition":"CHECK (((clerk_session_id IS NULL) OR ((clerk_session_id = btrim(clerk_session_id)) AND ((char_length(clerk_session_id) >= 1) AND (char_length(clerk_session_id) <= 255)))))"},{"name":"user_devices_trust_revoke_check","type":"c","definition":"CHECK (((trusted_at IS NULL) OR (revoked_at IS NULL) OR (trusted_at <= revoked_at)))"},{"name":"user_devices_user_id_fkey","type":"f","definition":"FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE RESTRICT"},{"name":"user_devices_version_check","type":"c","definition":"CHECK ((version > 0))"}]}]$expected$::jsonb then raise exception 'CONSENT_RELATION_PREREQUISITES_DRIFT'; end if;
  if to_regclass('private.tracking_installations') is not null or exists(select 1 from pg_trigger where tgname in ('revoke_production_tracking_device','revoke_production_tracking_preferences','revoke_production_tracking_profile')) then raise exception 'CONSENT_ALREADY_PRESENT'; end if;
  perform set_config('masarifi.consent.members_before',(select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m),true);
end $guard$;
-- Preserve grantor-specific memberships and options of the invoking executor.
do $$
begin
  perform set_config('masarifi.tracking_migration_executor_role',current_setting('role'),true);
  perform set_config('masarifi.tracking_migration_membership','unchanged',true);
  if not pg_has_role(current_user,'masarifi_migration','SET') then
    if exists(select 1 from pg_auth_members where roleid='masarifi_migration'::regrole
      and member=current_user::regrole and grantor=current_user::regrole) then
      grant masarifi_migration to current_user with set true granted by current_user;
      perform set_config('masarifi.tracking_migration_membership','restore_set_false',true);
    else
      grant masarifi_migration to current_user with set true,inherit false granted by current_user;
      perform set_config('masarifi.tracking_migration_membership','temporary',true);
    end if;
  end if;
end $$;
set local role masarifi_migration;

-- Explicit production authority has its own storage. No DEV row is enrolled or changed.
create table private.tracking_installations (
  user_id text not null references public.profiles(id) on delete cascade,
  tracking_device_id uuid not null,
  notification_device_id uuid not null references public.user_devices(id) on delete cascade,
  clerk_session_id text not null check(char_length(clerk_session_id) between 1 and 256),
  version integer not null check(version>0),
  generation uuid not null,
  sources jsonb not null check(jsonb_typeof(sources)='object'),
  authority_revoked boolean not null default false,
  last_expected_version integer,
  last_command_hash text check(last_command_hash ~ '^[a-f0-9]{64}$'),
  last_response jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,tracking_device_id)
);
create index tracking_installations_registered_device on private.tracking_installations(notification_device_id);
alter table private.tracking_installations enable row level security;
alter table private.tracking_installations force row level security;
create policy tracking_installations_migration on private.tracking_installations
  to masarifi_migration using(true) with check(true);
revoke all on private.tracking_installations from public,anon,authenticated,masarifi_api,masarifi_worker;
-- Only the asserted command writes approvals. Revocation triggers must also work
-- after a profile becomes inactive, so the ordinary payload-write fence is not used here.

create function private.tracking_installation_active(p_owner text,p_device uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.tracking_installations i
    join public.profiles owner on owner.id=i.user_id and owner.status='active'
    join public.tracking_preferences p on p.user_id=i.user_id and p.enabled
    join public.user_devices d on d.id=i.notification_device_id and d.user_id=i.user_id
      and d.platform='android' and d.revoked_at is null and d.clerk_session_id=i.clerk_session_id
    where i.user_id=p_owner and i.tracking_device_id=p_device and not i.authority_revoked
      and (i.sources->>'smsEnabled'='true' or i.sources->>'notificationEnabled'='true'));
$$;

create function private.tracking_installation_configuration(p_owner text,p_device uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; configuration jsonb; receipt jsonb; allowed boolean; review_required boolean;
begin
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id=p_device;
  if i.user_id is null then raise exception 'TRACKING_INSTALLATION_NOT_FOUND'; end if;
  allowed:=private.tracking_installation_active(p_owner,p_device)
    and i.clerk_session_id=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  receipt:=jsonb_build_object('deviceId',i.tracking_device_id,'version',i.version,'generation',i.generation,
    'sessionBinding',encode(extensions.digest('masarifi:tracking:session:v1:'||i.user_id||':'||i.clerk_session_id,'sha256'),'hex'),
    'sources',i.sources,'captureAllowed',coalesce(allowed,false));
  begin
    configuration:=private.get_tracking_rule_snapshot(p_owner);
  exception when sqlstate '22023' then
    if sqlerrm<>'TRACKING_RULES_UNAVAILABLE' then raise; end if;
    return jsonb_build_object('installation',receipt||'{"captureAllowed":false}'::jsonb,'configurationAvailable',false);
  end;
  select p.review_required into review_required from public.tracking_preferences p where p.user_id=p_owner;
  configuration:=configuration||jsonb_build_object('installation',receipt,'configurationAvailable',true,
    'rolloutMode',case when allowed and not review_required then 'automatic' else 'review' end);
  if not allowed then return configuration; end if;
  return configuration||jsonb_strip_nulls(jsonb_build_object('sourceAdmissionPolicy','financial_content_v1','currencyAccountPolicy','source_currency_v1',
    'policyActivatedAt',floor(extract(epoch from least((i.sources->>'smsActivatedAt')::timestamptz,
      (i.sources->>'notificationActivatedAt')::timestamptz))*1000)::bigint,
    'policySmsActivationId',coalesce(i.sources->>'smsActivationId','0'),
    'smsActivatedAt',case when i.sources->>'smsEnabled'='true' then floor(extract(epoch from (i.sources->>'smsActivatedAt')::timestamptz)*1000)::bigint end,
    'notificationActivatedAt',case when i.sources->>'notificationEnabled'='true' then floor(extract(epoch from (i.sources->>'notificationActivatedAt')::timestamptz)*1000)::bigint end));
end $$;

create or replace function private.configure_tracking_installation(
  p_owner text,p_device uuid,p_registered uuid,p_expected_version integer,p_sources jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare i private.tracking_installations; device public.user_devices; prefs public.tracking_preferences;
  sid text; command_hash text; accepted_at timestamptz; effective jsonb; result jsonb; configuration jsonb;
begin
  perform private.assert_active_profile(p_owner);
  sid:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  if p_device is null or p_registered is null or p_expected_version is null or p_expected_version not between 0 and 2147483646
    or sid is null or char_length(sid) not between 1 and 256 or jsonb_typeof(p_sources) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_sources) k where k not in ('smsEnabled','notificationEnabled','smsActivatedAt','smsActivationId','notificationActivatedAt'))
    or jsonb_typeof(p_sources->'smsEnabled') is distinct from 'boolean'
    or jsonb_typeof(p_sources->'notificationEnabled') is distinct from 'boolean' then
    raise exception using errcode='22023',message='TRACKING_INSTALLATION_INPUT_INVALID';
  end if;
  if (p_sources->>'smsEnabled'='true' and
      (p_sources->>'smsActivatedAt' is null or coalesce(p_sources->>'smsActivationId','') !~ '^[0-9]{1,19}$'
        or (p_sources->>'smsActivationId')::numeric>9223372036854775807))
    or (p_sources->>'smsEnabled'='false' and
      (p_sources->>'smsActivatedAt' is not null or p_sources->>'smsActivationId' is not null))
    or (p_sources->>'notificationEnabled'='true' and p_sources->>'notificationActivatedAt' is null)
    or (p_sources->>'notificationEnabled'='false' and p_sources->>'notificationActivatedAt' is not null) then
    raise exception using errcode='22023',message='TRACKING_INSTALLATION_INPUT_INVALID';
  end if;
  -- Same lock order as device/preferences revocation: profile, device, preferences, installation.
  select * into device from public.user_devices where id=p_registered and user_id=p_owner
    and platform='android' and revoked_at is null and clerk_session_id=sid for share;
  if device.id is null then raise exception using errcode='22023',message='DEVICE_NOT_FOUND'; end if;
  select * into prefs from public.tracking_preferences where user_id=p_owner for share;
  perform pg_advisory_xact_lock(hashtextextended('tracking-installation:'||p_owner||':'||p_device::text,0));
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id=p_device for update;
  command_hash:=encode(extensions.digest(jsonb_build_object('device',p_registered,'session',sid,'sources',p_sources)::text,'sha256'),'hex');
  if i.user_id is not null and i.last_expected_version=p_expected_version and i.last_command_hash=command_hash
    and i.last_response is not null then return i.last_response; end if;
  if coalesce(i.version,0)<>p_expected_version then
    raise exception using errcode='40001',message='TRACKING_INSTALLATION_VERSION_CONFLICT';
  end if;
  if i.user_id is not null and i.notification_device_id<>p_registered then
    raise exception using errcode='40001',message='TRACKING_DEVICE_BINDING_CONFLICT';
  end if;
  if p_sources->>'smsEnabled'='true' or p_sources->>'notificationEnabled'='true' then
    if not coalesce(prefs.enabled,false) then raise exception using errcode='40001',message='TRACKING_CAPTURE_DISABLED_CONFLICT'; end if;
    configuration:=private.get_tracking_rule_snapshot(p_owner);
  end if;
  accepted_at:=date_trunc('milliseconds',clock_timestamp());
  effective:=jsonb_build_object('smsEnabled',(p_sources->>'smsEnabled')::boolean,
    'notificationEnabled',(p_sources->>'notificationEnabled')::boolean,
    'smsActivatedAt',case when p_sources->>'smsEnabled'='true' then greatest(accepted_at,(p_sources->>'smsActivatedAt')::timestamptz) end,
    'smsActivationId',case when p_sources->>'smsEnabled'='true' then (p_sources->>'smsActivationId')::numeric::text end,
    'notificationActivatedAt',case when p_sources->>'notificationEnabled'='true' then greatest(accepted_at,(p_sources->>'notificationActivatedAt')::timestamptz) end);
  insert into private.tracking_installations(user_id,tracking_device_id,notification_device_id,clerk_session_id,version,generation,sources,last_expected_version,last_command_hash)
    values(p_owner,p_device,p_registered,sid,p_expected_version+1,extensions.gen_random_uuid(),effective,p_expected_version,command_hash)
    on conflict(user_id,tracking_device_id) do update set clerk_session_id=excluded.clerk_session_id,
      version=excluded.version,generation=excluded.generation,sources=excluded.sources,authority_revoked=false,
      last_expected_version=excluded.last_expected_version,last_command_hash=excluded.last_command_hash,last_response=null,updated_at=clock_timestamp();
  result:=private.tracking_installation_configuration(p_owner,p_device);
  update private.tracking_installations set last_response=result where user_id=p_owner and tracking_device_id=p_device;
  return result;
end $$;

-- A returned SDK binding or unpause cannot resurrect a revoked capability.
create function private.revoke_tracking_installation_authority() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='user_devices' then
    if old.user_id is not distinct from new.user_id and old.clerk_session_id is not distinct from new.clerk_session_id
      and old.platform is not distinct from new.platform and old.revoked_at is not distinct from new.revoked_at then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where notification_device_id=old.id;
  elsif tg_table_name='tracking_preferences' then
    if old.enabled is not true or new.enabled is not false then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where user_id=old.user_id;
  elsif tg_table_name='profiles' then
    if old.status is distinct from 'active' or new.status='active' then return new; end if;
    update private.tracking_installations set authority_revoked=true,version=version+1,generation=extensions.gen_random_uuid(),
      last_command_hash=null,last_response=null,updated_at=clock_timestamp() where user_id=old.id;
  end if;
  return new;
end $$;
create trigger revoke_production_tracking_device after update of user_id,clerk_session_id,platform,revoked_at on public.user_devices
  for each row execute function private.revoke_tracking_installation_authority();
create trigger revoke_production_tracking_preferences after update of enabled on public.tracking_preferences
  for each row execute function private.revoke_tracking_installation_authority();
create trigger revoke_production_tracking_profile after update of status on public.profiles
  for each row execute function private.revoke_tracking_installation_authority();

alter function private.get_tracking_device_rule_snapshot(text,text) rename to get_tracking_device_rule_snapshot_before_production;
revoke all on function private.get_tracking_device_rule_snapshot_before_production(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.get_tracking_device_rule_snapshot(p_owner text,p_device text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_active_profile(p_owner);
  if exists(select 1 from private.tracking_installations where user_id=p_owner and tracking_device_id::text=lower(p_device)) then
    return private.tracking_installation_configuration(p_owner,p_device::uuid);
  end if;
  return private.get_tracking_device_rule_snapshot_before_production(p_owner,p_device);
end $$;
revoke all on function private.tracking_installation_active(text,uuid),private.tracking_installation_configuration(text,uuid),
  private.revoke_tracking_installation_authority(),private.configure_tracking_installation(text,uuid,uuid,integer,jsonb),
  private.get_tracking_device_rule_snapshot(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
grant execute on function private.configure_tracking_installation(text,uuid,uuid,integer,jsonb),private.get_tracking_device_rule_snapshot(text,text) to masarifi_api;

-- Production capture consumers. Legacy rows/functions remain available only for unmanaged installations.
create function private.tracking_installation_event_admitted(p_owner text,p_payload jsonb) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; boundary timestamptz; channel text;
begin
  select * into i from private.tracking_installations where user_id=p_owner
    and tracking_device_id::text=lower(p_payload#>>'{transport,deviceId}');
  if i.user_id is null then return not (coalesce(p_payload->'transport','{}'::jsonb) ?| array['installationGeneration','installationVersion']); end if;
  if not private.tracking_installation_active(p_owner,i.tracking_device_id)
    or p_payload#>>'{transport,installationGeneration}' is distinct from i.generation::text
    or p_payload#>>'{transport,installationVersion}' is distinct from i.version::text
    or p_payload->>'accountingPolicy' is distinct from 'default_account_nominal_v1'
    or p_payload#>>'{metadata,sourceAdmissionPolicy}' is distinct from 'financial_content_v1' then return false; end if;
  channel:=p_payload#>>'{transport,channel}';
  if channel='android_sms' and i.sources->>'smsEnabled'='true' then
    boundary:=(i.sources->>'smsActivatedAt')::timestamptz;
  elsif channel='android_notification' and i.sources->>'notificationEnabled'='true' then
    boundary:=(i.sources->>'notificationActivatedAt')::timestamptz;
  else return false; end if;
  return coalesce((p_payload->>'receivedAt')::timestamptz>=boundary
    and (p_payload->>'activatedAt')::timestamptz>=boundary
    and (p_payload->>'activatedAt')::timestamptz<=(p_payload->>'receivedAt')::timestamptz,false);
end $$;

create function private.lock_tracking_installation(p_owner text,p_device text) returns boolean
language plpgsql security definer set search_path='' as $$
declare i private.tracking_installations;
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('tracking-installation:'||p_owner||':'||lower(p_device),0));
  select * into i from private.tracking_installations where user_id=p_owner and tracking_device_id::text=lower(p_device);
  if i.user_id is null then return false; end if;
  perform 1 from public.user_devices where id=i.notification_device_id for share;
  perform 1 from public.tracking_preferences where user_id=p_owner for share;
  perform 1 from private.tracking_installations where user_id=p_owner and tracking_device_id=i.tracking_device_id for share;
  return true;
end $$;

alter function private.create_import_session(text,text,text,integer,text,jsonb) rename to create_import_session_before_production;
revoke all on function private.create_import_session_before_production(text,text,text,integer,text,jsonb) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.create_import_session(p_user_id text,p_source_type text,p_source_name text,p_schema_version integer,p_request_hash text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e jsonb; managed boolean; sid text;
begin
  perform private.assert_active_profile(p_user_id);
  -- An already accepted immutable request is a receipt lookup, not a new capture.
  if exists(select 1 from public.import_sessions where user_id=p_user_id and request_hash=p_request_hash) then
    return private.create_import_session_before_production(p_user_id,p_source_type,p_source_name,p_schema_version,p_request_hash,p_events);
  end if;
  sid:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sid';
  for e in select value from jsonb_array_elements(p_events) order by value#>>'{transport,deviceId}' loop
    if e#>>'{transport,deviceId}' is null then continue; end if;
    managed:=private.lock_tracking_installation(p_user_id,e#>>'{transport,deviceId}');
    if not private.tracking_installation_event_admitted(p_user_id,e)
      or (managed and not exists(select 1 from private.tracking_installations where user_id=p_user_id
        and tracking_device_id::text=lower(e#>>'{transport,deviceId}') and clerk_session_id=sid)) then
      raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
    end if;
  end loop;
  return private.create_import_session_before_production(p_user_id,p_source_type,p_source_name,p_schema_version,p_request_hash,p_events);
end $$;

alter function private.tracking_content_cohort(text,text) rename to tracking_content_cohort_before_production;
revoke all on function private.tracking_content_cohort_before_production(text,text) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_content_cohort(p_user_id text,p_device_id text) returns setof private.tracking_automatic_cohorts
language plpgsql stable security definer set search_path='' as $$
declare i private.tracking_installations; release public.tracking_rule_releases;
begin
  select * into i from private.tracking_installations where user_id=p_user_id and tracking_device_id::text=lower(p_device_id);
  if i.user_id is null then return query select * from private.tracking_content_cohort_before_production(p_user_id,p_device_id); return; end if;
  if not private.tracking_installation_active(p_user_id,i.tracking_device_id) then return; end if;
  select r.* into release from public.tracking_rule_channels c join public.tracking_rule_releases r on r.id=c.release_id
    where c.environment='default' and c.market='global' and c.channel='all' and r.status='published' and r.engine_version='2.0.0';
  if release.id is null then return; end if;
  -- This is a typed adapter result, never an INSERT into the retained DEV cohort table.
  return next jsonb_populate_record(null::private.tracking_automatic_cohorts,jsonb_build_object(
    'user_id',i.user_id,'device_id',i.tracking_device_id,'release_id',release.id,'engine_version',release.engine_version,
    'enabled',true,'expires_at','infinity','reason','Explicit production installation consent','created_at',i.created_at,
    'source_admission_policy','financial_content_v1','capture_started_at',least((i.sources->>'smsActivatedAt')::timestamptz,
      (i.sources->>'notificationActivatedAt')::timestamptz),'sms_activation_id',coalesce(i.sources->>'smsActivationId','0'),
    'currency_account_policy','source_currency_v1','installation_managed',true));
end $$;

alter function private.tracking_capture_auto_enabled(uuid) rename to tracking_capture_auto_enabled_before_production;
revoke all on function private.tracking_capture_auto_enabled_before_production(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_capture_auto_enabled(p_item_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items;
begin
  select * into i from public.import_items where id=p_item_id;
  if not exists(select 1 from private.tracking_installations where user_id=i.user_id and tracking_device_id::text=lower(i.normalized_payload#>>'{transport,deviceId}')) then
    return private.tracking_capture_auto_enabled_before_production(p_item_id);
  end if;
  return private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) and exists(
    select 1 from public.tracking_preferences p join public.tracking_rule_channels c
      on c.environment='default' and c.market='global' and c.channel='all'
      join public.tracking_rule_releases r on r.id=c.release_id and r.status='published'
    where p.user_id=i.user_id and p.enabled and not p.review_required
      and r.snapshot->>'releaseId'=i.normalized_payload#>>'{classification,releaseId}'
      and r.engine_version=i.normalized_payload#>>'{classification,engineVersion}');
end $$;

alter function private.tracking_nominal_source(uuid) rename to tracking_nominal_source_before_production;
revoke all on function private.tracking_nominal_source_before_production(uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.tracking_nominal_source(p_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare i public.import_items; result jsonb;
begin
  select * into i from public.import_items where id=p_item_id;
  result:=private.tracking_nominal_source_before_production(p_item_id);
  if not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
    return result||'{"eligible":false}'::jsonb;
  end if;
  return result;
end $$;

alter function private.finalize_import_session(uuid,uuid) rename to finalize_import_session_before_production;
revoke all on function private.finalize_import_session_before_production(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.finalize_import_session(p_session_id uuid,p_fence_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.import_sessions; i public.import_items;
begin
  select * into s from public.import_sessions where id=p_session_id and claim_token=p_fence_token
    and lease_until>clock_timestamp() and status='processing' for update;
  if s.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  for i in select * from public.import_items where session_id=s.id and status='parsed'
    order by normalized_payload#>>'{transport,deviceId}',id loop
    if i.normalized_payload#>>'{transport,deviceId}' is null then continue; end if;
    if private.lock_tracking_installation(i.user_id,i.normalized_payload#>>'{transport,deviceId}') then
      if not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
        raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
      end if;
      if exists(select 1 from public.tracking_preferences where user_id=i.user_id and review_required) then
        perform private.create_review_item(i.id,'review_required',i.normalized_payload);
      end if;
    end if;
  end loop;
  return private.finalize_import_session_before_production(p_session_id,p_fence_token);
end $$;

alter function private.commit_tracking_nominal_capture(uuid,uuid) rename to commit_tracking_nominal_capture_before_production;
revoke all on function private.commit_tracking_nominal_capture_before_production(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
create function private.commit_tracking_nominal_capture(p_item uuid,p_fence uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.import_items;
begin
  select x.* into i from public.import_items x join public.import_sessions s on s.id=x.session_id
    where x.id=p_item and s.claim_token=p_fence and s.lease_until>clock_timestamp() and x.status in ('parsed','accepted');
  if i.id is null then raise exception using errcode='40001',message='IMPORT_LEASE_STALE'; end if;
  if i.status<>'accepted' and private.lock_tracking_installation(i.user_id,i.normalized_payload#>>'{transport,deviceId}')
    and not private.tracking_installation_event_admitted(i.user_id,i.normalized_payload) then
    raise exception using errcode='40001',message='TRACKING_INSTALLATION_STALE';
  end if;
  return private.commit_tracking_nominal_capture_before_production(p_item,p_fence);
end $$;

revoke all on function private.tracking_installation_event_admitted(text,jsonb),private.lock_tracking_installation(text,text),
  private.create_import_session(text,text,text,integer,text,jsonb),private.tracking_content_cohort(text,text),
  private.tracking_capture_auto_enabled(uuid),private.tracking_nominal_source(uuid),private.finalize_import_session(uuid,uuid),
  private.commit_tracking_nominal_capture(uuid,uuid) from public,anon,authenticated,masarifi_api,masarifi_worker;
grant execute on function private.create_import_session(text,text,text,integer,text,jsonb) to masarifi_api;
grant execute on function private.finalize_import_session(uuid,uuid),private.commit_tracking_nominal_capture(uuid,uuid) to masarifi_worker;

reset role;
select set_config('role',current_setting('masarifi.tracking_migration_executor_role'),true);
do $$
begin
  if current_setting('masarifi.tracking_migration_membership')='temporary' then
    revoke masarifi_migration from current_user granted by current_user;
  elsif current_setting('masarifi.tracking_migration_membership')='restore_set_false' then
    grant masarifi_migration to current_user with set false granted by current_user;
  end if;
end $$;

do $post$
begin
  if (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'securityDefiner',p.prosecdef,'strict',p.proisstrict,
 'volatility',p.provolatile,'configuration',p.proconfig,'acl',p.proacl::text,'bodyMd5Lf',md5(replace(p.prosrc,E'\r\n',E'\n')))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='private' AND p.proname IN ('assert_active_profile','commit_tracking_nominal_capture','commit_tracking_nominal_capture_before_production','configure_tracking_installation','create_import_session','create_import_session_before_production','create_review_item','finalize_import_session','finalize_import_session_before_production','get_tracking_device_rule_snapshot','get_tracking_device_rule_snapshot_before_production','get_tracking_rule_snapshot','lock_tracking_installation','revoke_tracking_installation_authority','tracking_capture_auto_enabled','tracking_capture_auto_enabled_before_production','tracking_content_cohort','tracking_content_cohort_before_production','tracking_installation_active','tracking_installation_configuration','tracking_installation_event_admitted','tracking_installations','tracking_nominal_source','tracking_nominal_source_before_production')) is distinct from $expected$[{"name":"assert_active_profile","arguments":"p_user_id text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"1ffdad9399e4fcceeed4d475f9ae6cc9"},{"name":"commit_tracking_nominal_capture","arguments":"p_item uuid, p_fence uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"92bf69de909a5569ad90287e56733b40"},{"name":"commit_tracking_nominal_capture_before_production","arguments":"p_item uuid, p_fence uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"f7c6fc19128ef5d70b0a58bcf1c70bd4"},{"name":"configure_tracking_installation","arguments":"p_owner text, p_device uuid, p_registered uuid, p_expected_version integer, p_sources jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"5c7f454e3ef2dec04efb7235046de29c"},{"name":"create_import_session","arguments":"p_user_id text, p_source_type text, p_source_name text, p_schema_version integer, p_request_hash text, p_events jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"7e1dc7c471fbffa5974f2475867be26e"},{"name":"create_import_session_before_production","arguments":"p_user_id text, p_source_type text, p_source_name text, p_schema_version integer, p_request_hash text, p_events jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"8806de295633612fe929b49375366bed"},{"name":"create_review_item","arguments":"p_import_item_id uuid, p_reason text, p_proposed_values jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"8a507c772f402752628623baaf03cc94"},{"name":"finalize_import_session","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_worker=X/masarifi_migration}","bodyMd5Lf":"ff736acd1357a3e1d2a461145191dd63"},{"name":"finalize_import_session_before_production","arguments":"p_session_id uuid, p_fence_token uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"9f19a8e2d79483b9695bebc213367ec9"},{"name":"get_tracking_device_rule_snapshot","arguments":"p_owner text, p_device text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"9309a69587044b505e499c73d578602b"},{"name":"get_tracking_device_rule_snapshot_before_production","arguments":"p_user_id text, p_device_id text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"d919eccda58e45154105f03180730e53"},{"name":"get_tracking_rule_snapshot","arguments":"p_user_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration,masarifi_api=X/masarifi_migration}","bodyMd5Lf":"fa76607377bd632b36a42dc5a46ccd3c"},{"name":"lock_tracking_installation","arguments":"p_owner text, p_device text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"349b42b697c2767c48d41c81d195ee34"},{"name":"revoke_tracking_installation_authority","arguments":"","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"v","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"eb75247d7e13d7fc60bb1cadf6059465"},{"name":"tracking_capture_auto_enabled","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"d1d07642360e073426e1292f669d67cb"},{"name":"tracking_capture_auto_enabled_before_production","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"031defd1ca932a2a80908d0c271c552d"},{"name":"tracking_content_cohort","arguments":"p_user_id text, p_device_id text","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"eddb4923723d376f329ad7803e42751c"},{"name":"tracking_content_cohort_before_production","arguments":"p_user_id text, p_device_id text","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"60c74ec83856b9e844d4b07135e3f387"},{"name":"tracking_installation_active","arguments":"p_owner text, p_device uuid","owner":"masarifi_migration","language":"sql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"2f8358f4ffe4ed03f4f0a565028e90eb"},{"name":"tracking_installation_configuration","arguments":"p_owner text, p_device uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"eb4d9f043f5d21bbb2d59f7f2fc1fe1a"},{"name":"tracking_installation_event_admitted","arguments":"p_owner text, p_payload jsonb","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"07704b16e9b940c2df981f84bc55a4e7"},{"name":"tracking_nominal_source","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"ba121b2c855931cde7b227da9c684e55"},{"name":"tracking_nominal_source_before_production","arguments":"p_item_id uuid","owner":"masarifi_migration","language":"plpgsql","securityDefiner":true,"strict":false,"volatility":"s","configuration":["search_path=\"\""],"acl":"{masarifi_migration=X/masarifi_migration}","bodyMd5Lf":"e79915676df84636c401375720021c8e"}]$expected$::jsonb then raise exception 'CONSENT_FUNCTION_POSTCONDITIONS_FAILED'; end if;
  if (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by m.oid),'')) from pg_auth_members m) is distinct from current_setting('masarifi.consent.members_before') then raise exception 'CONSENT_MEMBERSHIP_RESTORATION_FAILED'; end if;
  if not exists(select 1 from pg_class where oid='private.tracking_installations'::regclass and relowner='masarifi_migration'::regrole and relrowsecurity and relforcerowsecurity) then raise exception 'CONSENT_TABLE_SECURITY_FAILED'; end if;
  if exists(select 1 from private.tracking_installations) then raise exception 'CONSENT_UNEXPECTED_ENROLLMENT'; end if;
end $post$;

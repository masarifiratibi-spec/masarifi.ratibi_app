set search_path=pg_catalog;
with namespaces as (
  select oid,nspname,nspowner,nspacl from pg_namespace
  where left(nspname,3)<>'pg_' and nspname<>'information_schema'
), tables as (
  select c.*,n.nspname from pg_class c join namespaces n on n.oid=c.relnamespace
  where c.relkind in('r','p','v','m','S','f')
), role_summary as (
  select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconnlimit,rolconfig
  from pg_roles where left(rolname,3)<>'pg_'
), membership_summary as (
  select a.rolname as granted,b.rolname as member,g.rolname as grantor,m.admin_option,m.inherit_option,m.set_option
  from pg_auth_members m join pg_roles a on a.oid=m.roleid join pg_roles b on b.oid=m.member join pg_roles g on g.oid=m.grantor
), extension_summary as (
  select extname,extversion,n.nspname as schema,pg_get_userbyid(extowner) as owner
  from pg_extension e join pg_namespace n on n.oid=e.extnamespace
), relation_summary as (
  select nspname,relname,relkind,pg_get_userbyid(relowner) as owner,relrowsecurity,relforcerowsecurity,reloptions
  from tables
), column_summary as (
  select t.nspname,t.relname,a.attname,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) as default_expr
  from tables t join pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum
), function_summary as (
  select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,pg_get_userbyid(p.proowner) as owner,pg_get_functiondef(p.oid) as definition
  from pg_proc p join namespaces n on n.oid=p.pronamespace where p.prokind in('f','p','w')
), policy_summary as (
  select * from pg_policies where left(schemaname,3)<>'pg_' and schemaname<>'information_schema'
), relation_acl as (
  select t.nspname,t.relname,pg_get_userbyid(a.grantor) as grantor,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,a.privilege_type,a.is_grantable
  from tables t cross join lateral aclexplode(coalesce(t.relacl,acldefault(case when t.relkind='S' then 's'::"char" else 'r'::"char" end,t.relowner))) a
), schema_acl as (
  select n.nspname,pg_get_userbyid(n.nspowner) as owner,pg_get_userbyid(a.grantor) as grantor,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,a.privilege_type,a.is_grantable
  from namespaces n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
), constraint_summary as (
  select n.nspname,c.conrelid::regclass::text as relation,c.contypid::regtype::text as domain,c.conname,c.contype,c.convalidated,c.connoinherit,c.conislocal,c.condeferrable,c.condeferred,pg_get_constraintdef(c.oid) as definition,
    regexp_replace(c.conbin::text,':location -?[0-9]+',':location 0','g') as expression_tree
  from pg_constraint c join namespaces n on n.oid=c.connamespace
), trigger_summary as (
  select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join namespaces n on n.oid=c.relnamespace where not t.tgisinternal
), index_summary as (
  select n.nspname,c.relname,pg_get_indexdef(c.oid) as definition
  from pg_class c join namespaces n on n.oid=c.relnamespace where c.relkind in('i','I')
), function_acl as (
  select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,pg_get_userbyid(a.grantor) as grantor,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,a.privilege_type,a.is_grantable
  from pg_proc p join namespaces n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
)
select json_build_object(
  'database',(select json_build_object('owner',pg_get_userbyid(datdba),'acl',(select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type) from aclexplode(coalesce(datacl,acldefault('d',datdba))) a),'encoding',pg_encoding_to_char(encoding),'collate',datcollate,'ctype',datctype,'provider',datlocprovider,'locale',datlocale) from pg_database where datname=current_database()),
  'roles',(select md5(string_agg(to_jsonb(x)::text,'|' order by rolname)) from role_summary x),
  'memberships',(select md5(string_agg(to_jsonb(x)::text,'|' order by granted,member,grantor)) from membership_summary x),
  'extensions',(select json_agg(x order by extname) from extension_summary x),
  'relations',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,relname)) from relation_summary x),
  'columns',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,relname,attname)) from column_summary x),
  'functions',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,proname,args)) from function_summary x),
  'policies',(select md5(string_agg(to_jsonb(x)::text,'|' order by schemaname,tablename,policyname)) from policy_summary x),
  'relationAcl',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,relname,grantor,grantee,privilege_type)) from relation_acl x),
  'schemaAcl',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,grantor,grantee,privilege_type)) from schema_acl x),
  'constraints',(select json_agg(x order by nspname,relation,domain,conname) from constraint_summary x),
  'triggers',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,relname,tgname)) from trigger_summary x),
  'indexes',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,relname)) from index_summary x),
  'functionAcl',(select md5(string_agg(to_jsonb(x)::text,'|' order by nspname,proname,args,grantor,grantee,privilege_type)) from function_acl x),
  'databaseSettings',(select md5(string_agg(jsonb_build_object('database',d.datname,'role',coalesce(r.rolname,'ALL'),'settings',s.setconfig)::text,'|' order by d.datname,r.rolname)) from pg_db_role_setting s join pg_database d on d.oid=s.setdatabase left join pg_roles r on r.oid=s.setrole where d.datname=current_database()),
  'views',(select md5(string_agg(jsonb_build_object('schema',nspname,'name',relname,'definition',pg_get_viewdef(oid))::text,'|' order by nspname,relname)) from tables where relkind in('v','m')),
  'defaultAcl',(select md5(string_agg(jsonb_build_object('role',r.rolname,'schema',n.nspname,'type',d.defaclobjtype,'grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable)::text,'|' order by r.rolname,n.nspname,d.defaclobjtype,a.grantor::regrole::text,a.grantee::regrole::text,a.privilege_type)) from pg_default_acl d join pg_roles r on r.oid=d.defaclrole left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a),
  'migrations',(select json_build_object('rows',count(*),'digest',md5(string_agg(to_jsonb(m)::text,'|' order by version))) from supabase_migrations.schema_migrations m),
  'applicationTables',(select count(*) from tables where nspname in('public','private','audit') and relkind in('r','p'))
);

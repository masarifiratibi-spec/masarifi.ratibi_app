select jsonb_build_object(
  'functions', (select coalesce(jsonb_agg(jsonb_build_object(
    'signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
    'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) order by p.oid::regprocedure::text),'[]')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and p.prokind in ('f','p')),
  'relations', (select coalesce(jsonb_agg(jsonb_build_object(
    'name',c.oid::regclass::text,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
    'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) end,
    'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select jsonb_agg(pg_get_constraintdef(x.oid,true) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
    'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled) order by t.tgname)
      from pg_trigger t where t.tgrelid=c.oid),
    'rules',(select coalesce(jsonb_agg(jsonb_build_object('name',r.rulename,
      'definition',pg_get_ruledef(r.oid,true),'enabled',r.ev_enabled) order by r.rulename),'[]')
      from pg_rewrite r where r.ev_class=c.oid),
    'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles::text,
      'command',p.polcmd,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),
      'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=c.oid)
    ) order by c.oid::regclass::text),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','p','v','m','S')),
  'indexes',(select coalesce(jsonb_agg(jsonb_build_object(
    'relation',c.oid::regclass::text,'name',i.indexrelid::regclass::text,
    'definition',pg_get_indexdef(i.indexrelid),'unique',i.indisunique,
    'exclusion',i.indisexclusion,'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive)
    order by c.oid::regclass::text,i.indexrelid::regclass::text),'[]')
    from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and c.relkind in ('r','p','v','m','S')),
  'extensions',(select jsonb_agg(jsonb_build_object('name',extname,'version',extversion) order by extname) from pg_extension),
  'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) order by nspname) from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema'),
  'types',(select jsonb_agg(jsonb_build_object('name',t.oid::regtype::text,'kind',t.typtype,'base',t.typbasetype::regtype::text,
    'default',t.typdefault,'notNull',t.typnotnull,
    'constraints',(select jsonb_agg(pg_get_constraintdef(c.oid,true) order by c.conname) from pg_constraint c where c.contypid=t.oid),
    'enum',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) order by t.oid::regtype::text)
    from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname not like 'pg_%' and n.nspname<>'information_schema'),
  'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'bypass',rolbypassrls,'inherit',rolinherit) order by rolname) from pg_roles),
  'memberships',(select jsonb_agg(to_jsonb(m)-'oid' order by roleid,member,grantor) from pg_auth_members m)
) catalog;

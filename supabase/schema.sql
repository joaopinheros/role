-- Rolê no Supabase (fase de testes, sem servidor Node).
-- Cole este arquivo inteiro em Supabase > SQL Editor > Run. Pode rodar de novo sem estragar nada.
--
-- Modelo: uma tabela de documentos por caminho ("roles/<id>", "roles/<id>/chat/<msg>"…), o mesmo
-- formato que o app já usa. As regras de acesso são as do server/server.js, aplicadas por RLS.
-- Quem entra é "anônimo" do Supabase Auth (ligue em Authentication > Sign In / Providers).

create table if not exists public.docs (
  path       text primary key check (length(path) <= 200),
  coll       text not null,
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 8192),
  owner      uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists docs_coll_created_idx on public.docs (coll, created_at);
create index if not exists docs_owner_idx on public.docs (owner);

-- "coll" é a coleção do documento. É coluna comum (e não gerada) para o Realtime conseguir filtrar por ela.
create or replace function public.docs_before_write() returns trigger language plpgsql as $$
begin
  new.coll := regexp_replace(new.path, '/[^/]*$', '');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_before_write on public.docs;
create trigger docs_before_write before insert or update on public.docs
  for each row execute function public.docs_before_write();

/* ------------------------------------------------------------ regras */

-- o perfil "perfis/<usuario>" é meu?
create or replace function public.is_me(u text) returns boolean language sql stable as $$
  select coalesce(exists(select 1 from public.docs p where p.path = 'perfis/' || u and p.owner = auth.uid()), false)
$$;

create or replace function public.role_exists(id text) returns boolean language sql stable as $$
  select exists(select 1 from public.docs r where r.path = 'roles/' || id)
$$;

-- cada conta tem um único perfil
create or replace function public.can_make_perfil(p text) returns boolean language sql stable as $$
  select not exists(select 1 from public.docs d where d.owner = auth.uid() and d.path like 'perfis/%' and d.path <> p)
$$;

-- o que cada documento precisa ter para ser gravado
create or replace function public.valid_doc(p text, d jsonb) returns boolean language sql stable as $$
  select coalesce(case cardinality(string_to_array(p, '/'))
    when 2 then case split_part(p, '/', 1)
      when 'perfis' then split_part(p, '/', 2) ~ '^[a-z0-9._]{3,16}$' and public.can_make_perfil(p)
      when 'roles' then split_part(p, '/', 2) ~ '^[a-z0-9]{6,16}$'
        and jsonb_typeof(d->'nome') = 'string' and length(d->>'nome') between 1 and 60
        and public.is_me(d->>'dono')
      else false end
    when 4 then case
      when split_part(p, '/', 1) = 'data' and split_part(p, '/', 2) = 'users' then split_part(p, '/', 3) = auth.uid()::text
      when split_part(p, '/', 1) = 'roles' and split_part(p, '/', 3) = 'gente'
        then public.is_me(split_part(p, '/', 4)) and public.role_exists(split_part(p, '/', 2))
      when split_part(p, '/', 1) = 'roles' and split_part(p, '/', 3) = 'chat'
        then split_part(p, '/', 4) ~ '^[a-z0-9]{4,40}$' and public.is_me(d->>'u')
        and jsonb_typeof(d->'t') = 'string' and length(d->>'t') between 1 and 280
        and public.role_exists(split_part(p, '/', 2))
      else false end
    else false end, false)
$$;

alter table public.docs enable row level security;

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select to authenticated using (
  path like 'perfis/%' or path like 'roles/%' or path like 'data/users/' || auth.uid()::text || '/%'
);

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  owner = auth.uid() and public.valid_doc(path, data)
);

-- só o dono do documento altera; mensagens do chat não mudam
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated
  using (owner = auth.uid() and path not like 'roles/%/chat/%')
  with check (owner = auth.uid() and public.valid_doc(path, data));

-- ninguém apaga pelo app (o painel admin vem depois)

/* ------------------------------------------------------------ acesso */

revoke all on public.docs from anon, authenticated;
grant select, insert, update on public.docs to authenticated;

-- update parcial: mescla os campos no documento existente
create or replace function public.doc_merge(p text, d jsonb) returns void language plpgsql security invoker as $$
begin
  update public.docs set data = data || d where path = p;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.doc_merge(text, jsonb) from public, anon;
grant execute on function public.doc_merge(text, jsonb) to authenticated;

-- tempo real (chat, mudança de dia/noite)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

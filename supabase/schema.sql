-- Rolê no Supabase: esquema relacional, regras de acesso (RLS) e funções.
-- Cole este arquivo inteiro em Supabase > SQL Editor > Run. Pode rodar de novo sem estragar nada.
-- Se você rodou a versão antiga (tabela "docs"), rode depois supabase/limpar-docs.sql.
--
-- Como funciona:
--   * Quem abre o app entra como "anônimo" do Supabase Auth (ligue em Authentication > Sign In / Providers).
--   * Login de verdade é a verificação por código: auth_start gera o código, auth_verify confere e liga
--     essa sessão anônima ao usuário (tabela sessions). Por isso o mesmo usuário entra em vários aparelhos.
--   * Ninguém escreve direto nas tabelas. Toda escrita passa por funções que validam (security definer).
--   * Leitura é por RLS: só quem está no rolê vê o rolê, os membros e o chat.
--   * Segredos (códigos, sessões, e-mail e celular) ficam fora da API.

/* ============================================================ tabelas */

-- Configuração do servidor. Fora da API.
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
insert into public.app_config (key, value) values
  ('sms_dev', '1'),         -- 1: o código volta na resposta e aparece na tela (teste). 0 quando houver SMS de verdade.
  ('sms_cap_dia', '500'),   -- teto de códigos por dia
  ('sala_horas', '8'),      -- a sala fica no ar por até 8 h depois de criada
  ('sala_max', '8')         -- até 8 pessoas por sala (para guardar todos os detalhes, inclusive a voz)
on conflict (key) do nothing;

create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (char_length(nome) between 2 and 40),
  usuario           text not null unique check (usuario ~ '^[a-z0-9._]{3,16}$'),
  email             text unique check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 120),
  telefone          text unique check (telefone ~ '^\d{10,11}$'),
  fig               text not null default '' check (char_length(fig) <= 600),
  status            text not null default 'ativo' check (status in ('ativo', 'suspenso', 'excluido')),
  aceitou_termos_em timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists users_status_idx on public.users (status, created_at);

-- Liga a sessão anônima do navegador ao usuário. Vale 60 dias e renova com o uso.
create table if not exists public.sessions (
  auth_uid     uuid primary key references auth.users (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '60 days',
  user_agent   text,
  ip           text
);
create index if not exists sessions_user_idx on public.sessions (user_id);
create index if not exists sessions_expires_idx on public.sessions (expires_at);

-- Códigos de verificação: só o hash fica guardado.
create table if not exists public.otp_codes (
  id          uuid primary key default gen_random_uuid(),
  auth_uid    uuid not null references auth.users (id) on delete cascade,
  purpose     text not null check (purpose in ('cadastro', 'login')),
  telefone    text not null,
  user_id     uuid references public.users (id) on delete cascade,
  payload     jsonb,                      -- dados do cadastro até o código ser usado
  code_hash   bytea not null,
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists otp_auth_idx on public.otp_codes (auth_uid, created_at desc);
create index if not exists otp_tel_idx on public.otp_codes (telefone, created_at);
create index if not exists otp_ip_idx on public.otp_codes (ip, created_at);
create index if not exists otp_user_idx on public.otp_codes (user_id);

create table if not exists public.roles (
  id          text primary key check (id ~ '^[a-z0-9]{6,16}$'),
  nome        text not null check (char_length(nome) between 1 and 60),
  data        date not null,
  hora        text not null check (hora ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  cena        text not null check (cena ~ '^[a-z]{3,20}$'),
  noite       boolean not null default true,
  owner_id    uuid not null references public.users (id),
  max_pessoas int not null default 8 check (max_pessoas between 2 and 200),
  privacidade text not null default 'link' check (privacidade in ('link', 'fechado')),
  status      text not null default 'ativo' check (status in ('ativo', 'encerrado', 'arquivado')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists roles_owner_idx on public.roles (owner_id);
create index if not exists roles_status_idx on public.roles (status, created_at);

create table if not exists public.role_members (
  role_id    text not null references public.roles (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  papel      text not null check (papel in ('dono', 'convidado')),
  created_at timestamptz not null default now(),
  banned_at  timestamptz,
  primary key (role_id, user_id)
);
create index if not exists role_members_user_idx on public.role_members (user_id);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  role_id    text not null references public.roles (id) on delete cascade,
  user_id    uuid not null references public.users (id),
  texto      text not null check (char_length(texto) between 1 and 280),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid                          -- quem apagou (admin); a chave estrangeira vem com o painel admin
);
create index if not exists chat_role_idx on public.chat_messages (role_id, id desc);
create index if not exists chat_user_idx on public.chat_messages (user_id);

create table if not exists public.reports (
  id             bigint generated always as identity primary key,
  reporter_id    uuid not null references public.users (id),
  target_user_id uuid references public.users (id),
  message_id     bigint references public.chat_messages (id) on delete set null,
  role_id        text references public.roles (id) on delete set null,
  motivo         text not null check (char_length(motivo) between 1 and 280),
  status         text not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  check (target_user_id is not null or message_id is not null)
);
create index if not exists reports_status_idx on public.reports (status, created_at);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_target_idx on public.reports (target_user_id);
create index if not exists reports_message_idx on public.reports (message_id);
create index if not exists reports_role_idx on public.reports (role_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists users_updated on public.users;
create trigger users_updated before update on public.users for each row execute function public.set_updated_at();
drop trigger if exists roles_updated on public.roles;
create trigger roles_updated before update on public.roles for each row execute function public.set_updated_at();

/* ============================================================ auxiliares */

-- usuário logado neste navegador (nulo se não há sessão válida ou a conta não está ativa)
create or replace function public.me() returns uuid language sql stable security definer set search_path = public as $$
  select s.user_id from public.sessions s join public.users u on u.id = s.user_id
  where s.auth_uid = auth.uid() and s.expires_at > now() and u.status = 'ativo'
$$;

create or replace function public.is_member(p_role text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_members m
    where m.role_id = p_role and m.user_id = public.me() and m.banned_at is null)
$$;

create or replace function public.compartilha_sala(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_members a join public.role_members b on b.role_id = a.role_id
    where a.user_id = public.me() and a.banned_at is null and b.user_id = p_user)
$$;

create or replace function public.req_header(h text) returns text language sql stable as $$
  select (coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json) ->> h
$$;

create or replace function public.req_ip() returns text language sql stable as $$
  select coalesce(public.req_header('cf-connecting-ip'), nullif(btrim(split_part(coalesce(public.req_header('x-forwarded-for'), ''), ',', 1)), ''), '')
$$;

create or replace function public.ms(t timestamptz) returns bigint language sql immutable as $$
  select (extract(epoch from t) * 1000)::bigint
$$;

create or replace function public.conta_json(u public.users) returns jsonb language sql stable as $$
  select jsonb_build_object('nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'tel', u.telefone,
    'verificado', true, 'fig', u.fig, 'criado', public.ms(u.created_at))
$$;

/* ============================================================ login */

-- Passo 1: pede o código. Cadastro: p_conta = {nome, usuario, email, tel}. Login: p_q = e-mail ou celular.
-- Erros: auth, invalid, exists, taken, notfound, suspended, slow.
-- Para SMS de verdade: envie v_code por aqui (Edge Function/webhook) e ponha sms_dev = 0 em app_config.
create or replace function public.auth_start(p_tipo text, p_conta jsonb default null, p_q text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ip text := public.req_ip();
  v_dev boolean := coalesce((select value from public.app_config where key = 'sms_dev'), '0') = '1';
  v_cap int := coalesce((select value::int from public.app_config where key = 'sms_cap_dia'), 500);
  v_por_hora int;
  v_nome text; v_usuario text; v_email text; v_tel text;
  v_user public.users;
  v_payload jsonb;
  v_id uuid := gen_random_uuid();
  v_code text;
begin
  if v_uid is null then raise exception 'auth'; end if;

  if p_tipo = 'cadastro' then
    v_nome := btrim(coalesce(p_conta ->> 'nome', ''));
    v_usuario := coalesce(p_conta ->> 'usuario', '');
    v_email := lower(btrim(coalesce(p_conta ->> 'email', '')));
    v_tel := coalesce(p_conta ->> 'tel', '');
    if char_length(v_nome) not between 2 and 40 or v_usuario !~ '^[a-z0-9._]{3,16}$'
       or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 120 or v_tel !~ '^\d{10,11}$' then
      raise exception 'invalid';
    end if;
    if exists (select 1 from public.users where email = v_email or telefone = v_tel) then raise exception 'exists'; end if;
    if exists (select 1 from public.users where usuario = v_usuario) then raise exception 'taken'; end if;
    v_payload := jsonb_build_object('nome', v_nome, 'usuario', v_usuario, 'email', v_email);
  elsif p_tipo = 'login' then
    p_q := lower(btrim(coalesce(p_q, '')));
    select * into v_user from public.users
      where case when position('@' in p_q) > 0 then email = p_q else telefone = regexp_replace(p_q, '\D', '', 'g') end
        and status <> 'excluido' limit 1;
    if not found then raise exception 'notfound'; end if;
    if v_user.status <> 'ativo' then raise exception 'suspended'; end if;
    v_tel := v_user.telefone;
  else
    raise exception 'invalid';
  end if;

  -- limites: por celular (3/hora, 10/dia), por IP (10/hora) e teto global do dia. Em modo de teste, mais folga.
  v_por_hora := case when v_dev then 30 else 3 end;
  if (select count(*) from public.otp_codes where telefone = v_tel and created_at > now() - interval '1 hour') >= v_por_hora
     or (select count(*) from public.otp_codes where telefone = v_tel and created_at > now() - interval '1 day') >= v_por_hora * 3
     or (v_ip <> '' and (select count(*) from public.otp_codes where ip = v_ip and created_at > now() - interval '1 hour') >= v_por_hora * 3)
     or (select count(*) from public.otp_codes where created_at > date_trunc('day', now())) >= v_cap then
    raise exception 'slow';
  end if;

  -- 4 dígitos por enquanto; a fase de SMS real passa para 6 junto com o campo da tela
  v_code := lpad((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 10000)::text, 4, '0');

  update public.otp_codes set consumed_at = now() where auth_uid = v_uid and consumed_at is null;
  insert into public.otp_codes (id, auth_uid, purpose, telefone, user_id, payload, code_hash, expires_at, ip)
  values (v_id, v_uid, p_tipo, v_tel, v_user.id, v_payload,
          sha256(convert_to(v_code || ':' || v_id::text, 'UTF8')), now() + interval '10 minutes', nullif(v_ip, ''));

  return jsonb_build_object(
    'tel', case when p_tipo = 'login' then left(v_tel, 2) || '•••••' || right(v_tel, 4) else v_tel end,
    'dev', case when v_dev then v_code end);
end $$;

-- Passo 2: confere o código. Devolve {uid, conta} ou {err}. (Não levanta erro: a tentativa errada precisa ficar gravada.)
-- err: expired, badcode, exists, taken, suspended.
create or replace function public.auth_verify(p_code text, p_fig text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  o public.otp_codes;
  v_user public.users;
  v_ok boolean;
begin
  if v_uid is null then raise exception 'auth'; end if;

  select * into o from public.otp_codes
    where auth_uid = v_uid and consumed_at is null order by created_at desc limit 1 for update;
  if not found or o.expires_at < now() or o.attempts >= 5 then
    if found then update public.otp_codes set consumed_at = now(), payload = null where id = o.id; end if;
    return jsonb_build_object('err', 'expired');
  end if;

  v_ok := o.code_hash = sha256(convert_to(coalesce(p_code, '') || ':' || o.id::text, 'UTF8'));
  if not v_ok then
    update public.otp_codes set attempts = attempts + 1,
      consumed_at = case when attempts + 1 >= 5 then now() end where id = o.id;
    return jsonb_build_object('err', 'badcode');
  end if;

  update public.otp_codes set consumed_at = now(), payload = null where id = o.id;

  if o.purpose = 'cadastro' then
    if exists (select 1 from public.users where email = o.payload ->> 'email' or telefone = o.telefone) then
      return jsonb_build_object('err', 'exists');
    end if;
    if exists (select 1 from public.users where usuario = o.payload ->> 'usuario') then
      return jsonb_build_object('err', 'taken');
    end if;
    insert into public.users (nome, usuario, email, telefone, fig)
    values (o.payload ->> 'nome', o.payload ->> 'usuario', o.payload ->> 'email', o.telefone,
            case when char_length(coalesce(p_fig, '')) <= 600 then coalesce(p_fig, '') else '' end)
    returning * into v_user;
  else
    select * into v_user from public.users where id = o.user_id;
    if not found or v_user.status <> 'ativo' then return jsonb_build_object('err', 'suspended'); end if;
  end if;

  insert into public.sessions (auth_uid, user_id, user_agent, ip)
  values (v_uid, v_user.id, left(public.req_header('user-agent'), 300), nullif(public.req_ip(), ''))
  on conflict (auth_uid) do update set user_id = excluded.user_id, created_at = now(), last_seen_at = now(),
    expires_at = now() + interval '60 days', user_agent = excluded.user_agent, ip = excluded.ip;

  return jsonb_build_object('uid', v_user.id, 'conta', public.conta_json(v_user));
end $$;

-- Ao abrir o app: este navegador já está logado? Renova a sessão. Devolve {uid, conta} ou nulo.
create or replace function public.hello() returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user public.users;
begin
  update public.sessions set last_seen_at = now(), expires_at = now() + interval '60 days'
    where auth_uid = auth.uid() and expires_at > now();
  select u.* into v_user from public.users u where u.id = public.me();
  if not found then return null; end if;
  return jsonb_build_object('uid', v_user.id, 'conta', public.conta_json(v_user));
end $$;

create or replace function public.logout() returns void language sql security definer set search_path = public as $$
  delete from public.sessions where auth_uid = auth.uid()
$$;

-- "Sair de todos os aparelhos"
create or replace function public.logout_all() returns void language sql security definer set search_path = public as $$
  delete from public.sessions where user_id = public.me()
$$;

create or replace function public.minha_conta() returns jsonb language sql stable security definer set search_path = public as $$
  select public.conta_json(u) from public.users u where u.id = public.me()
$$;

create or replace function public.salvar_fig(p_fig text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.me() is null then raise exception 'auth'; end if;
  if char_length(coalesce(p_fig, '')) > 600 then raise exception 'invalid'; end if;
  update public.users set fig = p_fig where id = public.me();
end $$;

/* ============================================================ rolês */

-- a sala está no ar: ativa e criada há menos de sala_horas (8 h)
create or replace function public.role_vivo(p_id text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select r.status = 'ativo'
      and r.created_at > now() - make_interval(hours => coalesce((select value::int from public.app_config where key = 'sala_horas'), 8))
    from public.roles r where r.id = p_id), false)
$$;

-- Prévia do convite: qualquer pessoa com o link vê (mesmo antes de criar conta). Rolê "fechado" só os membros.
create or replace function public.ver_role(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.roles; o public.users;
begin
  select * into r from public.roles where id = p_id;
  if not found then return null; end if;
  if r.privacidade = 'fechado' and not public.is_member(p_id) then return null; end if;
  select * into o from public.users where id = r.owner_id;
  return jsonb_build_object('nome', r.nome, 'data', to_char(r.data, 'YYYY-MM-DD'), 'hora', r.hora, 'cena', r.cena,
    'noite', r.noite, 'dono', o.usuario, 'donoNome', o.nome, 'criado', public.ms(r.created_at),
    'status', case when public.role_vivo(p_id) then r.status else 'encerrado' end, 'max', r.max_pessoas,
    'expira', public.ms(r.created_at + make_interval(hours => coalesce((select value::int from public.app_config where key = 'sala_horas'), 8))));
end $$;

-- Quem já confirmou (links abertos mostram a contagem; fechado só para membros)
create or replace function public.listar_gente(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.roles;
begin
  select * into r from public.roles where id = p_id;
  if not found or (r.privacidade = 'fechado' and not public.is_member(p_id)) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('usuario', u.usuario, 'nome', u.nome, 'papel', m.papel, 'at', public.ms(m.created_at))
                                    order by m.created_at)
                   from public.role_members m join public.users u on u.id = m.user_id
                   where m.role_id = p_id and m.banned_at is null), '[]'::jsonb);
end $$;

-- Erros: auth, invalid, exists, slow
create or replace function public.criar_role(p_id text, p_nome text, p_data text, p_hora text, p_cena text, p_noite boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_nome text := btrim(coalesce(p_nome, ''));
begin
  if v_me is null then raise exception 'auth'; end if;
  if p_id !~ '^[a-z0-9]{6,16}$' or char_length(v_nome) not between 1 and 60 or p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$'
     or p_cena !~ '^[a-z]{3,20}$' or p_data !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid';
  end if;
  if (select count(*) from public.roles where owner_id = v_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'slow';
  end if;
  begin
    insert into public.roles (id, nome, data, hora, cena, noite, owner_id)
    values (p_id, v_nome, p_data::date, p_hora, p_cena, coalesce(p_noite, true), v_me);
  exception
    when unique_violation then raise exception 'exists';
    when invalid_datetime_format or datetime_field_overflow then raise exception 'invalid';
  end;
  insert into public.role_members (role_id, user_id, papel) values (p_id, v_me, 'dono');
end $$;

-- Aceitar o convite. Erros: auth, notfound, closed, banned
create or replace function public.entrar_role(p_id text) returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); r public.roles; m public.role_members;
begin
  if v_me is null then raise exception 'auth'; end if;
  select * into r from public.roles where id = p_id;
  if not found then raise exception 'notfound'; end if;
  if not public.role_vivo(p_id) then raise exception 'closed'; end if;
  select * into m from public.role_members where role_id = p_id and user_id = v_me;
  if found then
    if m.banned_at is not null then raise exception 'banned'; end if;
    return m.papel;
  end if;
  if r.status <> 'ativo' or r.privacidade = 'fechado' then raise exception 'closed'; end if;
  if (select count(*) from public.role_members where role_id = p_id and banned_at is null)
     >= coalesce((select value::int from public.app_config where key = 'sala_max'), 8) then
    raise exception 'cheia';
  end if;
  insert into public.role_members (role_id, user_id, papel) values (p_id, v_me, 'convidado');
  return 'convidado';
end $$;

-- Só o dono muda o cenário e o dia/noite. Erros: auth, perm, invalid
create or replace function public.atualizar_role(p_id text, p_patch jsonb) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me();
begin
  if v_me is null then raise exception 'auth'; end if;
  if not exists (select 1 from public.roles where id = p_id and owner_id = v_me) then raise exception 'perm'; end if;
  if p_patch ? 'cena' and coalesce(p_patch ->> 'cena', '') !~ '^[a-z]{3,20}$' then raise exception 'invalid'; end if;
  if p_patch ? 'noite' and jsonb_typeof(p_patch -> 'noite') <> 'boolean' then raise exception 'invalid'; end if;
  update public.roles set
    cena = coalesce(p_patch ->> 'cena', cena),
    noite = coalesce((p_patch ->> 'noite')::boolean, noite)
  where id = p_id;
end $$;

/* ============================================================ chat */

-- Erros: auth, perm, closed, invalid, slow. Devolve o id da mensagem.
create or replace function public.enviar_mensagem(p_role text, p_texto text) returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_texto text := btrim(coalesce(p_texto, '')); v_id bigint;
begin
  if v_me is null then raise exception 'auth'; end if;
  if not public.is_member(p_role) then raise exception 'perm'; end if;
  if not public.role_vivo(p_role) then raise exception 'closed'; end if;
  if char_length(v_texto) not between 1 and 280 then raise exception 'invalid'; end if;
  if exists (select 1 from public.chat_messages where user_id = v_me and created_at > now() - interval '600 milliseconds') then
    raise exception 'slow';
  end if;
  insert into public.chat_messages (role_id, user_id, texto) values (p_role, v_me, v_texto) returning id into v_id;
  return v_id::text;
end $$;

/* ============================================================ limpeza (agende com pg_cron, se quiser) */

create or replace function public.limpar_antigos() returns void language sql security definer set search_path = public as $$
  delete from public.otp_codes where created_at < now() - interval '2 days';
  delete from public.sessions where expires_at < now();
$$;

/* ============================================================ RLS: leitura */

alter table public.app_config enable row level security;
alter table public.sessions enable row level security;
alter table public.otp_codes enable row level security;
alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.role_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reports enable row level security;

-- app_config, sessions e otp_codes: sem política e sem permissão. Só as funções acima mexem.

drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = (select public.me()) or public.compartilha_sala(id));

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (public.is_member(id));

drop policy if exists members_select on public.role_members;
create policy members_select on public.role_members for select to authenticated
  using (user_id = (select public.me()) or public.is_member(role_id));

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated
  using (deleted_at is null and public.is_member(role_id));

-- denúncia: qualquer pessoa logada pode denunciar; a fila é lida pelo painel admin
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select public.me()) and status = 'aberta');

/* ============================================================ permissões */

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- e-mail e celular não saem pela API (a própria conta volta por minha_conta())
grant select (id, usuario, nome, fig, created_at) on public.users to authenticated;
grant select on public.roles, public.role_members to authenticated;
grant select (id, role_id, user_id, texto, created_at, deleted_at) on public.chat_messages to authenticated;
grant insert (reporter_id, target_user_id, message_id, role_id, motivo) on public.reports to authenticated;

-- usadas pelas políticas
grant execute on function public.me(), public.is_member(text), public.compartilha_sala(uuid) to authenticated;
-- chamadas pelo app
grant execute on function
  public.auth_start(text, jsonb, text), public.auth_verify(text, text), public.hello(), public.logout(), public.logout_all(),
  public.minha_conta(), public.salvar_fig(text), public.ver_role(text), public.listar_gente(text),
  public.criar_role(text, text, text, text, text, boolean), public.entrar_role(text),
  public.atualizar_role(text, jsonb), public.enviar_mensagem(text, text)
  to authenticated;

/* ============================================================ tempo real */

do $$
declare t text;
begin
  foreach t in array array['roles', 'chat_messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

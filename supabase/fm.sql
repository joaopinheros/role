-- Rolê FM: música do YouTube sincronizada nas salas. Rode DEPOIS do schema.sql (Supabase > SQL Editor > Run).
-- Pode rodar de novo sem estragar nada.
--
-- Como funciona:
--   * Ninguém toca áudio pelo servidor: cada pessoa toca o vídeo no próprio aparelho (player oficial do YouTube).
--     O banco só guarda o que está tocando, desde quando (relógio do banco) e a fila.
--   * Ninguém escreve direto nas tabelas. Pôr música passa pela Edge Function music-resolve (que confere o vídeo no
--     YouTube e chama fm_add com a chave de serviço); o resto passa pelas funções fm_* abaixo, que conferem o papel.
--   * Os aparelhos escutam só room_now_playing (filtrado pela sala). Toda mudança, inclusive na fila, mexe nessa linha.
--   * O avanço da fila usa "compare-and-swap" na coluna version: dois pedidos juntos, só um vale.
--   * Os limites ficam em app_config (fm_*), dá para mudar sem mexer no código.

/* ============================================================ configuração */

insert into public.app_config (key, value) values
  ('fm_max_dur_s', '900'),   -- vídeo de até 15 min
  ('fm_max_fila', '30'),     -- itens na fila
  ('fm_por_pessoa', '3'),    -- músicas esperando por pessoa (dono e DJs sem limite)
  ('fm_por_minuto', '5'),    -- /music por minuto por pessoa
  ('fm_busca_hora', '10'),   -- buscas por nome no YouTube por pessoa por hora (as do cache não contam)
  ('fm_cota_dia', '10000'),  -- cota diária da YouTube Data API (unidades)
  ('fm_cota_aviso', '90'),   -- % da cota em que a busca por nome pausa (só links valem)
  ('fm_cache_dias', '30')    -- validade do cache de buscas
on conflict (key) do nothing;

create or replace function public.fm_cfg(k text, d int) returns int language sql stable security definer set search_path = public as $$
  select coalesce((select value::int from public.app_config where key = k), d)
$$;

/* ============================================================ tabelas */

alter table public.roles add column if not exists quem_adiciona text not null default 'todos';
alter table public.chat_messages add column if not exists tipo text not null default 'texto';
alter table public.chat_messages add column if not exists dados jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'roles_quem_adiciona_check') then
    alter table public.roles add constraint roles_quem_adiciona_check check (quem_adiciona in ('todos', 'djs'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_tipo_check') then
    alter table public.chat_messages add constraint chat_messages_tipo_check check (tipo in ('texto', 'bot'));
  end if;
end $$;

-- o dono é DJ sem precisar estar aqui
create table if not exists public.room_djs (
  role_id    text not null references public.roles (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  added_by   uuid references public.users (id),
  created_at timestamptz not null default now(),
  primary key (role_id, user_id)
);

create table if not exists public.room_queue (
  id         bigint generated always as identity primary key,
  role_id    text not null references public.roles (id) on delete cascade,
  video_id   text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title      text not null check (char_length(title) between 1 and 200),
  thumb_url  text not null check (thumb_url ~ '^https://i\.ytimg\.com/'),
  duration_s int check (duration_s between 0 and 86400),
  added_by   uuid not null references public.users (id) on delete cascade,
  position   int not null,
  created_at timestamptz not null default now()
);
create index if not exists room_queue_role_idx on public.room_queue (role_id, position);
create index if not exists room_queue_user_idx on public.room_queue (role_id, added_by);

create table if not exists public.room_now_playing (
  role_id       text primary key references public.roles (id) on delete cascade,
  queue_id      bigint,
  video_id      text,
  title         text,
  thumb_url     text,
  duration_s    int,
  added_by      uuid references public.users (id) on delete set null,
  started_at    timestamptz,               -- relógio do banco; na pausa, é empurrado para a frente ao voltar
  paused_at     timestamptz,
  status        text not null default 'parado' check (status in ('tocando', 'pausado', 'parado')),
  version       int not null default 0,    -- muda a cada troca, pausa ou volta (compare-and-swap)
  queue_version int not null default 0,    -- muda a cada mudança na fila ou nos DJs
  updated_at    timestamptz not null default now()
);

-- /music por minuto (limpo pela limpar_antigos)
create table if not exists public.fm_hits (
  user_id    uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists fm_hits_idx on public.fm_hits (user_id, created_at);

-- busca por nome: cache (30 dias), contador da cota do dia (dia do fuso do Pacífico, que é quando o Google zera),
-- buscas por pessoa e trava de uma busca por vez na sala
create table if not exists public.music_search_cache (
  query_normalizada text primary key,
  resultados        jsonb not null,
  created_at        timestamptz not null default now()
);
create table if not exists public.fm_quota (dia date primary key, usado int not null default 0);
create table if not exists public.fm_search_hits (user_id uuid not null, created_at timestamptz not null default now());
create index if not exists fm_search_hits_idx on public.fm_search_hits (user_id, created_at);
create table if not exists public.fm_search_lock (role_id text primary key, ate timestamptz not null);

/* ============================================================ auxiliares (fora da API) */

-- papel na sala: 'dono' | 'dj' | 'membro' (ou nulo se não é da sala)
create or replace function public.fm_papel(p_role text, p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select case when r.owner_id = p_user then 'dono'
              when exists (select 1 from public.room_djs d where d.role_id = p_role and d.user_id = p_user) then 'dj'
              else 'membro' end
  from public.roles r
  join public.role_members m on m.role_id = r.id and m.user_id = p_user and m.banned_at is null
  where r.id = p_role
$$;

-- confere sala e papel; devolve o papel. Erros: auth, perm, privada, closed
create or replace function public.fm_check(p_role text, p_user uuid, p_chefe boolean default false) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_papel text; r public.roles;
begin
  if p_user is null then raise exception 'auth'; end if;
  select * into r from public.roles where id = p_role;
  if not found then raise exception 'perm'; end if;
  v_papel := public.fm_papel(p_role, p_user);
  if v_papel is null then raise exception 'perm'; end if;
  if r.privacidade not in ('link', 'fechado') then raise exception 'privada'; end if;   -- o Rolê FM é só para salas privadas
  if r.status <> 'ativo' then raise exception 'closed'; end if;
  if p_chefe and v_papel not in ('dono', 'dj') then raise exception 'perm'; end if;
  return v_papel;
end $$;

create or replace function public.fm_bot(p_role text, p_user uuid, p_texto text, p_dados jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.chat_messages (role_id, user_id, texto, tipo, dados) values (p_role, p_user, left(p_texto, 280), 'bot', p_dados)
$$;

create or replace function public.fm_nome(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select usuario from public.users where id = p_user
$$;

-- garante a linha da sala e avisa os aparelhos de que a fila mudou
create or replace function public.fm_touch(p_role text) returns void language sql security definer set search_path = public as $$
  insert into public.room_now_playing (role_id) values (p_role) on conflict (role_id) do nothing;
  update public.room_now_playing set queue_version = queue_version + 1, updated_at = now() where role_id = p_role;
$$;

-- toca a próxima da fila (ou para tudo, se acabou). Quem chama já travou a linha e conferiu a versão.
create or replace function public.fm_next(p_role text, p_user uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare q public.room_queue;
begin
  select * into q from public.room_queue where role_id = p_role order by position limit 1;
  if found then
    delete from public.room_queue where id = q.id;
    update public.room_now_playing set queue_id = q.id, video_id = q.video_id, title = q.title, thumb_url = q.thumb_url,
      duration_s = q.duration_s, added_by = q.added_by, started_at = now(), paused_at = null, status = 'tocando',
      version = version + 1, queue_version = queue_version + 1, updated_at = now()
    where role_id = p_role;
    perform public.fm_bot(p_role, p_user, 'Tocando agora: ' || q.title, jsonb_build_object('k', 'agora', 'video', q.video_id, 'title', q.title));
    return true;
  end if;
  if exists (select 1 from public.room_now_playing where role_id = p_role and status <> 'parado') then
    update public.room_now_playing set queue_id = null, video_id = null, title = null, thumb_url = null, duration_s = null, added_by = null,
      started_at = null, paused_at = null, status = 'parado', version = version + 1, queue_version = queue_version + 1, updated_at = now()
    where role_id = p_role;
    perform public.fm_bot(p_role, p_user, 'Fila vazia. O som da sala voltou.', jsonb_build_object('k', 'vazia'));
  end if;
  return false;
end $$;

/* ============================================================ chamadas do app */

-- relógio do banco (para o aparelho acertar a diferença)
create or replace function public.fm_now() returns bigint language sql volatile security definer set search_path = public as $$
  select public.ms(clock_timestamp())
$$;

-- tudo o que a tela precisa, numa chamada só
create or replace function public.fm_estado(p_role text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := public.me(); v_papel text; r public.roles; np public.room_now_playing;
begin
  if v_me is null then raise exception 'auth'; end if;
  v_papel := public.fm_papel(p_role, v_me);
  if v_papel is null then raise exception 'perm'; end if;
  select * into r from public.roles where id = p_role;
  select * into np from public.room_now_playing where role_id = p_role;
  return jsonb_build_object(
    'papel', v_papel, 'quem', r.quem_adiciona, 'priv', r.privacidade, 'eu', public.fm_nome(v_me), 'now', public.ms(clock_timestamp()),
    'np', jsonb_build_object('status', coalesce(np.status, 'parado'), 'video', np.video_id, 'title', np.title, 'thumb', np.thumb_url,
      'dur', np.duration_s, 'started', public.ms(np.started_at), 'paused', public.ms(np.paused_at), 'version', coalesce(np.version, 0),
      'qv', coalesce(np.queue_version, 0), 'by', public.fm_nome(np.added_by)),
    'queue', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'video', q.video_id, 'title', q.title, 'thumb', q.thumb_url,
      'dur', q.duration_s, 'by', u.usuario) order by q.position) from public.room_queue q join public.users u on u.id = q.added_by
      where q.role_id = p_role), '[]'::jsonb),
    'djs', coalesce((select jsonb_agg(u.usuario order by u.usuario) from public.room_djs d join public.users u on u.id = d.user_id
      where d.role_id = p_role), '[]'::jsonb));
end $$;

drop function if exists public.fm_add(uuid, text, text, text, text, int);   -- a versão antiga, sem p_extra
-- pôr na fila (só a Edge Function chama, com o vídeo já conferido no YouTube; p_auth = quem pediu)
-- Erros: auth, perm, privada, closed, djs (só DJs põem música), fila_cheia, limite (3 por pessoa), rapido, longo, invalid
-- p_extra: vai junto na mensagem do bot (busca por nome: q e alts, as alternativas de "Não era essa?")
create or replace function public.fm_add(p_auth uuid, p_role text, p_video text, p_title text, p_thumb text, p_dur int, p_extra jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_papel text; v_quem text; v_pos int; np public.room_now_playing; v_tocou boolean := false; v_qid bigint;
begin
  select s.user_id into v_me from public.sessions s join public.users u on u.id = s.user_id
    where s.auth_uid = p_auth and s.expires_at > now() and u.status = 'ativo';
  v_papel := public.fm_check(p_role, v_me);
  select quem_adiciona into v_quem from public.roles where id = p_role;
  if v_quem = 'djs' and v_papel not in ('dono', 'dj') then raise exception 'djs'; end if;
  if p_video !~ '^[A-Za-z0-9_-]{11}$' or char_length(coalesce(p_title, '')) not between 1 and 200 then raise exception 'invalid'; end if;
  if p_dur is not null and p_dur > public.fm_cfg('fm_max_dur_s', 900) then raise exception 'longo'; end if;
  if (select count(*) from public.fm_hits where user_id = v_me and created_at > now() - interval '1 minute') >= public.fm_cfg('fm_por_minuto', 5) then
    raise exception 'rapido';
  end if;
  insert into public.fm_hits (user_id) values (v_me);
  insert into public.room_now_playing (role_id) values (p_role) on conflict (role_id) do nothing;
  select * into np from public.room_now_playing where role_id = p_role for update;   -- uma coisa por vez nesta sala
  if (select count(*) from public.room_queue where role_id = p_role) >= public.fm_cfg('fm_max_fila', 30) then raise exception 'fila_cheia'; end if;
  if v_papel = 'membro' and (select count(*) from public.room_queue where role_id = p_role and added_by = v_me) >= public.fm_cfg('fm_por_pessoa', 3) then
    raise exception 'limite';
  end if;
  select coalesce(max(position), 0) + 1 into v_pos from public.room_queue where role_id = p_role;
  insert into public.room_queue (role_id, video_id, title, thumb_url, duration_s, added_by, position)
    values (p_role, p_video, left(p_title, 200), coalesce(p_thumb, 'https://i.ytimg.com/vi/' || p_video || '/hqdefault.jpg'), p_dur, v_me, v_pos)
    returning id into v_qid;
  perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' colocou: ' || p_title,
    jsonb_build_object('k', 'colocou', 'video', p_video, 'title', p_title, 'u', public.fm_nome(v_me), 'qid', v_qid) || coalesce(p_extra, '{}'::jsonb));
  if np.status = 'parado' then v_tocou := public.fm_next(p_role, v_me);
  else perform public.fm_touch(p_role); end if;
  return jsonb_build_object('ok', true, 'tocando', v_tocou,
    'pos', (select count(*) from public.room_queue where role_id = p_role), 'title', p_title);
end $$;

-- busca por nome, passo 1 (só a Edge Function chama): confere a sala e devolve { cache } se a busca já está no cache.
-- Sem cache: trava a sala (uma busca por vez), confere as buscas da pessoa na hora e a cota do dia; senão levanta
-- ocupado, buscas ou cota. Também: auth, perm, privada, closed, djs, invalid
create or replace function public.fm_search_begin(p_auth uuid, p_role text, p_q text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid; v_papel text; v_quem text; r jsonb;
begin
  select s.user_id into v_me from public.sessions s join public.users u on u.id = s.user_id
    where s.auth_uid = p_auth and s.expires_at > now() and u.status = 'ativo';
  v_papel := public.fm_check(p_role, v_me);
  select quem_adiciona into v_quem from public.roles where id = p_role;
  if v_quem = 'djs' and v_papel not in ('dono', 'dj') then raise exception 'djs'; end if;
  if char_length(coalesce(p_q, '')) not between 2 and 100 then raise exception 'invalid'; end if;
  select resultados into r from public.music_search_cache
    where query_normalizada = p_q and created_at > now() - make_interval(days => public.fm_cfg('fm_cache_dias', 30));
  if found then return jsonb_build_object('cache', r); end if;
  insert into public.fm_search_lock (role_id, ate) values (p_role, now() + interval '20 seconds')
    on conflict (role_id) do update set ate = excluded.ate where public.fm_search_lock.ate < now();
  if not found then raise exception 'ocupado'; end if;
  if (select count(*) from public.fm_search_hits where user_id = v_me and created_at > now() - interval '1 hour') >= public.fm_cfg('fm_busca_hora', 10) then
    raise exception 'buscas';
  end if;
  if coalesce((select usado from public.fm_quota where dia = (now() at time zone 'America/Los_Angeles')::date), 0) * 100
     >= public.fm_cfg('fm_cota_dia', 10000) * public.fm_cfg('fm_cota_aviso', 90) then
    raise exception 'cota';
  end if;
  insert into public.fm_search_hits (user_id) values (v_me);
  return jsonb_build_object('cache', null);
end $$;

-- passo 2: guarda o resultado no cache (se veio), soma as unidades gastas na cota e solta a sala
create or replace function public.fm_search_save(p_role text, p_q text, p_res jsonb, p_units int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_res is not null then
    insert into public.music_search_cache (query_normalizada, resultados, created_at) values (p_q, p_res, now())
      on conflict (query_normalizada) do update set resultados = excluded.resultados, created_at = now();
  end if;
  if coalesce(p_units, 0) > 0 then
    insert into public.fm_quota (dia, usado) values ((now() at time zone 'America/Los_Angeles')::date, p_units)
      on conflict (dia) do update set usado = public.fm_quota.usado + excluded.usado;
  end if;
  delete from public.fm_search_lock where role_id = p_role;
end $$;

-- "Não era essa?": troca a música recém-pedida (na fila ou já tocando) pela alternativa p_idx. Só quem pediu, em até 60 s.
create or replace function public.fm_trocar(p_role text, p_msg bigint, p_idx int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); m public.chat_messages; alt jsonb; np public.room_now_playing; v_qid bigint; v_thumb text;
begin
  perform public.fm_check(p_role, v_me);
  select * into m from public.chat_messages where id = p_msg and role_id = p_role and tipo = 'bot' and dados->>'k' = 'colocou';
  if not found then raise exception 'invalid'; end if;
  if m.dados->>'u' <> public.fm_nome(v_me) then raise exception 'perm'; end if;
  if m.created_at < now() - interval '60 seconds' or m.dados ? 'trocou' then raise exception 'tarde'; end if;
  alt := (m.dados->'alts') -> coalesce(p_idx, -1);
  if alt is null then raise exception 'invalid'; end if;
  v_qid := (m.dados->>'qid')::bigint;
  v_thumb := 'https://i.ytimg.com/vi/' || (alt->>'video') || '/hqdefault.jpg';
  select * into np from public.room_now_playing where role_id = p_role for update;
  if exists (select 1 from public.room_queue where id = v_qid and role_id = p_role) then
    update public.room_queue set video_id = alt->>'video', title = left(alt->>'title', 200), thumb_url = v_thumb, duration_s = (alt->>'dur')::int
      where id = v_qid;
    perform public.fm_touch(p_role);
  elsif np.queue_id = v_qid and np.status <> 'parado' then
    update public.room_now_playing set video_id = alt->>'video', title = left(alt->>'title', 200), thumb_url = v_thumb, duration_s = (alt->>'dur')::int,
      started_at = now(), paused_at = null, status = 'tocando', version = version + 1, queue_version = queue_version + 1, updated_at = now()
      where role_id = p_role;
  else raise exception 'tarde'; end if;
  update public.chat_messages set dados = dados || jsonb_build_object('trocou', p_idx) where id = p_msg;
  perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' trocou por: ' || (alt->>'title'),
    jsonb_build_object('k', 'trocou', 'video', alt->>'video', 'title', alt->>'title', 'u', public.fm_nome(v_me)));
  return jsonb_build_object('ok', true, 'title', alt->>'title');
end $$;

-- próxima música. p_skip = pulo (só dono e DJ); sem p_skip, só vale se a música já acabou mesmo.
-- Devolve { ok, version }: ok=false quando outro aparelho já avançou (a versão não bate).
create or replace function public.fm_advance(p_role text, p_version int, p_skip boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_papel text; np public.room_now_playing;
begin
  v_papel := public.fm_check(p_role, v_me, p_skip);
  select * into np from public.room_now_playing where role_id = p_role for update;
  if not found or np.version <> p_version or np.status = 'parado' then
    return jsonb_build_object('ok', false, 'version', coalesce(np.version, 0));
  end if;
  if not p_skip then
    if np.status <> 'tocando' then return jsonb_build_object('ok', false, 'version', np.version); end if;
    if now() < np.started_at + make_interval(secs => coalesce(np.duration_s, public.fm_cfg('fm_max_dur_s', 900)) - 3)
       and not (np.duration_s is null and v_papel in ('dono', 'dj')) then
      raise exception 'cedo';
    end if;
  else
    perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' pulou a música', jsonb_build_object('k', 'pulou', 'u', public.fm_nome(v_me)));
  end if;
  perform public.fm_next(p_role, v_me);
  return jsonb_build_object('ok', true, 'version', (select version from public.room_now_playing where role_id = p_role));
end $$;

create or replace function public.fm_pause(p_role text) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me();
begin
  perform public.fm_check(p_role, v_me, true);
  update public.room_now_playing set status = 'pausado', paused_at = now(), version = version + 1, updated_at = now()
    where role_id = p_role and status = 'tocando';
  if found then perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' pausou a música', jsonb_build_object('k', 'pausou')); end if;
end $$;

create or replace function public.fm_play(p_role text) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me();
begin
  perform public.fm_check(p_role, v_me, true);
  update public.room_now_playing set status = 'tocando', started_at = started_at + (now() - paused_at), paused_at = null,
    version = version + 1, updated_at = now()
    where role_id = p_role and status = 'pausado';
  if found then perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' soltou a música de novo', jsonb_build_object('k', 'voltou')); end if;
end $$;

create or replace function public.fm_limpar(p_role text) returns int language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); n int;
begin
  perform public.fm_check(p_role, v_me, true);
  delete from public.room_queue where role_id = p_role;
  get diagnostics n = row_count;
  perform public.fm_touch(p_role);
  if n > 0 then perform public.fm_bot(p_role, v_me, '@' || public.fm_nome(v_me) || ' limpou a fila', jsonb_build_object('k', 'limpou')); end if;
  return n;
end $$;

-- p_pos = 0: tira a última que eu coloquei; p_pos >= 1: tira a dessa posição (só dono e DJ, ou se for minha)
create or replace function public.fm_tirar(p_role text, p_pos int default 0) returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_papel text; q public.room_queue;
begin
  v_papel := public.fm_check(p_role, v_me);
  if coalesce(p_pos, 0) <= 0 then
    select * into q from public.room_queue where role_id = p_role and added_by = v_me order by position desc limit 1;
  else
    select * into q from public.room_queue where role_id = p_role order by position offset p_pos - 1 limit 1;
    if found and q.added_by <> v_me and v_papel not in ('dono', 'dj') then raise exception 'perm'; end if;
  end if;
  if not found then raise exception 'vazio'; end if;
  delete from public.room_queue where id = q.id;
  perform public.fm_touch(p_role);
  return q.title;
end $$;

create or replace function public.fm_dj(p_role text, p_usuario text, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_alvo uuid;
begin
  if public.fm_check(p_role, v_me) <> 'dono' then raise exception 'perm'; end if;
  select u.id into v_alvo from public.users u join public.role_members m on m.user_id = u.id and m.role_id = p_role and m.banned_at is null
    where u.usuario = lower(p_usuario);
  if v_alvo is null then raise exception 'ninguem'; end if;
  if v_alvo = v_me then raise exception 'dono'; end if;
  if p_on then
    insert into public.room_djs (role_id, user_id, added_by) values (p_role, v_alvo, v_me) on conflict do nothing;
    if found then perform public.fm_bot(p_role, v_me, '@' || lower(p_usuario) || ' agora é DJ', jsonb_build_object('k', 'dj', 'u', lower(p_usuario))); end if;
  else
    delete from public.room_djs where role_id = p_role and user_id = v_alvo;
    if found then perform public.fm_bot(p_role, v_me, '@' || lower(p_usuario) || ' não é mais DJ', jsonb_build_object('k', 'undj', 'u', lower(p_usuario))); end if;
  end if;
  perform public.fm_touch(p_role);
end $$;

-- sem chave do YouTube a duração vem vazia: o primeiro DJ que carregar o player informa uma vez
create or replace function public.fm_duracao(p_role text, p_version int, p_dur int) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.fm_check(p_role, public.me(), true);
  update public.room_now_playing set duration_s = least(greatest(p_dur, 1), 86400), updated_at = now()
    where role_id = p_role and version = p_version and duration_s is null;
end $$;

-- quem pode pôr música: 'todos' ou 'djs' (só o dono muda)
create or replace function public.fm_quem(p_role text, p_quem text) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.fm_check(p_role, public.me()) <> 'dono' then raise exception 'perm'; end if;
  if p_quem not in ('todos', 'djs') then raise exception 'invalid'; end if;
  update public.roles set quem_adiciona = p_quem where id = p_role;
  perform public.fm_touch(p_role);
end $$;

-- mensagem do bot com o id de quem causou não deve contar no "uma mensagem a cada 600 ms" do chat
create or replace function public.enviar_mensagem(p_role text, p_texto text) returns text language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.me(); v_texto text := btrim(coalesce(p_texto, '')); v_id bigint;
begin
  if v_me is null then raise exception 'auth'; end if;
  if not public.is_member(p_role) then raise exception 'perm'; end if;
  if (select status from public.roles where id = p_role) <> 'ativo' then raise exception 'closed'; end if;
  if char_length(v_texto) not between 1 and 280 then raise exception 'invalid'; end if;
  if exists (select 1 from public.chat_messages where user_id = v_me and tipo = 'texto' and created_at > now() - interval '600 milliseconds') then
    raise exception 'slow';
  end if;
  insert into public.chat_messages (role_id, user_id, texto) values (p_role, v_me, v_texto) returning id into v_id;
  return v_id::text;
end $$;

create or replace function public.limpar_antigos() returns void language sql security definer set search_path = public as $$
  delete from public.otp_codes where created_at < now() - interval '2 days';
  delete from public.sessions where expires_at < now();
  delete from public.fm_hits where created_at < now() - interval '1 hour';
$$;

/* ============================================================ RLS e permissões */

alter table public.room_djs enable row level security;
alter table public.room_queue enable row level security;
alter table public.room_now_playing enable row level security;
alter table public.fm_hits enable row level security;
alter table public.music_search_cache enable row level security;
alter table public.fm_quota enable row level security;
alter table public.fm_search_hits enable row level security;
alter table public.fm_search_lock enable row level security;

drop policy if exists fm_djs_select on public.room_djs;
create policy fm_djs_select on public.room_djs for select to authenticated using (public.is_member(role_id));
drop policy if exists fm_queue_select on public.room_queue;
create policy fm_queue_select on public.room_queue for select to authenticated using (public.is_member(role_id));
drop policy if exists fm_np_select on public.room_now_playing;
create policy fm_np_select on public.room_now_playing for select to authenticated using (public.is_member(role_id));
-- fm_hits: sem política e sem permissão

revoke all on public.room_djs, public.room_queue, public.room_now_playing, public.fm_hits, public.music_search_cache, public.fm_quota,
  public.fm_search_hits, public.fm_search_lock from anon, authenticated;
grant select on public.room_djs, public.room_queue, public.room_now_playing to authenticated;
grant select (tipo, dados) on public.chat_messages to authenticated;

-- toda função nova nasce executável por todo mundo: fecha as do FM e abre só as que o app chama
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'fm\_%' or p.proname in ('enviar_mensagem', 'limpar_antigos')) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function
  public.fm_now(), public.fm_estado(text), public.fm_advance(text, int, boolean), public.fm_pause(text), public.fm_play(text),
  public.fm_limpar(text), public.fm_tirar(text, int), public.fm_dj(text, text, boolean), public.fm_duracao(text, int, int),
  public.fm_quem(text, text), public.fm_trocar(text, bigint, int), public.enviar_mensagem(text, text)
  to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.fm_add(uuid, text, text, text, text, int, jsonb), public.fm_search_begin(uuid, text, text), public.fm_search_save(text, text, jsonb, int) to service_role';
  end if;
end $$;

/* ============================================================ tempo real */

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_now_playing') then
    alter publication supabase_realtime add table public.room_now_playing;
  end if;
end $$;

-- Painel do dono (/admin). Rode DEPOIS do schema.sql, do fm.sql e do entrada-rapida.sql (Supabase > SQL Editor > Run).
-- Pode rodar de novo sem estragar nada. Não mexe em nada que já existe: só cria tabelas e funções novas.
--
-- Como funciona:
--   * Quem pode abrir o painel é uma lista de navegadores (admins). Entra na lista quem acerta a senha do painel.
--   * A senha NÃO fica no código nem no site: você define uma vez, no SQL Editor, com
--         select public.admin_definir_senha('uma senha longa só sua');
--     (só o banco guarda, com sal e hash. Trocar a senha desconecta todos os aparelhos.)
--   * Cada aparelho fica liberado por 30 dias. Depois pede a senha de novo.
--   * Erradas demais (10 em 15 minutos, no total) travam novas entradas por um tempo.
--   * O painel mostra números e nomes das salas. NÃO mostra o texto das conversas.
--   * Quem está dentro de cada sala agora não vem do banco: o painel escuta a presença em tempo real (no navegador).

begin;

create table if not exists public.admin_cfg (key text primary key, value text not null);
create table if not exists public.admins (auth_uid uuid primary key, created_at timestamptz not null default now());
create table if not exists public.admin_falhas (id bigint generated always as identity primary key, at timestamptz not null default now());
alter table public.admin_cfg enable row level security;
alter table public.admins enable row level security;
alter table public.admin_falhas enable row level security;
revoke all on public.admin_cfg, public.admins, public.admin_falhas from anon, authenticated;

-- define (ou troca) a senha. Só roda aqui no SQL Editor, nunca pelo site.
create or replace function public.admin_definir_senha(p_senha text) returns void
language plpgsql security definer set search_path = public as $$
declare v_sal text := replace(gen_random_uuid()::text, '-', '');
begin
  if char_length(coalesce(p_senha, '')) < 10 then raise exception 'senha curta: use pelo menos 10 caracteres'; end if;
  insert into public.admin_cfg (key, value) values ('senha', v_sal || ':' || encode(sha256(convert_to(v_sal || p_senha, 'utf8')), 'hex'))
  on conflict (key) do update set value = excluded.value;
  delete from public.admins;
  delete from public.admin_falhas;
end $$;
revoke all on function public.admin_definir_senha(text) from public, anon, authenticated;

-- este navegador está liberado?
create or replace function public.admin_eu() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where auth_uid = auth.uid() and created_at > now() - interval '30 days')
$$;

-- entra com a senha. Devolve {ok:true} ou {err: auth | sem_senha | slow | senha}
create or replace function public.admin_entrar(p_senha text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_val text; v_sal text;
begin
  if v_uid is null then return jsonb_build_object('err', 'auth'); end if;
  select value into v_val from public.admin_cfg where key = 'senha';
  if v_val is null then return jsonb_build_object('err', 'sem_senha'); end if;
  if (select count(*) from public.admin_falhas where at > now() - interval '15 minutes') >= 10 then
    return jsonb_build_object('err', 'slow');
  end if;
  v_sal := split_part(v_val, ':', 1);
  if v_val <> v_sal || ':' || encode(sha256(convert_to(v_sal || coalesce(p_senha, ''), 'utf8')), 'hex') then
    insert into public.admin_falhas default values;
    delete from public.admin_falhas where at < now() - interval '1 day';
    return jsonb_build_object('err', 'senha');
  end if;
  insert into public.admins (auth_uid) values (v_uid) on conflict (auth_uid) do update set created_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_sair() returns void language sql security definer set search_path = public as $$
  delete from public.admins where auth_uid = auth.uid()
$$;

-- tudo o que o painel mostra, numa chamada só. Erro: perm (não liberado).
create or replace function public.admin_painel() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_horas int := coalesce((select value::int from public.app_config where key = 'sala_horas'), 8);
  v_tz text := 'America/Sao_Paulo';
  r jsonb;
begin
  if not public.admin_eu() then raise exception 'perm'; end if;

  with plays as (            -- cada "Tocando agora" dos últimos 7 dias, e se foi pulada antes da próxima começar
    select c.id, c.role_id, c.created_at, coalesce(nullif(c.dados->>'title', ''), '(sem título)') as titulo,
      exists (select 1 from public.chat_messages p
              where p.role_id = c.role_id and p.tipo = 'bot' and p.dados->>'k' = 'pulou' and p.id > c.id
                and p.id < coalesce((select min(n.id) from public.chat_messages n
                                     where n.role_id = c.role_id and n.tipo = 'bot' and n.dados->>'k' in ('agora', 'vazia') and n.id > c.id),
                                    9223372036854775807)) as pulada
    from public.chat_messages c
    where c.tipo = 'bot' and c.dados->>'k' = 'agora' and c.created_at > now() - interval '7 days'
    order by c.id desc limit 3000
  ),
  vivas as (
    select ro.* from public.roles ro where public.role_vivo(ro.id) order by ro.created_at desc limit 100
  ),
  dias as (
    select d::date as dia from generate_series(((now() at time zone v_tz)::date - 6)::timestamp, (now() at time zone v_tz)::date::timestamp, interval '1 day') d
  )
  select jsonb_build_object(
    'agora', public.ms(clock_timestamp()),
    'horas', v_horas,
    'totais', jsonb_build_object(
      'contas', (select count(*) from public.users),
      'visitantes', (select count(*) from public.users where email is null and telefone is null),
      'contas_24h', (select count(*) from public.users where created_at > now() - interval '24 hours'),
      'vistos_5min', (select count(*) from public.sessions where last_seen_at > now() - interval '5 minutes' and expires_at > now()),
      'vistos_1h', (select count(*) from public.sessions where last_seen_at > now() - interval '1 hour' and expires_at > now()),
      'salas', (select count(*) from public.roles),
      'salas_24h', (select count(*) from public.roles where created_at > now() - interval '24 hours'),
      'salas_ativas', (select count(*) from vivas),
      'msgs_24h', (select count(*) from public.chat_messages where tipo = 'texto' and deleted_at is null and created_at > now() - interval '24 hours'),
      'tocadas_24h', (select count(*) from plays where created_at > now() - interval '24 hours'),
      'puladas_24h', (select count(*) from plays where pulada and created_at > now() - interval '24 hours')),
    'salas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'nome', v.nome, 'cena', v.cena, 'noite', v.noite, 'max', v.max_pessoas, 'privacidade', v.privacidade,
        'dono', o.usuario, 'dono_nome', o.nome,
        'criada', public.ms(v.created_at), 'expira', public.ms(v.created_at + make_interval(hours => v_horas)),
        'membros', (select count(*) from public.role_members m where m.role_id = v.id and m.banned_at is null),
        'msgs_10min', (select count(*) from public.chat_messages c where c.role_id = v.id and c.tipo = 'texto' and c.deleted_at is null and c.created_at > now() - interval '10 minutes'),
        'msgs_total', (select count(*) from public.chat_messages c where c.role_id = v.id and c.tipo = 'texto' and c.deleted_at is null),
        'tocando', case when np.status is null or np.status = 'parado' then null else jsonb_build_object(
            'status', np.status, 'titulo', np.title, 'dur', np.duration_s, 'inicio', public.ms(np.started_at), 'pausa', public.ms(np.paused_at),
            'por', (select u.usuario from public.users u where u.id = np.added_by)) end,
        'fila', (select count(*) from public.room_queue q where q.role_id = v.id),
        'tocadas', (select count(*) from plays p where p.role_id = v.id),
        'puladas', (select count(*) from plays p where p.role_id = v.id and p.pulada),
        'ultimas', coalesce((select jsonb_agg(jsonb_build_object('titulo', x.titulo, 'em', public.ms(x.created_at), 'pulada', x.pulada) order by x.id desc)
                             from (select * from plays p where p.role_id = v.id order by p.id desc limit 5) x), '[]'::jsonb)
      ) order by v.created_at desc)
      from vivas v join public.users o on o.id = v.owner_id left join public.room_now_playing np on np.role_id = v.id), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('titulo', t.titulo, 'vezes', t.vezes, 'puladas', t.puladas, 'salas', t.salas) order by t.vezes desc, t.titulo)
                     from (select titulo, count(*) vezes, count(*) filter (where pulada) puladas, count(distinct role_id) salas
                           from plays where created_at > now() - interval '24 hours' group by titulo order by count(*) desc, titulo limit 10) t), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(jsonb_build_object('titulo', x.titulo, 'em', public.ms(x.created_at), 'pulada', x.pulada, 'sala', coalesce(ro.nome, '?')) order by x.id desc)
                          from (select * from plays order by id desc limit 12) x left join public.roles ro on ro.id = x.role_id), '[]'::jsonb),
    'dias', coalesce((select jsonb_agg(jsonb_build_object(
        'dia', to_char(d.dia, 'DD/MM'),
        'contas', (select count(*) from public.users u where (u.created_at at time zone v_tz)::date = d.dia),
        'salas', (select count(*) from public.roles ro where (ro.created_at at time zone v_tz)::date = d.dia),
        'msgs', (select count(*) from public.chat_messages c where c.tipo = 'texto' and c.deleted_at is null and (c.created_at at time zone v_tz)::date = d.dia),
        'tocadas', (select count(*) from plays p where (p.created_at at time zone v_tz)::date = d.dia)) order by d.dia) from dias d), '[]'::jsonb),
    'contas_novas', coalesce((select jsonb_agg(jsonb_build_object('nome', u.nome, 'usuario', u.usuario, 'visitante', (u.email is null and u.telefone is null), 'em', public.ms(u.created_at)) order by u.created_at desc)
                              from (select * from public.users order by created_at desc limit 10) u), '[]'::jsonb)
  ) into r;
  return r;
end $$;

grant execute on function public.admin_eu() to authenticated;
grant execute on function public.admin_entrar(text) to authenticated;
grant execute on function public.admin_sair() to authenticated;
grant execute on function public.admin_painel() to authenticated;

commit;

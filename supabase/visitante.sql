-- Entrada rápida (visitante): só o nome, sem e-mail, celular nem código. Rode no Supabase > SQL Editor > Run.
-- Pode rodar quantas vezes quiser. Não mexe nos dados que já existem.

-- a conta passa a dizer se é de visitante (sem e-mail e sem celular)
create or replace function public.conta_json(u public.users) returns jsonb language sql stable as $$
  select jsonb_build_object('nome', u.nome, 'usuario', u.usuario, 'email', u.email, 'tel', u.telefone,
    'verificado', true, 'visitante', (u.email is null and u.telefone is null), 'fig', u.fig, 'criado', public.ms(u.created_at))
$$;

-- Cria o visitante, liga a sessão deste navegador a ele e devolve {uid, conta}. Erros: auth, invalid, slow, taken.
create or replace function public.auth_guest(p_nome text, p_fig text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := left(btrim(coalesce(p_nome, '')), 20);
  v_base text;
  v_user_name text;
  v_user public.users;
  v_n int := 0;
begin
  if v_uid is null then raise exception 'auth'; end if;
  if char_length(v_nome) < 2 then return jsonb_build_object('err', 'invalid'); end if;

  -- no máximo 20 visitantes novos por IP a cada 10 minutos
  if public.req_ip() <> '' and (select count(*) from public.sessions s join public.users u on u.id = s.user_id
      where s.ip = public.req_ip() and s.created_at > now() - interval '10 minutes'
        and u.email is null and u.telefone is null and u.created_at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('err', 'slow');
  end if;

  v_base := left(regexp_replace(translate(lower(v_nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]', '', 'g'), 12);
  if char_length(v_base) < 3 then v_base := left(v_base || (100 + floor(random() * 900))::int::text, 12); end if;
  v_user_name := v_base;
  while exists (select 1 from public.users where usuario = v_user_name) and v_n < 30 loop
    v_n := v_n + 1;
    v_user_name := left(v_base, 12) || (10 + floor(random() * 9990))::int::text;
    v_user_name := left(v_user_name, 16);
  end loop;
  if exists (select 1 from public.users where usuario = v_user_name) then return jsonb_build_object('err', 'taken'); end if;

  insert into public.users (nome, usuario, fig)
  values (v_nome, v_user_name, case when char_length(coalesce(p_fig, '')) <= 600 then coalesce(p_fig, '') else '' end)
  returning * into v_user;

  insert into public.sessions (auth_uid, user_id, user_agent, ip)
  values (v_uid, v_user.id, left(public.req_header('user-agent'), 300), nullif(public.req_ip(), ''))
  on conflict (auth_uid) do update set user_id = excluded.user_id, created_at = now(), last_seen_at = now(),
    expires_at = now() + interval '60 days', user_agent = excluded.user_agent, ip = excluded.ip;

  return jsonb_build_object('uid', v_user.id, 'conta', public.conta_json(v_user));
end $$;

grant execute on function public.auth_guest(text, text) to authenticated;

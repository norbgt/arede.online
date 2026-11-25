-- 25/11 (Amanda): até 31/12/2026, período de teste com convites ilimitados. A partir de 1/1/2027 (Brasília), conta nova
-- só com convite: o servidor confere na criação da conta. Cada conta tem 3 convites contados a partir dessa data; a administração
-- (conta oficial) não tem limite. Sem convite, a pessoa entra na lista de espera (só o e-mail, apagado quando o convite sai ou em 90 dias).
-- O painel vê só quantas pessoas esperam e manda N convites de uma vez; cada convite da lista vale para uma pessoa.
insert into privado.parametros (chave, area, nome, descricao, tipo, valor, risco, publico, ordem, onde) values
 ('convite_desde', 'contas', 'Só com convite a partir de', 'Data (AAAA-MM-DD, horário de Brasília). Vazio: cadastro aberto.', 'texto', '"2027-01-01"', 'alto', true, 1, 'servidor'),
 ('convites_por_pessoa', 'contas', 'Convites por conta', 'Contados a partir da data acima. A administração não tem limite.', 'inteiro', '3', 'medio', true, 2, 'servidor'),
 ('espera_guarda_dias', 'contas', 'Lista de espera: guardar o e-mail por', 'Depois disso o e-mail é apagado.', 'inteiro', '90', 'baixo', false, 3, 'servidor')
on conflict (chave) do nothing;

create or replace function privado.convite_desde() returns timestamptz language plpgsql stable security definer set search_path to '' as $$
declare v text := (select valor #>> '{}' from privado.parametros where chave = 'convite_desde');
begin
  if v is null or btrim(v) = '' then return null; end if;
  return (btrim(v)::date)::timestamp at time zone 'America/Sao_Paulo';
exception when others then return null;
end $$;

create table if not exists privado.convite_avulsos (
  codigo text primary key,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  usado_por uuid
);
create table if not exists privado.lista_espera (
  id bigint generated always as identity primary key,
  email text not null unique,
  criado_em timestamptz not null default now(),
  codigo text,
  enviado_em timestamptz
);
alter table privado.convite_avulsos enable row level security;
alter table privado.lista_espera enable row level security;
revoke all on privado.convite_avulsos, privado.lista_espera from public, anon, authenticated;

create or replace function privado.convite_ilimitado(p_user uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.perfis where id = p_user and papel = 'admin') $$;

-- situação de um código: {ok, tipo, dono, restam, motivo}
create or replace function privado.convite_situacao(p_codigo text) returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c text := lower(btrim(coalesce(p_codigo, ''))); quem uuid; usados int; lim int := privado.param_int('convites_por_pessoa', 3); desde timestamptz := privado.convite_desde(); a privado.convite_avulsos;
begin
  c := regexp_replace(c, '^.*/convite/', '');
  c := regexp_replace(c, '[^a-z0-9]', '', 'g');
  if c = '' then return jsonb_build_object('ok', false, 'motivo', 'sem_codigo'); end if;
  select * into a from privado.convite_avulsos where codigo = c;
  if found then
    if a.usado_em is not null then return jsonb_build_object('ok', false, 'motivo', 'usado'); end if;
    return jsonb_build_object('ok', true, 'tipo', 'avulso', 'codigo', c);
  end if;
  select user_id into quem from privado.convite_codigos where codigo = c;
  if quem is null or privado.apagando(quem) then return jsonb_build_object('ok', false, 'motivo', 'codigo'); end if;
  if privado.convite_ilimitado(quem) or desde is null then return jsonb_build_object('ok', true, 'tipo', 'pessoa', 'codigo', c, 'dono', quem); end if;
  select count(*) into usados from privado.convites where convidante = quem and criado_em >= desde;
  if usados >= lim then return jsonb_build_object('ok', false, 'motivo', 'esgotado'); end if;
  return jsonb_build_object('ok', true, 'tipo', 'pessoa', 'codigo', c, 'dono', quem, 'restam', lim - usados);
end $$;

-- o site confere o convite antes de criar a conta (o servidor confere de novo na criação)
create or replace function public.convite_confere(p_codigo text) returns jsonb language plpgsql security definer set search_path to '' as $$
declare s jsonb; nome text;
begin
  if not privado.ritmo_ok('convite:confere:' || md5(coalesce(p_codigo, '')), 30, interval '1 hour') then return jsonb_build_object('ok', false, 'motivo', 'ritmo'); end if;
  s := privado.convite_situacao(p_codigo);
  if (s->>'ok')::boolean and s ? 'dono' then select nullif(split_part(btrim(nome), ' ', 1), '') into nome from public.perfis where id = (s->>'dono')::uuid; end if;
  return jsonb_build_object('ok', (s->>'ok')::boolean, 'motivo', s->>'motivo', 'nome', nome, 'exige', privado.convite_desde() is not null and now() >= privado.convite_desde());
end $$;
revoke all on function public.convite_confere(text) from public;
grant execute on function public.convite_confere(text) to anon, authenticated;

-- regra pública para o site: desde quando exige e quantos convites por conta
create or replace function public.convite_regra() returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('desde', privado.convite_desde(), 'exige', privado.convite_desde() is not null and now() >= privado.convite_desde(), 'por_pessoa', privado.param_int('convites_por_pessoa', 3)) $$;
grant execute on function public.convite_regra() to anon, authenticated;

-- trava na criação da conta
create or replace function privado.convite_trava() returns trigger language plpgsql security definer set search_path to '' as $$
declare desde timestamptz := privado.convite_desde(); s jsonb;
begin
  if desde is null or now() < desde then return new; end if;
  s := privado.convite_situacao(new.raw_user_meta_data ->> 'convite');
  if not coalesce((s->>'ok')::boolean, false) then
    raise exception 'A rede.online cresce por convite. Peça um convite a quem já está na rede ou entre na lista de espera.';
  end if;
  if s->>'tipo' = 'avulso' then update privado.convite_avulsos set usado_em = now(), usado_por = new.id where codigo = s->>'codigo' and usado_em is null; end if;
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('convite', s->>'codigo');
  return new;
end $$;
drop trigger if exists convite_trava on auth.users;
create trigger convite_trava before insert on auth.users for each row execute function privado.convite_trava();

-- meu convite: código, amigos e a conta dos convites
create or replace function public.meu_convite() returns jsonb language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); cod text; n int; nv int[] := privado.amigos_niveis(); prox int; tent int := 0; desde timestamptz := privado.convite_desde(); usados int := 0;
begin
  if uid is null then raise exception 'valor: entre na sua conta'; end if;
  select codigo into cod from privado.convite_codigos where user_id = uid;
  while cod is null and tent < 20 loop
    tent := tent + 1;
    cod := lower(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 7));
    if cod !~ '^[a-z0-9]{7}$' or exists (select 1 from privado.convite_codigos where codigo = cod) then cod := null; continue; end if;
    insert into privado.convite_codigos (user_id, codigo) values (uid, cod);
  end loop;
  n := privado.amigos_de(uid);
  select min(x) into prox from unnest(nv) x where x > n;
  if desde is not null then select count(*) into usados from privado.convites where convidante = uid and criado_em >= desde; end if;
  return jsonb_build_object('codigo', cod, 'amigos', n, 'proximo', prox, 'niveis', to_jsonb(nv),
    'desde', desde, 'limite', case when desde is null or privado.convite_ilimitado(uid) then null else privado.param_int('convites_por_pessoa', 3) end, 'usados', usados);
end $$;

-- lista de espera
create or replace function public.lista_espera_entra(p_email text) returns jsonb language plpgsql security definer set search_path to '' as $$
declare e text := lower(btrim(coalesce(p_email, '')));
begin
  if e !~ '^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$' or length(e) > 200 then raise exception 'valor: confira o e-mail'; end if;
  if not privado.ritmo_ok('espera:' || md5(e), 3, interval '1 day') or not privado.ritmo_ok('espera:geral', 400, interval '1 hour') then raise exception 'valor: muitas tentativas; tente mais tarde'; end if;
  insert into privado.lista_espera (email) values (e) on conflict (email) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lista_espera_entra(text) from public;
grant execute on function public.lista_espera_entra(text) to anon, authenticated;

-- painel: quantas pessoas esperam (sem e-mails)
create or replace function public.bo_espera_resumo() returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform privado.bo_exige(array['administracao']);
  return jsonb_build_object('esperando', (select count(*) from privado.lista_espera where enviado_em is null),
    'enviados_30d', (select count(*) from privado.convite_avulsos where criado_em > now() - interval '30 days'),
    'usados_30d', (select count(*) from privado.convite_avulsos where usado_em > now() - interval '30 days'),
    'desde', privado.convite_desde(), 'por_pessoa', privado.param_int('convites_por_pessoa', 3));
end $$;
grant execute on function public.bo_espera_resumo() to authenticated;

-- painel: separa os próximos N da fila e cria um convite avulso para cada; só a função de envio recebe os e-mails
create or replace function public.bo_espera_prepara(p_n int) returns jsonb language plpgsql security definer set search_path to '' as $$
declare n int := least(greatest(coalesce(p_n, 0), 1), 50); r record; cod text; out jsonb := '[]'::jsonb;
begin
  perform privado.bo_exige(array['administracao']);
  for r in select id, email from privado.lista_espera where enviado_em is null and codigo is null order by criado_em limit n for update skip locked loop
    loop
      cod := lower(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 9));
      exit when cod ~ '^[a-z0-9]{9}$' and not exists (select 1 from privado.convite_avulsos where codigo = cod) and not exists (select 1 from privado.convite_codigos where codigo = cod);
    end loop;
    insert into privado.convite_avulsos (codigo) values (cod);
    update privado.lista_espera set codigo = cod where id = r.id;
    out := out || jsonb_build_array(jsonb_build_object('id', r.id, 'email', r.email, 'codigo', cod));
  end loop;
  return out;
end $$;
revoke all on function public.bo_espera_prepara(int) from public, anon;
grant execute on function public.bo_espera_prepara(int) to authenticated;

-- resultado do envio (só a função de envio, com a chave de serviço): enviado apaga o e-mail; falha devolve à fila
create or replace function public.espera_resultado(p_id bigint, p_ok boolean) returns void language plpgsql security definer set search_path to '' as $$
declare c text;
begin
  if p_ok then delete from privado.lista_espera where id = p_id;
  else select codigo into c from privado.lista_espera where id = p_id; update privado.lista_espera set codigo = null where id = p_id; delete from privado.convite_avulsos where codigo = c and usado_em is null; end if;
end $$;
revoke all on function public.espera_resultado(bigint, boolean) from public, anon, authenticated;
grant execute on function public.espera_resultado(bigint, boolean) to service_role;

create or replace function privado.espera_expira() returns int language sql security definer set search_path to '' as $$
  with d as (delete from privado.lista_espera where criado_em < now() - make_interval(days => privado.param_int('espera_guarda_dias', 90)) returning 1) select count(*)::int from d $$;
select cron.schedule('lista-espera-expira', '43 4 * * *', 'select privado.espera_expira()');

-- 25/11 (Amanda): tatuagem. Pagamento antes da sessão (sinal ou total) marcado pela página; ficha de saúde (anamnese)
-- liberada depois do pagamento, que só a página vê e que se apaga em 12 meses; checkout por QR ou sozinho 8 h depois
-- do check-in, que manda os cuidados. Ficha e cuidados têm padrão da rede e a página edita.
alter table public.pagina_tatuagem add column if not exists ficha jsonb, add column if not exists cuidados jsonb;
alter table public.pagina_tatuagem drop constraint if exists pt_ficha_ok, drop constraint if exists pt_cuidados_ok;
alter table public.pagina_tatuagem add constraint pt_ficha_ok check (ficha is null or (jsonb_typeof(ficha) = 'array' and length(ficha::text) <= 6000)),
  add constraint pt_cuidados_ok check (cuidados is null or (jsonb_typeof(cuidados) = 'array' and length(cuidados::text) <= 6000));
alter table public.tat_pedidos add column if not exists pago_em timestamptz, add column if not exists pago_valor numeric,
  add column if not exists pago_modo text, add column if not exists ficha_avisada_em timestamptz;

create or replace function privado.tat_pedido_protege()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if auth.uid() is not null and (new.valor_combinado is distinct from old.valor_combinado or new.sessoes_prev is distinct from old.sessoes_prev or new.sinal_combinado is distinct from old.sinal_combinado)
     and privado.dona_pagina(new.pagina_id) is distinct from auth.uid() and coalesce(current_setting('arede.orc_aceite', true), '') <> '1' then
    raise exception 'valor: só a página envia o orçamento'; end if;
  if auth.uid() is not null and (new.pago_em, new.pago_valor, new.pago_modo, new.ficha_avisada_em) is distinct from (old.pago_em, old.pago_valor, old.pago_modo, old.ficha_avisada_em)
     and coalesce(current_setting('arede.pago', true), '') <> '1' then
    raise exception 'valor: o pagamento é registrado pela página'; end if;
  return new; end $$;

create table if not exists public.tat_fichas (
  pedido_id uuid primary key references public.tat_pedidos(id) on delete cascade,
  pagina_id uuid not null references public.paginas(id) on delete cascade,
  cliente uuid not null references auth.users(id) on delete cascade,
  perguntas jsonb not null,
  respostas jsonb not null,
  enviada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  apaga_em timestamptz not null default now() + interval '12 months'
);
create index if not exists tat_fichas_apaga on public.tat_fichas(apaga_em);
alter table public.tat_fichas enable row level security;
revoke all on public.tat_fichas from public, anon, authenticated;
grant select on public.tat_fichas to authenticated;
drop policy if exists ficha_saude_le on public.tat_fichas;
create policy ficha_saude_le on public.tat_fichas for select to authenticated
  using (cliente = (select auth.uid()) or privado.dona_pagina(pagina_id) = (select auth.uid()));

create or replace function privado.tat_ficha_padrao() returns jsonb language sql immutable set search_path to '' as $$
  select '[["Saúde",["Alergia a remédio, látex, pomada ou tinta?","Usa remédio todo dia?","Diabetes, problema no coração, de coagulação ou epilepsia?","Queloide ou cicatrização difícil?","Grávida ou amamentando?"]],["No dia",["Bebida alcoólica nas últimas 24 h?"]]]'::jsonb $$;
create or replace function privado.tat_cuidados_padrao() returns jsonb language sql immutable set search_path to '' as $$
  select '[["Primeiros dias",["Tire o curativo depois de 4 horas.","Lave com água e sabonete neutro, seque com papel toalha.","Passe uma camada fina de pomada, 3 vezes ao dia."]],["Por 30 dias",["Não coce nem tire as casquinhas.","Sem sol, piscina, mar e sauna.","Roupa folgada sobre a tatuagem."]],["Fique de olho",["Vermelhidão que aumenta, pus ou febre: procure um médico e avise o estúdio."]]]'::jsonb $$;

create or replace function privado.tat_e_tatuagem(p_pagina uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.pagina_tatuagem where pagina_id = p_pagina and modelo = 'tatuagem') $$;

-- valor a pagar antes da sessão (sinal ou total); null quando não há
create or replace function privado.tat_antes(p_pedido uuid) returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce(x.sinal_combinado, (select s.sinal from public.tat_sessoes s where s.pedido_id = x.id and s.status <> 'cancelada' order by s.quando limit 1))
  from public.tat_pedidos x where x.id = p_pedido $$;

create or replace function privado.tat_ficha_liberada(p_pedido uuid) returns boolean language sql stable security definer set search_path to '' as $$
  select privado.tat_e_tatuagem(x.pagina_id) and x.status <> 'fechado'
     and (x.valor_combinado is not null or exists (select 1 from public.tat_sessoes s where s.pedido_id = x.id and s.status in ('marcada','verificada')))
     and (coalesce(privado.tat_antes(x.id), 0) <= 0 or x.pago_em is not null)
  from public.tat_pedidos x where x.id = p_pedido $$;

create or replace function privado.tat_ficha_avisa(p_pedido uuid) returns void language plpgsql security definer set search_path to '' as $$
declare x public.tat_pedidos;
begin
  select * into x from public.tat_pedidos where id = p_pedido;
  if not found or x.ficha_avisada_em is not null or exists (select 1 from public.tat_fichas where pedido_id = p_pedido) then return; end if;
  if not privado.tat_ficha_liberada(p_pedido) then return; end if;
  perform set_config('arede.pago', '1', true);
  update public.tat_pedidos set ficha_avisada_em = now() where id = p_pedido;
  perform set_config('arede.pago', '0', true);
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (p_pedido, 'sistema', x.cliente, 'Ficha de saúde liberada: preencha na aba Atendimento. Só o estúdio vê.');
  perform privado.notifica(x.cliente, 'pedidos', 'Preencha a ficha de saúde', 'Só o estúdio vê. Leva uns 5 minutos.', '#conversa-' || p_pedido, null);
end $$;

create or replace function privado.tat_ficha_gatilho() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if tg_table_name = 'tat_pedidos' then perform privado.tat_ficha_avisa(new.id); else perform privado.tat_ficha_avisa(new.pedido_id); end if;
  return null;
exception when others then return null;
end $$;
drop trigger if exists tat_ficha_avisa on public.tat_pedidos;
create trigger tat_ficha_avisa after update of valor_combinado, pago_em on public.tat_pedidos for each row execute function privado.tat_ficha_gatilho();
drop trigger if exists tat_ficha_avisa on public.tat_sessoes;
create trigger tat_ficha_avisa after update of status on public.tat_sessoes for each row when (new.status = 'marcada') execute function privado.tat_ficha_gatilho();

-- a página marca que recebeu o pagamento de antes da sessão
create or replace function public.tat_pagamento_recebido(p_pedido uuid) returns jsonb language plpgsql security definer set search_path to '' as $$
declare x public.tat_pedidos; v numeric;
begin
  select * into x from public.tat_pedidos where id = p_pedido for update;
  if not found or privado.dona_pagina(x.pagina_id) is distinct from auth.uid() then raise exception 'valor: só a página marca o pagamento'; end if;
  v := privado.tat_antes(p_pedido);
  if coalesce(v, 0) <= 0 then raise exception 'valor: este pedido não tem pagamento antes da sessão'; end if;
  if x.pago_em is not null then return jsonb_build_object('pago_em', x.pago_em); end if;
  perform set_config('arede.pago', '1', true);
  update public.tat_pedidos set pago_em = now(), pago_valor = v, pago_modo = 'marcado', atualizado_em = now() where id = p_pedido;
  perform set_config('arede.pago', '0', true);
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (p_pedido, 'sistema', auth.uid(),
    'Pagamento de R$ ' || replace(to_char(v, 'FM999G990D00'), ',', '.') || ' recebido pela página.');
  perform privado.tat_ficha_avisa(p_pedido);
  return jsonb_build_object('pago_em', now());
end $$;
revoke all on function public.tat_pagamento_recebido(uuid) from public, anon;
grant execute on function public.tat_pagamento_recebido(uuid) to authenticated;

-- respostas: [{"r":"s"|"n","q":"texto"}] na ordem das perguntas; p_confirma = 18 anos ou mais e respostas verdadeiras
create or replace function public.tat_ficha_envia(p_pedido uuid, p_respostas jsonb, p_confirma boolean) returns jsonb language plpgsql security definer set search_path to '' as $$
declare x public.tat_pedidos; pg jsonb; n int; r jsonb; i int := 0; limpa jsonb := '[]'::jsonb; nova boolean;
begin
  select * into x from public.tat_pedidos where id = p_pedido;
  if not found or x.cliente is distinct from auth.uid() then raise exception 'valor: esta ficha não é sua'; end if;
  if not privado.tat_ficha_liberada(p_pedido) then raise exception 'valor: a ficha abre depois do orçamento aceito e do pagamento'; end if;
  if p_confirma is not true then raise exception 'valor: confirme que tem 18 anos ou mais e que as respostas são verdadeiras'; end if;
  select coalesce(ficha, privado.tat_ficha_padrao()) into pg from public.pagina_tatuagem where pagina_id = x.pagina_id;
  select count(*) into n from jsonb_array_elements(pg) s, jsonb_array_elements(s->1) q;
  if jsonb_typeof(p_respostas) <> 'array' or jsonb_array_length(p_respostas) <> n then raise exception 'valor: responda todas as perguntas'; end if;
  for r in select value from jsonb_array_elements(p_respostas) loop
    i := i + 1;
    if coalesce(r->>'r', '') not in ('s','n') then raise exception 'valor: responda todas as perguntas'; end if;
    limpa := limpa || jsonb_build_array(jsonb_build_object('r', r->>'r', 'q', case when r->>'r' = 's' then left(btrim(coalesce(r->>'q', '')), 300) else '' end));
  end loop;
  nova := not exists (select 1 from public.tat_fichas where pedido_id = p_pedido);
  insert into public.tat_fichas (pedido_id, pagina_id, cliente, perguntas, respostas)
    values (p_pedido, x.pagina_id, x.cliente, pg, limpa)
    on conflict (pedido_id) do update set perguntas = excluded.perguntas, respostas = excluded.respostas, atualizada_em = now(), apaga_em = now() + interval '12 months';
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (p_pedido, 'sistema', auth.uid(), case when nova then 'Ficha de saúde enviada ao estúdio.' else 'Ficha de saúde atualizada.' end);
  perform privado.notifica(privado.dona_pagina(x.pagina_id), 'pedidos', case when nova then 'Ficha de saúde recebida' else 'Ficha de saúde atualizada' end,
    split_part(coalesce(x.cliente_nome, ''), ' ', 1), '#conversa-' || p_pedido, null);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.tat_ficha_envia(uuid, jsonb, boolean) from public, anon;
grant execute on function public.tat_ficha_envia(uuid, jsonb, boolean) to authenticated;

create or replace function public.tat_ficha_apaga(p_pedido uuid) returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not exists (select 1 from public.tat_fichas where pedido_id = p_pedido and cliente = auth.uid()) then raise exception 'valor: ficha não encontrada'; end if;
  delete from public.tat_fichas where pedido_id = p_pedido and cliente = auth.uid();
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (p_pedido, 'sistema', auth.uid(), 'Ficha de saúde apagada por quem preencheu.');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.tat_ficha_apaga(uuid) from public, anon;
grant execute on function public.tat_ficha_apaga(uuid) to authenticated;

-- checkout: manda os cuidados (uma mensagem e um aviso)
create or replace function privado.tat_cuidados_envia(p_sessao uuid) returns void language plpgsql security definer set search_path to '' as $$
declare s public.tat_sessoes;
begin
  select * into s from public.tat_sessoes where id = p_sessao;
  if not found or not privado.tat_e_tatuagem(s.pagina_id) then return; end if;
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (s.pedido_id, 'sistema', s.cliente, 'Checkout feito. Os cuidados com a tatuagem estão na aba Atendimento.');
  perform privado.notifica(s.cliente, 'pedidos', 'Cuidados com a sua tatuagem', 'Veja como cuidar nos próximos dias.', '#conversa-' || s.pedido_id, null);
end $$;

create or replace function public.tat_checkout(p_sessao uuid, p_valor numeric) returns jsonb language plpgsql security definer set search_path to '' as $$
declare s public.tat_sessoes; pg public.paginas; it text; vid uuid; novo boolean;
begin
  select * into s from public.tat_sessoes where id = p_sessao for update;
  if not found then raise exception 'valor: atendimento não encontrado'; end if;
  select * into pg from public.paginas where id = s.pagina_id;
  if pg.dono is distinct from auth.uid() then raise exception 'valor: só a página encerra o atendimento'; end if;
  if s.status <> 'verificada' then raise exception 'valor: o atendimento precisa do check-in antes'; end if;
  if s.valor_pago is not null then raise exception 'valor: este atendimento já foi encerrado'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor: informe o valor pago'; end if;
  novo := s.checkout_em is null;
  perform set_config('arede.checkout', '1', true);
  update public.tat_sessoes set valor_pago = round(p_valor, 2), checkout_em = coalesce(checkout_em, now()) where id = p_sessao;
  perform set_config('arede.checkout', '0', true);
  if novo then perform privado.tat_cuidados_envia(p_sessao); end if;
  if pg.mei and not exists (select 1 from privado.mei_vendas where sessao_id = p_sessao) then
    select item into it from public.tat_pedidos where id = s.pedido_id;
    insert into privado.mei_vendas (pagina_id, data, valor, descricao, tomador, origem, sessao_id)
      values (pg.id, (now() at time zone 'America/Sao_Paulo')::date, round(p_valor, 2), left(coalesce(nullif(btrim(it), ''), 'Atendimento'), 200), left(s.cliente_nome, 120), 'sessao', p_sessao) returning id into vid;
  end if;
  return jsonb_build_object('venda', vid);
end $$;

-- o código: antes do check-in, o do check-in; depois (tatuagem), um novo, para o checkout
create or replace function public.tat_sessao_codigo(p_sessao uuid) returns text language plpgsql security definer set search_path to '' as $$
declare s record;
begin
  select * into s from public.tat_sessoes where id = p_sessao;
  if not found or privado.dona_pagina(s.pagina_id) is distinct from auth.uid() then raise exception 'valor: sessão não encontrada'; end if;
  if not (s.status = 'marcada' or (s.status = 'verificada' and s.checkout_em is null and privado.tat_e_tatuagem(s.pagina_id))) then return null; end if;
  update privado.tat_codigos set erros = 0 where sessao_id = p_sessao;
  return (select codigo from privado.tat_codigos where sessao_id = p_sessao); end $$;

create or replace function public.tat_checkin(p_sessao uuid, p_codigo text) returns text language plpgsql security definer set search_path to '' as $$
declare s record; c record;
begin
  select * into s from public.tat_sessoes where id = p_sessao for update;
  if not found or s.cliente is distinct from auth.uid() then return 'esta sessão não é sua'; end if;
  if s.status = 'verificada' then return null; end if;
  if s.status <> 'marcada' then return 'a sessão precisa estar confirmada'; end if;
  if now() < s.quando - interval '2 hours' or now() > s.quando + interval '12 hours' then return 'o check-in vale de 2 horas antes até 12 horas depois do horário marcado'; end if;
  select * into c from privado.tat_codigos where sessao_id = p_sessao for update;
  if c.erros >= 5 then return 'muitas tentativas. Peça para a página mostrar o QR de novo'; end if;
  if regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g') <> c.codigo then
    update privado.tat_codigos set erros = erros + 1 where sessao_id = p_sessao; return 'código errado. Confira na tela da página'; end if;
  perform set_config('arede.checkin', '1', true);
  update public.tat_sessoes set status = 'verificada', checkin_em = now() where id = p_sessao;
  perform set_config('arede.checkin', '0', true);
  update privado.tat_codigos set codigo = lpad((floor(random() * 1000000))::int::text, 6, '0'), erros = 0 where sessao_id = p_sessao;
  insert into public.tat_mensagens(pedido_id, de, autor, texto) values (s.pedido_id, 'sistema', auth.uid(), 'Check-in feito. O atendimento começou.');
  perform privado.notifica(privado.dona_pagina(s.pagina_id), 'pedidos', 'Check-in feito: o atendimento começou', null, '#conversa-' || s.pedido_id, null);
  return null;
end $$;

-- checkout por QR: a pessoa atendida lê o QR (ou digita o código) que a página mostra no fim
create or replace function public.tat_checkout_qr(p_sessao uuid, p_codigo text) returns text language plpgsql security definer set search_path to '' as $$
declare s record; c record;
begin
  select * into s from public.tat_sessoes where id = p_sessao for update;
  if not found or s.cliente is distinct from auth.uid() then return 'esta sessão não é sua'; end if;
  if s.checkout_em is not null then return null; end if;
  if s.status <> 'verificada' or not privado.tat_e_tatuagem(s.pagina_id) then return 'o checkout vem depois do check-in'; end if;
  select * into c from privado.tat_codigos where sessao_id = p_sessao for update;
  if c.erros >= 5 then return 'muitas tentativas. Peça para a página mostrar o QR de novo'; end if;
  if regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g') <> c.codigo then
    update privado.tat_codigos set erros = erros + 1 where sessao_id = p_sessao; return 'código errado. Confira na tela da página'; end if;
  perform set_config('arede.checkout', '1', true);
  update public.tat_sessoes set checkout_em = now() where id = p_sessao;
  perform set_config('arede.checkout', '0', true);
  perform privado.tat_cuidados_envia(p_sessao);
  perform privado.notifica(privado.dona_pagina(s.pagina_id), 'pedidos', 'Checkout feito', 'Registre o valor pago na conversa.', '#conversa-' || s.pedido_id, null);
  return null;
end $$;
revoke all on function public.tat_checkout_qr(uuid, text) from public, anon;
grant execute on function public.tat_checkout_qr(uuid, text) to authenticated;

-- checkout automático, 8 h depois do check-in, se ninguém fez
create or replace function privado.tat_checkout_auto() returns int language plpgsql security definer set search_path to '' as $$
declare r record; n int := 0;
begin
  for r in select s.id, s.pagina_id, s.pedido_id from public.tat_sessoes s join public.pagina_tatuagem t on t.pagina_id = s.pagina_id and t.modelo = 'tatuagem'
           where s.status = 'verificada' and s.checkout_em is null and s.checkin_em < now() - make_interval(hours => privado.param_int('tat_checkout_horas', 8)) limit 200 loop
    perform set_config('arede.checkout', '1', true);
    update public.tat_sessoes set checkout_em = now() where id = r.id and checkout_em is null;
    perform set_config('arede.checkout', '0', true);
    perform privado.tat_cuidados_envia(r.id);
    perform privado.notifica(privado.dona_pagina(r.pagina_id), 'pedidos', 'Checkout automático', 'Registre o valor pago na conversa.', '#conversa-' || r.pedido_id, null);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function privado.tat_fichas_expira() returns int language sql security definer set search_path to '' as $$
  with d as (delete from public.tat_fichas where apaga_em < now() returning 1) select count(*)::int from d $$;

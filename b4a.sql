-- =====================================================================
-- Resultados VNS – Laudos de microbiologia do solo (B4A / BioScan)
-- Rode uma vez no SQL Editor do Supabase (depois do schema.sql).
-- =====================================================================

-- Um registro por laudo (talhão + padrão + amostra AH/R).
-- "dados" guarda o conteúdo do laudo: índice, categorias, pontos fortes/fracos,
-- itens (status e %), proporções dos gráficos e a lista de biodiversidade.
create table if not exists public.laudos_b4a (
  id             bigint generated always as identity primary key,
  identificacao  text not null,
  estado         text,
  cliente        text,
  fazenda        text,
  talhao         text,
  padrao         text,
  amostra        text not null default 'AH' check (amostra in ('AH','R')),
  safra          text,
  dados          jsonb not null,
  criado_por     uuid references auth.users(id) default auth.uid(),
  criado_em      timestamptz not null default now()
);
create index if not exists laudos_b4a_cliente_idx on public.laudos_b4a (cliente);

alter table public.laudos_b4a enable row level security;

-- Mesmas regras das amostras: admin e equipe veem e gravam; cliente vê só os próprios laudos
drop policy if exists "laudos_b4a: ver" on public.laudos_b4a;
create policy "laudos_b4a: ver" on public.laudos_b4a for select to authenticated
  using (
    public.papel_atual() in ('admin','equipe')
    or (cliente is not null and cliente = public.cliente_atual())
  );
drop policy if exists "laudos_b4a: equipe grava" on public.laudos_b4a;
create policy "laudos_b4a: equipe grava" on public.laudos_b4a for insert to authenticated
  with check (public.papel_atual() in ('admin','equipe'));
drop policy if exists "laudos_b4a: equipe exclui" on public.laudos_b4a;
create policy "laudos_b4a: equipe exclui" on public.laudos_b4a for delete to authenticated
  using (public.papel_atual() in ('admin','equipe'));

-- Grava uma lista de laudos de uma vez (tudo ou nada).
-- Um laudo com a mesma identificação, cliente e amostra já salvo é substituído.
create or replace function public.salvar_laudos_b4a(p_laudos jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare n integer;
begin
  if coalesce(public.papel_atual(), '') not in ('admin','equipe') then
    raise exception 'Sem permissão para salvar laudos';
  end if;
  delete from public.laudos_b4a l
   using jsonb_array_elements(p_laudos) as x(j)
   where l.identificacao = x.j->>'identificacao'
     and l.amostra = coalesce(x.j->>'amostra', 'AH')
     and l.cliente is not distinct from nullif(x.j->>'cliente', '');
  insert into public.laudos_b4a (identificacao, estado, cliente, fazenda, talhao, padrao, amostra, safra, dados)
  select x.j->>'identificacao', nullif(x.j->>'estado', ''), nullif(x.j->>'cliente', ''), nullif(x.j->>'fazenda', ''),
         nullif(x.j->>'talhao', ''), nullif(x.j->>'padrao', ''), coalesce(x.j->>'amostra', 'AH'), nullif(x.j->>'safra', ''), x.j->'dados'
    from jsonb_array_elements(p_laudos) as x(j);
  get diagnostics n = row_count;
  return n;
end
$$;
grant execute on function public.salvar_laudos_b4a(jsonb) to authenticated;

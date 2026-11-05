-- =====================================================================
-- Resultados VNS – Grower Consultoria Agronômica
-- Estrutura do banco no Supabase (rode tudo de uma vez no SQL Editor)
-- =====================================================================

-- ---------- Perfis de acesso ----------
-- papel: 'admin'  -> vê tudo, salva e exclui bases, gerencia perfis
--        'equipe' -> vê tudo e salva bases
--        'cliente'-> vê só as amostras do próprio cliente (coluna "cliente")
create table if not exists public.perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  papel      text not null default 'cliente' check (papel in ('admin','equipe','cliente')),
  cliente    text,             -- igual ao "Nome cliente" da planilha (ex.: Carolino)
  criado_em  timestamptz not null default now()
);

-- ---------- Bases importadas (uma por planilha salva) ----------
create table if not exists public.importacoes (
  id          bigint generated always as identity primary key,
  arquivo     text,
  aba         text,
  safra       text,
  cabecalho   jsonb not null,  -- lista com os nomes das colunas, na ordem da planilha
  criado_por  uuid references auth.users(id) default auth.uid(),
  criado_em   timestamptz not null default now()
);

-- ---------- Amostras (uma linha por ponto) ----------
create table if not exists public.amostras (
  id             bigint generated always as identity primary key,
  importacao_id  bigint not null references public.importacoes(id) on delete cascade,
  ordem          int not null,
  estado         text,
  cliente        text,
  fazenda        text,
  talhao         text,
  ponto          text,
  padrao         text,
  safra          text,
  valores        jsonb not null  -- valores da linha, na mesma ordem do cabeçalho
);
create index if not exists amostras_importacao_idx on public.amostras (importacao_id, ordem);
create index if not exists amostras_cliente_idx on public.amostras (cliente);

-- ---------- Referências de cores (editáveis sem mexer no código) ----------
create table if not exists public.referencias (
  id             text primary key,   -- 'biologica' ou 'foliar'
  nome           text,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

-- ---------- Funções auxiliares (papel e cliente de quem está logado) ----------
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;
create or replace function public.cliente_atual() returns text
language sql stable security definer set search_path = public as $$
  select cliente from public.perfis where id = auth.uid()
$$;

-- ---------- Cria o perfil automaticamente quando um usuário é convidado/criado ----------
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email))
  on conflict (id) do nothing;
  return new;
end
$$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- ---------- Segurança (RLS) ----------
alter table public.perfis      enable row level security;
alter table public.importacoes enable row level security;
alter table public.amostras    enable row level security;
alter table public.referencias enable row level security;

drop policy if exists "perfis: ver" on public.perfis;
create policy "perfis: ver" on public.perfis for select to authenticated
  using (id = auth.uid() or public.papel_atual() = 'admin');
drop policy if exists "perfis: admin altera" on public.perfis;
create policy "perfis: admin altera" on public.perfis for update to authenticated
  using (public.papel_atual() = 'admin') with check (public.papel_atual() = 'admin');

drop policy if exists "importacoes: ver" on public.importacoes;
create policy "importacoes: ver" on public.importacoes for select to authenticated
  using (
    public.papel_atual() in ('admin','equipe')
    or exists (select 1 from public.amostras a
               where a.importacao_id = importacoes.id
                 and a.cliente is not null
                 and a.cliente = public.cliente_atual())
  );
drop policy if exists "importacoes: equipe grava" on public.importacoes;
create policy "importacoes: equipe grava" on public.importacoes for insert to authenticated
  with check (public.papel_atual() in ('admin','equipe'));
drop policy if exists "importacoes: admin exclui" on public.importacoes;
create policy "importacoes: admin exclui" on public.importacoes for delete to authenticated
  using (public.papel_atual() = 'admin');

drop policy if exists "amostras: ver" on public.amostras;
create policy "amostras: ver" on public.amostras for select to authenticated
  using (
    public.papel_atual() in ('admin','equipe')
    or (cliente is not null and cliente = public.cliente_atual())
  );
drop policy if exists "amostras: equipe grava" on public.amostras;
create policy "amostras: equipe grava" on public.amostras for insert to authenticated
  with check (public.papel_atual() in ('admin','equipe'));
drop policy if exists "amostras: admin exclui" on public.amostras;
create policy "amostras: admin exclui" on public.amostras for delete to authenticated
  using (public.papel_atual() = 'admin');

drop policy if exists "referencias: ver" on public.referencias;
create policy "referencias: ver" on public.referencias for select to authenticated using (true);
drop policy if exists "referencias: admin grava" on public.referencias;
create policy "referencias: admin grava" on public.referencias for all to authenticated
  using (public.papel_atual() = 'admin') with check (public.papel_atual() = 'admin');

-- ---------- Salvar uma planilha inteira de uma vez (tudo ou nada) ----------
create or replace function public.salvar_importacao(
  p_arquivo text, p_aba text, p_safra text, p_cabecalho jsonb, p_linhas jsonb
) returns bigint
language plpgsql security invoker set search_path = public as $$
declare v_id bigint;
begin
  if coalesce(public.papel_atual(), '') not in ('admin','equipe') then
    raise exception 'Sem permissão para salvar dados';
  end if;
  insert into public.importacoes (arquivo, aba, safra, cabecalho)
  values (p_arquivo, p_aba, nullif(p_safra, ''), p_cabecalho)
  returning id into v_id;
  insert into public.amostras (importacao_id, ordem, estado, cliente, fazenda, talhao, ponto, padrao, safra, valores)
  select v_id, (x.ord - 1)::int,
         x.l->>'estado', x.l->>'cliente', x.l->>'fazenda', x.l->>'talhao', x.l->>'ponto', x.l->>'padrao',
         nullif(p_safra, ''), x.l->'valores'
  from jsonb_array_elements(p_linhas) with ordinality as x(l, ord);
  return v_id;
end
$$;
grant execute on function public.salvar_importacao(text, text, text, jsonb, jsonb) to authenticated;

-- ---------- Referências iniciais ----------
-- padrao = expressão aplicada ao nome do atributo (sem o prefixo AH-/R-)
-- limites = limite superior de cada classe; escala: solo, m (m%) ou indice (IQS a Suprimento)
insert into public.referencias (id, nome, dados) values
('biologica', 'Referência Grower (solo) e Referência Embrapa (índices)', $json$[
 {
  "padrao": "^(iqs|ciclagem|armaz|suprimento)",
  "limites": [
   0.2,
   0.4,
   0.6,
   0.8
  ],
  "escala": "indice"
 },
 {
  "padrao": "^p\\s*\\(",
  "limites": [
   8,
   15,
   21,
   35,
   50
  ],
  "escala": "solo"
 },
 {
  "padrao": "^k\\s*\\(\\s*mg",
  "limites": [
   40,
   60,
   80,
   120,
   150
  ],
  "escala": "solo"
 },
 {
  "padrao": "^k\\s*\\(\\s*cmol",
  "limites": [
   0.1,
   0.15,
   0.21,
   0.31,
   0.38
  ],
  "escala": "solo"
 },
 {
  "padrao": "^ca\\s*\\(",
  "limites": [
   0.5,
   2,
   3.5,
   5,
   6.5
  ],
  "escala": "solo"
 },
 {
  "padrao": "^mg\\s*\\(",
  "limites": [
   0.2,
   0.5,
   1,
   1.5,
   2
  ],
  "escala": "solo"
 },
 {
  "padrao": "^s\\s*\\(",
  "limites": [
   5,
   7,
   10,
   15,
   20
  ],
  "escala": "solo"
 },
 {
  "padrao": "^mn\\b",
  "limites": [
   2,
   3.5,
   5,
   10,
   50
  ],
  "escala": "solo"
 },
 {
  "padrao": "^zn\\b",
  "limites": [
   0.4,
   0.8,
   1.6,
   3.2,
   6.4
  ],
  "escala": "solo"
 },
 {
  "padrao": "^cu\\b",
  "limites": [
   0.2,
   0.4,
   0.8,
   1.6,
   3.2
  ],
  "escala": "solo"
 },
 {
  "padrao": "^b\\s*\\(",
  "limites": [
   0.25,
   0.5,
   0.75,
   1,
   1.25
  ],
  "escala": "solo"
 },
 {
  "padrao": "^ph\\b",
  "limites": [
   4.4,
   4.8,
   5.5,
   5.8,
   6.5
  ],
  "escala": "solo"
 },
 {
  "padrao": "^ctc\\b",
  "limites": [
   4,
   6,
   7,
   8,
   9
  ],
  "escala": "solo"
 },
 {
  "padrao": "^v\\s*\\(?\\s*%",
  "limites": [
   20,
   40,
   60,
   70,
   90
  ],
  "escala": "solo"
 },
 {
  "padrao": "^m\\s*%",
  "limites": [
   1,
   5,
   10,
   20,
   40
  ],
  "escala": "m"
 }
]$json$::jsonb),
('foliar', 'Níveis críticos foliares – soja, Safra 24/25 (Grower, 2025)', $json$[
 {
  "padrao": "^n$",
  "limites": [
   38.7,
   48.4,
   55.6
  ]
 },
 {
  "padrao": "^p$",
  "limites": [
   2.4,
   3.6,
   4.5
  ]
 },
 {
  "padrao": "^k$",
  "limites": [
   19.3,
   24.8,
   30.3
  ]
 },
 {
  "padrao": "^ca$",
  "limites": [
   6.4,
   11.3,
   14.9
  ]
 },
 {
  "padrao": "^mg$",
  "limites": [
   3.6,
   4,
   5.1
  ]
 },
 {
  "padrao": "^s$",
  "limites": [
   2.2,
   3,
   3.7
  ]
 },
 {
  "padrao": "^b$",
  "limites": [
   36.1,
   46.4,
   61.9
  ]
 },
 {
  "padrao": "^cu$",
  "limites": [
   7.3,
   10.1,
   13.4
  ]
 },
 {
  "padrao": "^fe$",
  "limites": [
   91.4,
   130.5,
   156.7
  ]
 },
 {
  "padrao": "^mn$",
  "limites": [
   42.5,
   58.9,
   78.5
  ]
 },
 {
  "padrao": "^zn$",
  "limites": [
   30.9,
   42.9,
   59.5
  ]
 }
]$json$::jsonb)
on conflict (id) do update set nome = excluded.nome, dados = excluded.dados, atualizado_em = now();

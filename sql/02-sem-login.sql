-- =====================================================================
-- Mats Flex - Sincronização sem login
-- Rodar uma vez no SQL Editor, depois do 01-etapa1.sql.
-- Rodar de novo não estraga nada.
--
-- O app não tem usuário por enquanto. Ele fala com o banco só pelas quatro
-- funções abaixo, levando um código fixo (src/config.js). A tabela continua
-- fechada para acesso direto.
-- =====================================================================

-- 1. A linha da barbearia deixa de exigir um usuário dono.
alter table public.barbearia alter column dono drop not null;

-- 2. TRAVA: a tabela tem no máximo uma linha.
alter table public.barbearia
  add column if not exists unica boolean not null default true check (unica);
create unique index if not exists barbearia_unica on public.barbearia (unica);

-- 3. Histórico, para voltar no tempo. RLS ligado e nenhuma política:
--    de fora ninguém lê nem grava, só as funções daqui.
create table if not exists public.barbearia_historico (
  id              bigint generated always as identity primary key,
  versao          bigint not null,
  dados           jsonb not null,
  atualizado_em   timestamptz not null,
  atualizado_por  text not null,
  guardado_em     timestamptz not null default now()
);
alter table public.barbearia_historico enable row level security;

-- 4. O gatilho de versão passa a guardar a versão que vai ser substituída
--    quando quem grava é outro aparelho, ou quando a última cópia tem mais
--    de 10 minutos. Ficam as 60 mais recentes. Assim o lado que perde na
--    primeira conexão não some do histórico com as gravações seguintes.
create or replace function public.barbearia_versao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.atualizado_por is distinct from new.atualizado_por
     or not exists (select 1 from public.barbearia_historico h
                    where h.guardado_em > now() - interval '10 minutes') then
    insert into public.barbearia_historico (versao, dados, atualizado_em, atualizado_por)
      values (old.versao, old.dados, old.atualizado_em, old.atualizado_por);
    delete from public.barbearia_historico
      where id <= (select h.id from public.barbearia_historico h order by h.id desc offset 60 limit 1);
  end if;
  new.versao        := old.versao + 1;
  new.atualizado_em := now();
  new.dono          := old.dono;
  return new;
end $$;

-- 5. Código de acesso. Aqui fica só o resumo (sha256) do código que está
--    em src/config.js. Para trocar: gerar outro código, pôr em config.js,
--    pôr o resumo novo aqui e rodar este bloco de novo.
create or replace function public.mf_ok(p_codigo text)
returns boolean language sql immutable as $$
  select encode(sha256(convert_to(coalesce(p_codigo, ''), 'UTF8')), 'hex')
       = '3fd7211bc9c233e76fec09938054ff952093e266d934a7cbe125671d63d37f3e'
$$;
revoke all on function public.mf_ok(text) from public, anon, authenticated;

-- 6. As quatro portas do app. Código errado é recusado com erro.
--    TRAVA: não existe função de apagar.

-- Só o número da versão (null = banco vazio). É a conferência frequente.
create or replace function public.mf_versao(p_codigo text)
returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mf_ok(p_codigo) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return (select b.versao from public.barbearia b limit 1);
end $$;

-- O retrato inteiro (zero ou uma linha).
create or replace function public.mf_ler(p_codigo text)
returns table (versao bigint, dados jsonb, atualizado_em timestamptz, atualizado_por text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mf_ok(p_codigo) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
    select b.versao, b.dados, b.atualizado_em, b.atualizado_por from public.barbearia b limit 1;
end $$;

-- Cria a linha só se o banco ainda estiver vazio. null = outro aparelho criou antes.
create or replace function public.mf_criar(p_codigo text, p_dados jsonb, p_origem text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if not public.mf_ok(p_codigo) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  insert into public.barbearia (dados, atualizado_por)
    values (p_dados, coalesce(nullif(p_origem, ''), 'desconhecido'))
    on conflict (unica) do nothing
    returning versao into v;
  return v;
end $$;

-- Grava só se o aparelho partiu da versão atual. null = conflito: o banco já
-- passou dessa versão, e quem está atrasado baixa antes. O número novo quem
-- escolhe é o gatilho.
create or replace function public.mf_gravar(p_codigo text, p_dados jsonb, p_base bigint, p_origem text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if not public.mf_ok(p_codigo) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  update public.barbearia b
    set dados = p_dados, atualizado_por = coalesce(nullif(p_origem, ''), 'desconhecido')
    where b.versao = p_base
    returning b.versao into v;
  return v;
end $$;

revoke all on function public.mf_versao(text) from public;
revoke all on function public.mf_ler(text) from public;
revoke all on function public.mf_criar(text, jsonb, text) from public;
revoke all on function public.mf_gravar(text, jsonb, bigint, text) from public;
grant execute on function public.mf_versao(text) to anon, authenticated;
grant execute on function public.mf_ler(text) to anon, authenticated;
grant execute on function public.mf_criar(text, jsonb, text) to anon, authenticated;
grant execute on function public.mf_gravar(text, jsonb, bigint, text) to anon, authenticated;

-- Avisa a API que existem funções novas.
notify pgrst, 'reload schema';

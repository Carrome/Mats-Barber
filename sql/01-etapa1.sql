-- =====================================================================
-- Mats Flex - Etapa 1
-- Rodar uma vez no SQL Editor do painel do projeto.
-- =====================================================================

create table if not exists public.barbearia (
  id              uuid primary key default gen_random_uuid(),
  dono            uuid not null unique references auth.users (id) on delete restrict,
  dados           jsonb not null,
  versao          bigint not null default 1,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text not null default 'desconhecido'
);

alter table public.barbearia enable row level security;

-- Cada dono enxerga e mexe apenas na própria linha.
drop policy if exists "dono le" on public.barbearia;
create policy "dono le"    on public.barbearia for select using (auth.uid() = dono);
drop policy if exists "dono cria" on public.barbearia;
create policy "dono cria"  on public.barbearia for insert with check (auth.uid() = dono);
drop policy if exists "dono grava" on public.barbearia;
create policy "dono grava" on public.barbearia for update
  using (auth.uid() = dono) with check (auth.uid() = dono);

-- TRAVA: não existe política de delete. O app não consegue apagar a linha,
-- nem por defeito, nem por chamada manual com a chave pública.

-- TRAVA: a versão sobe de um em um, decidido pelo servidor. O app não
-- escolhe o número, então não tem como forjar uma base que já passou.
create or replace function public.barbearia_versao()
returns trigger language plpgsql as $$
begin
  new.versao        := old.versao + 1;
  new.atualizado_em := now();
  new.dono          := old.dono;
  return new;
end $$;

drop trigger if exists barbearia_versao on public.barbearia;
create trigger barbearia_versao
  before update on public.barbearia
  for each row execute function public.barbearia_versao();

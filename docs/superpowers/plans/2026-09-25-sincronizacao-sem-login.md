# Sincronização sem login – plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O celular do Matheus e o do dono do projeto ficam com os mesmos dados, sem login, com os dados reais do Matheus prevalecendo na primeira conexão.

**Architecture:** O banco expõe quatro funções `security definer` (`mf_versao`, `mf_ler`, `mf_criar`, `mf_gravar`) que conferem um código fixo do app; a tabela continua fechada para acesso direto. No app, `nuvem.js` chama essas funções, `sincronia.js` guarda a marca e as decisões puras, e um hook novo (`sincronizar.js`) cuida de enviar, conferir e baixar. `App.jsx` só liga o hook.

**Tech Stack:** React 18, Vite 5, Vitest 2 + Testing Library (jsdom), `@supabase/supabase-js` 2, PostgreSQL 15 (Supabase).

**Spec:** `docs/superpowers/specs/2026-09-25-sincronizacao-sem-login-design.md`

## Global Constraints

- Não aparece "Supabase" nem "nuvem gratuita" para o Matheus em nenhum texto do app.
- A chave `service_role` nunca entra no app, no repositório nem no chat. SQL é rodado pelo dono no SQL Editor.
- Só o uso real sincroniza; o modo teste (`db.teste === true`) nunca chama nenhuma função de `nuvem.js`.
- `STORE_KEY` (`matts-flex-app-v1`), o id de campanha `mattsflex` e o cache do SW não mudam de nome.
- `EXIGIR_LOGIN` continua `false`.
- `dist/` é versionada: depois de mudar `src/`, rodar `npm run build` e commitar `dist/` junto.
- Código de acesso: `6f3597c3122adf0c7c91c834020cb0afd1cd947b708a3df0`; sha256: `3fd7211bc9c233e76fec09938054ff952093e266d934a7cbe125671d63d37f3e`.

---

### Task 1: Funções e histórico no banco

**Files:**
- Create: `sql/02-sem-login.sql`
- Modify: `sql/LEIA-ME.md`
- Modify: `src/config.js`, `src/config.test.js`

**Interfaces:**
- Produces: funções `mf_versao(p_codigo text) → bigint|null`, `mf_ler(p_codigo text) → setof (versao, dados, atualizado_em, atualizado_por)`, `mf_criar(p_codigo, p_dados jsonb, p_origem text) → bigint|null`, `mf_gravar(p_codigo, p_dados jsonb, p_base bigint, p_origem text) → bigint|null`. `CODIGO_SYNC` exportado de `src/config.js`.

- [ ] **Step 1: Teste que liga o código do app ao resumo do SQL** (em `src/config.test.js`)

```js
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CODIGO_SYNC } from "./config.js";

it("o código de sincronia é longo e bate com o resumo gravado no SQL", () => {
  expect(CODIGO_SYNC).toMatch(/^[0-9a-f]{48}$/);
  const sql = readFileSync(new URL("../sql/02-sem-login.sql", import.meta.url), "utf8");
  const resumo = createHash("sha256").update(CODIGO_SYNC, "utf8").digest("hex");
  expect(sql).toContain(`'${resumo}'`);
});
```

- [ ] **Step 2:** `npx vitest run src/config.test.js` → FAIL (`CODIGO_SYNC` indefinido).
- [ ] **Step 3:** Acrescentar `CODIGO_SYNC` em `src/config.js` e reescrever o comentário do topo (os valores deixam de depender de sessão). Criar `sql/02-sem-login.sql`:

```sql
-- 1. dono deixa de ser obrigatório
alter table public.barbearia alter column dono drop not null;
-- 2. TRAVA: no máximo uma linha
alter table public.barbearia add column if not exists unica boolean not null default true check (unica);
create unique index if not exists barbearia_unica on public.barbearia (unica);
-- 3. histórico, RLS sem políticas
create table if not exists public.barbearia_historico (...);
alter table public.barbearia_historico enable row level security;
-- 4. gatilho de versão guarda a versão substituída quando muda o aparelho
--    ou a última cópia tem mais de 10 min; mantém 60
create or replace function public.barbearia_versao() ... security definer ...
-- 5. mf_ok(p_codigo) compara sha256 com o resumo; revoke de public/anon/authenticated
-- 6. mf_versao, mf_ler, mf_criar (on conflict (unica) do nothing), mf_gravar (where versao = p_base)
--    todas: plpgsql, security definer, set search_path = public,
--    raise exception 'acesso negado' using errcode = '42501' com código errado
-- 7. revoke all from public; grant execute to anon, authenticated; notify pgrst, 'reload schema'
```

(O arquivo final tem o SQL completo, idempotente, comentado em português.)

- [ ] **Step 4:** Atualizar `sql/LEIA-ME.md` com a seção `02-sem-login.sql` (o que faz, que roda depois do 01, que não precisa de usuário).
- [ ] **Step 5:** `npx vitest run src/config.test.js` → PASS. Commit.

---

### Task 2: `nuvem.js` fala pelas funções

**Files:** Modify `src/nuvem.js:52-94`, `src/nuvem.test.js:1-3,101-267`

**Interfaces:**
- Consumes: `CODIGO_SYNC`.
- Produces:
  - `versaoNuvem() → { versao: number|null } | { versao: null, erro }`
  - `lerNuvem() → { existe, versao, dados, em } | {…, erro}` (mesmo formato de antes)
  - `criarNuvem(dados, origem) → { ok: true, versao } | { ok: false, existe: true } | { ok: false, erro }`
  - `gravarNuvem(dados, versaoBase, origem) → { ok: true, versao } | { ok: false, conflito: true } | { ok: false, erro }`

- [ ] **Step 1: Testes** – trocar o bloco "retrato da barbearia" (e o `construtorMock`) por testes com `cliente.rpc = vi.fn().mockResolvedValue({ data, error })`:
  - toda chamada leva `{ p_codigo: CODIGO_SYNC, … }` e o nome da função certo;
  - `versaoNuvem`: número; `null` sem erro; erro de rede traduzido; exceção traduzida;
  - `lerNuvem`: linha em array vira `{ existe: true, versao, dados, em }`; array vazio vira `existe:false` **sem** campo `erro`; erro e exceção traduzidos;
  - `criarNuvem`: envia `p_dados`, `p_origem`; `null` vira `{ ok:false, existe:true }`; erro traduzido;
  - `gravarNuvem`: envia `p_base` exato; `null` vira conflito; número vira `{ ok:true, versao }`; erro e exceção traduzidos.
- [ ] **Step 2:** `npx vitest run src/nuvem.test.js` → FAIL.
- [ ] **Step 3:** Implementar com um auxiliar `const chamar = (funcao, args = {}) => cliente.rpc(funcao, { p_codigo: CODIGO_SYNC, ...args });`, sem `.maybeSingle()` (lê `Array.isArray(data) ? data[0] : data`), `Number()` nas versões. Remover `TABELA`. Login fica igual.
- [ ] **Step 4:** PASS. Commit.

---

### Task 3: Decisões puras em `sincronia.js`

**Files:** Modify `src/sincronia.js`, `src/sincronia.test.js`

**Interfaces – Produces:**
- `lerMarca() → { versao, origem, pendente: boolean } | null`
- `gravarMarca(versao, origem, pendente = false)`
- `marcarPendente()` – liga `pendente` numa marca existente; sem marca não faz nada
- `tamanho(db) → número` (clientes + agendamentos + pacotes)
- `decidirAcao({ marca, local, nuvem }) → "sincronizar" | "aguardar" | "criar" | "baixar" | "subir"`
- `origemAparelho() → "iPhone-xxxx" | "Android-xxxx" | "Computador-xxxx"` (id sorteado uma vez, em `matts-flex-aparelho-v1`)
- `textoSync({ fase, ultima }) → string` para Ajustes

- [ ] **Step 1: Testes**
  - marca: grava e lê com `pendente:false`; `marcarPendente` liga sem mudar versão; sem marca não cria.
  - `decidirAcao`: com marca → sincronizar; banco inexistente + aparelho vazio/exemplo → aguardar; banco inexistente + dados → criar; aparelho vazio/exemplo/nulo + banco com dados → baixar; banco com retrato vazio + aparelho com dados → subir; aparelho maior → subir; banco maior → baixar; empate → baixar; aparelho vazio nunca devolve criar nem subir.
  - `origemAparelho` estável entre chamadas e no formato `/^(iPhone|Android|Computador)-[a-z0-9]{4}$/`.
  - `textoSync`: cada fase; "Sincronizado às HH:MM." para hoje; data para outro dia.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Commit.

---

### Task 4: Hook `useSincronia`

**Files:** Create `src/sincronizar.js`, `src/sincronizar.test.jsx`

**Interfaces:**
- Consumes: Tasks 2 e 3; `abrirReal`, `guardarCopiaAnterior` de `dados.js`.
- Produces: `useSincronia({ db, setDb, notify, atrasoEnvio = 3000, intervalo = 30000 }) → { fase, ultima }`, fases `conectando | ok | enviando | pendente | sem-conexao | aguardando`.

Comportamento (spec, seção `sincronizar.js`):
- ativo só com `db && !db.teste`; ao ficar ativo (abrir ou voltar do teste): `base = db` e confere.
- alteração local (db ≠ base) com marca: `marcarPendente`, fase `pendente`, envio 3 s depois (reagenda se houver operação no ar).
- `conferir`: sem marca → primeira conexão (`decidirAcao`); versão igual à marca → envia se pendente; versão nula → limpa marca e refaz a primeira conexão; versão diferente → baixa (`perdeu` = pendente ou db ≠ base).
- `baixar(n, perdeu)`: se perdeu, `guardarCopiaAnterior(local)`; `abrirReal(n.dados)`; marca nova sem pendência; aviso ("Atualizado com o outro celular" ou "O outro celular salvou antes… Recuperar dados anteriores").
- `enviar`: `gravarNuvem(db, marca.versao)`; aceito → base = enviado, marca nova, pendente se mudou durante o envio (e reagenda); conflito → lê e baixa com perdeu; erro → `sem-conexao`.
- gatilhos: `visibilitychange` (visível confere, escondido envia pendência já), `online`, `setInterval(intervalo)` com o app visível.
- nunca age se o db atual for do modo teste, nem de dentro de um timer antigo.

- [ ] **Step 1: Testes** com componente `Palco` (`atrasoEnvio: 20`, `intervalo: 1e6` salvo no teste de intervalo) e `nuvem.js` simulado:
  1. banco vazio + aparelho com dados → `criarNuvem` com os dados, marca versão 1;
  2. banco vazio + aparelho vazio → fase `aguardando`, nada criado, sem marca;
  3. aparelho vazio + banco com 40 → baixa, marca 7, sem cópia anterior;
  4. aparelho 40 × banco 1 → `gravarNuvem(local, 2)`, marca 3, local mantido;
  5. aparelho 2 × banco 40 → baixa, cópia anterior com os 2, aviso;
  6. com marca: alteração sobe com base 3, marca 4 sem pendência;
  7. banco à frente, nada pendente, evento `online` → baixa, aviso "Atualizado…", sem cópia;
  8. colisão → vale o banco, cópia anterior contém a alteração, aviso "salvou antes";
  9. sem internet → `sem-conexao` e pendente; `online` → sobe;
  10. marca pendente ao abrir → sobe na abertura com base 3;
  11. alteração durante o envio → segunda gravação com base 4 contendo a alteração;
  12. envio agendado não sai se o db virou modo teste antes do timer;
  13. intervalo curto confere várias vezes;
  14. modo teste: nenhuma função de `nuvem.js` chamada, marca intocada.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. Commit.

---

### Task 5: Ligar no App e mostrar em Ajustes

**Files:** Modify `src/App.jsx:19-20,39-42,49,73,115-138,182,306`, `src/telas/Ajustes.jsx:5,8,14,52,200-209`, `src/App.test.jsx`

- [ ] **Step 1: Testes** em `App.test.jsx`: mock ganha `versaoNuvem`; "sem sessão e com dados reais, fala com o banco sem login e abre mesmo se a leitura falhar" (`lerNuvem` chamado, `criarNuvem` não); modo teste também não chama `versaoNuvem`/`gravarNuvem`; "Ajustes mostra o estado da sincronização" (offline → "Sem conexão. As alterações são enviadas quando a internet voltar.").
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** App: sai a reconciliação por sessão, `reconciliado` e `escolhaMigracao`; entra `const sync = useSincronia({ db, setDb, notify });` logo depois de `ask`; `sync={sync}` para Ajustes; comentário do `EXIGIR_LOGIN` atualizado. Ajustes: linha `textoSync(sync)` com ícone `RefreshCw` na seção Dados; textos "os dados ficam só neste aparelho" corrigidos.
- [ ] **Step 4:** `npm test` → tudo PASS. Commit.

---

### Task 6: Build, ROADMAP e revisão

- [ ] `npm test` e `npm run build` limpos; commitar `dist/`.
- [ ] ROADMAP: registrar a sincronização sem login em "Em andamento".
- [ ] Revisão do diff inteiro contra o spec.

### Task 7: No ar (com o dono)

- [ ] Dono roda `sql/02-sem-login.sql` no SQL Editor.
- [ ] Conferir com a chave pública: `mf_versao` com o código → `null`; código errado → erro; `select` direto em `barbearia` e `barbearia_historico` → vazio. Nenhuma escrita.
- [ ] Com o OK do dono: merge `supabase-etapa1` → `main` e push (Vercel publica).
- [ ] Matheus abre o app e toca em "Atualizar"; conferir por `mf_ler` que a versão existe e contar clientes/horários (sem imprimir nomes).
- [ ] Dono abre o app no celular dele e confere.

# Sincronização com Supabase — Etapa 1 (fundação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Supabase virar a fonte da verdade dos dados da barbearia, com login
próprio, sincronização nos dois sentidos e trava estrutural contra o aparelho limpo
apagar o banco — mantendo o app funcionando sem internet.

**Architecture:** O `localStorage` continua sendo onde o app lê e grava; nenhuma tela
de negócio muda. Um módulo novo observa o mesmo ponto de salvamento que já existe e
sincroniza o retrato inteiro em `jsonb`, com controle de versão otimista. Uma marca de
sincronia guardada ao lado dos dados diz de qual versão do banco o estado local
descende; sem ela, o caminho de subida não é alcançável.

**Tech Stack:** React 18, Vite 5, Vitest 2, `@supabase/supabase-js` v2, Postgres com
RLS.

**Spec:** `docs/superpowers/specs/2026-09-21-supabase-sincronizacao-design.md`

## Global Constraints

- Endereço do projeto: `https://sgirqynnahnhbbeeqlvf.supabase.co` — **sem** `/rest/v1/`.
- Chave pública: `sb_publishable_o3WZPQz_j1n0fuKYtTC_Hg_OdGJcY4C`.
- Domínio do login interno: `mats-barber.vercel.app`. Usuário `mats` vira
  `mats@mats-barber.vercel.app`.
- A chave `service_role` não entra no repositório, no app, nem em nenhum arquivo.
- **White-label:** as palavras "Supabase", "nuvem gratuita" e nomes de fornecedor não
  aparecem em nenhum texto visível. Use "sincronização", "cópia de segurança" ou
  "conta".
- `STORE_KEY` continua `matts-flex-app-v1`. Não renomear: apaga os dados do aparelho.
- O app precisa continuar abrindo e gravando sem internet. Falha de rede nunca bloqueia
  a interface.
- Testes com `npm test` (Vitest), arquivos `*.test.js(x)` ao lado do código.
- Textos de interface em português do Brasil.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `sql/01-etapa1.sql` | Criar tabela, RLS e gatilho de versão. Rodado à mão no painel. |
| `src/config.js` | Endereço, chave pública e domínio do login. Valores públicos. |
| `src/nuvem.js` | Cliente do Supabase, autenticação e acesso à tabela `barbearia`. |
| `src/sincronia.js` | Marca de sincronia e a decisão de subir, baixar ou perguntar. Puro. |
| `src/telas/Login.jsx` | Tela de entrada white-label. |
| `src/App.jsx` | Ligação: portão de login, carga inicial e disparo da subida. |

`sincronia.js` não importa `nuvem.js` nem React: é lógica pura e testável sem rede.
`nuvem.js` não conhece regra de negócio.

---

### Task 1: Configuração e cliente

**Files:**
- Create: `src/config.js`
- Create: `src/nuvem.js`
- Create: `src/config.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `SUPABASE_URL`, `SUPABASE_KEY`, `DOMINIO_LOGIN` (strings) de `config.js`;
  `cliente` (SupabaseClient) de `nuvem.js`.

- [ ] **Step 1: Instalar a biblioteca**

```bash
npm install @supabase/supabase-js@^2
```

- [ ] **Step 2: Escrever o teste que falha**

`src/config.test.js`:

```js
import { describe, expect, it } from "vitest";
import { DOMINIO_LOGIN, SUPABASE_KEY, SUPABASE_URL } from "./config.js";

describe("configuração", () => {
  it("o endereço não leva o caminho da API REST", () => {
    expect(SUPABASE_URL).toBe("https://sgirqynnahnhbbeeqlvf.supabase.co");
    expect(SUPABASE_URL).not.toContain("/rest/v1");
    expect(SUPABASE_URL.endsWith("/")).toBe(false);
  });

  it("usa a chave pública, nunca a de serviço", () => {
    expect(SUPABASE_KEY.startsWith("sb_publishable_")).toBe(true);
    expect(SUPABASE_KEY).not.toContain("service_role");
  });

  it("o domínio do login é o endereço de publicação", () => {
    expect(DOMINIO_LOGIN).toBe("mats-barber.vercel.app");
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- config`
Expected: FAIL, `Failed to resolve import "./config.js"`

- [ ] **Step 4: Criar a configuração**

`src/config.js`:

```js
/* =====================================================================
   Endereço e chave de acesso ao banco.
   Estes dois valores são públicos por natureza: eles identificam o
   projeto, não a pessoa. Quem decide o que pode ser lido ou gravado são
   as políticas do banco, que exigem sessão iniciada.
   A chave de serviço NUNCA entra aqui.
   ===================================================================== */
export const SUPABASE_URL = "https://sgirqynnahnhbbeeqlvf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_o3WZPQz_j1n0fuKYtTC_Hg_OdGJcY4C";

// O login exige formato de e-mail. O usuário digita só "mats"; este domínio
// completa o endereço. Não existe caixa de entrada do outro lado.
export const DOMINIO_LOGIN = "mats-barber.vercel.app";
```

- [ ] **Step 5: Criar o cliente**

`src/nuvem.js`:

```js
/* =====================================================================
   Acesso ao banco: sessão e leitura/gravação do retrato da barbearia
   ===================================================================== */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config.js";

export const cliente = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npm test -- config`
Expected: PASS, 3 testes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/config.js src/nuvem.js src/config.test.js
git commit -m "Adiciona configuracao e cliente de acesso ao banco"
```

---

### Task 2: Tabela, políticas e gatilho de versão

**Files:**
- Create: `sql/01-etapa1.sql`
- Create: `sql/LEIA-ME.md`

Esta task não tem teste automático: o resultado vive no banco. A verificação é manual
e está no passo 4.

- [ ] **Step 1: Escrever o SQL**

`sql/01-etapa1.sql`:

```sql
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
create policy "dono le"    on public.barbearia for select using (auth.uid() = dono);
create policy "dono cria"  on public.barbearia for insert with check (auth.uid() = dono);
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
```

- [ ] **Step 2: Escrever as instruções**

`sql/LEIA-ME.md`:

```markdown
# SQL do projeto

Rodar em ordem, uma vez cada, no **SQL Editor** do painel do projeto.

## 01-etapa1.sql

Cria a tabela `barbearia`, liga as políticas de acesso e o gatilho de versão.

### Antes de rodar

No painel, em **Authentication → Providers → Email**, desligue **Confirm email**.
Sem isso o cadastro fica pendente de um e-mail que nunca será lido.

### Depois de rodar

Em **Authentication → Users → Add user**, crie o usuário do Matheus:

- E-mail: `mats@mats-barber.vercel.app`
- Senha: a combinada
- **Auto Confirm User: marcado**

Guarde o `User UID` que aparece na lista: o app usa ele na primeira gravação.
```

- [ ] **Step 3: Rodar no painel**

Abrir o SQL Editor do projeto, colar `sql/01-etapa1.sql`, executar. Em seguida seguir
o `LEIA-ME.md`: desligar a confirmação por e-mail e criar o usuário.

- [ ] **Step 4: Conferir que as travas pegaram**

No SQL Editor:

```sql
select tablename, policyname, cmd from pg_policies where tablename = 'barbearia';
```

Expected: três linhas, com `cmd` valendo `SELECT`, `INSERT` e `UPDATE`.
**Nenhuma linha com `DELETE`** — é isso que confirma a trava.

- [ ] **Step 5: Commit**

```bash
git add sql/01-etapa1.sql sql/LEIA-ME.md
git commit -m "Adiciona SQL da tabela da barbearia com politicas e gatilho de versao"
```

---

### Task 3: A decisão de sincronia

O coração da etapa. Decide, sem rede e sem efeito colateral, se o aparelho sobe, baixa
ou pergunta. Testado à exaustão porque é a trava contra perda de dados.

**Files:**
- Create: `src/sincronia.js`
- Create: `src/sincronia.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `MARCA_KEY: string`
  - `lerMarca(): { versao: number, origem: string } | null`
  - `gravarMarca(versao: number, origem: string): void`
  - `limparMarca(): void`
  - `ehVazio(db: object|null): boolean`
  - `decidirAcao({ marca, local, nuvem }): "criar"|"baixar"|"perguntar"|"sincronizar"`
    onde `local` é o `db` e `nuvem` é `{ existe: boolean, versao: number|null }`.
    Nunca devolve `"subir"`: não existe subida sem marca, e com marca a ação é
    `"sincronizar"`. O teste que afirma isso é a guarda da trava.

- [ ] **Step 1: Escrever os testes que falham**

`src/sincronia.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";
import { decidirAcao, ehVazio, gravarMarca, lerMarca, limparMarca, MARCA_KEY } from "./sincronia.js";
import { baseVazia } from "./dados.js";

const comDados = () => {
  const d = baseVazia();
  d.clientes.push({ id: "c1", nome: "João", telefone: "" });
  d.agendamentos.push({ id: "a1", data: "2026-09-21", hora: "09:00", tipo: "avulso", valor: 45, status: "agendado" });
  return d;
};

describe("ehVazio", () => {
  it("base recém-criada é vazia", () => {
    expect(ehVazio(baseVazia())).toBe(true);
  });

  it("nulo é vazio", () => {
    expect(ehVazio(null)).toBe(true);
  });

  it("dados de exemplo contam como vazio mesmo cheios de cliente", () => {
    const d = comDados();
    d.demo = true;
    expect(ehVazio(d)).toBe(true);
  });

  it("dados reais não são vazios", () => {
    expect(ehVazio(comDados())).toBe(false);
  });
});

describe("decidirAcao", () => {
  it("com marca, segue a sincronização normal", () => {
    const acao = decidirAcao({ marca: { versao: 7, origem: "celular" }, local: comDados(), nuvem: { existe: true, versao: 7 } });
    expect(acao).toBe("sincronizar");
  });

  it("banco ainda não existe: cria a partir do aparelho", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: false, versao: null } });
    expect(acao).toBe("criar");
  });

  // TRAVA PRINCIPAL
  it("aparelho limpo e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: baseVazia(), nuvem: { existe: true, versao: 12 } });
    expect(acao).toBe("baixar");
  });

  it("aparelho com dados de exemplo e banco com dados: só baixa", () => {
    const d = comDados();
    d.demo = true;
    const acao = decidirAcao({ marca: null, local: d, nuvem: { existe: true, versao: 12 } });
    expect(acao).toBe("baixar");
  });

  it("aparelho sem dados nenhum e banco com dados: só baixa", () => {
    const acao = decidirAcao({ marca: null, local: null, nuvem: { existe: true, versao: 3 } });
    expect(acao).toBe("baixar");
  });

  it("os dois lados com dados reais e sem marca: pergunta, nunca decide sozinho", () => {
    const acao = decidirAcao({ marca: null, local: comDados(), nuvem: { existe: true, versao: 4 } });
    expect(acao).toBe("perguntar");
  });

  it("nunca devolve subir quando não há marca e o banco tem dados", () => {
    for (const local of [null, baseVazia(), comDados()]) {
      const acao = decidirAcao({ marca: null, local, nuvem: { existe: true, versao: 9 } });
      expect(acao).not.toBe("subir");
    }
  });
});

describe("marca de sincronia", () => {
  beforeEach(() => window.localStorage.clear());

  it("começa sem marca", () => {
    expect(lerMarca()).toBe(null);
  });

  it("grava e lê de volta", () => {
    gravarMarca(5, "celular");
    expect(lerMarca()).toEqual({ versao: 5, origem: "celular" });
  });

  it("limpar apaga", () => {
    gravarMarca(5, "celular");
    limparMarca();
    expect(lerMarca()).toBe(null);
  });

  it("marca corrompida é tratada como ausente", () => {
    window.localStorage.setItem(MARCA_KEY, "{isso não é json");
    expect(lerMarca()).toBe(null);
  });

  it("não usa a mesma chave dos dados do app", () => {
    expect(MARCA_KEY).not.toBe("matts-flex-app-v1");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- sincronia`
Expected: FAIL, `Failed to resolve import "./sincronia.js"`

- [ ] **Step 3: Implementar**

`src/sincronia.js`:

```js
/* =====================================================================
   Marca de sincronia e a decisão de subir, baixar ou perguntar.

   A marca diz de qual versão do banco o estado do aparelho descende.
   Limpar o armazenamento leva os dados e a marca juntos, e é isso que
   torna a trava confiável: sem marca, a subida automática não existe.
   ===================================================================== */

export const MARCA_KEY = "matts-flex-sync-v1";

export function lerMarca() {
  try {
    const raw = window.localStorage.getItem(MARCA_KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return typeof m?.versao === "number" ? { versao: m.versao, origem: m.origem || "desconhecido" } : null;
  } catch (e) {
    return null;
  }
}

export function gravarMarca(versao, origem) {
  try {
    window.localStorage.setItem(MARCA_KEY, JSON.stringify({ versao, origem }));
  } catch (e) { /* armazenamento cheio: a próxima sincronização tenta de novo */ }
}

export function limparMarca() {
  try { window.localStorage.removeItem(MARCA_KEY); } catch (e) { /* ignora */ }
}

// Dados de exemplo contam como vazio: eles nascem sozinhos numa instalação
// nova (ver abrirDados em dados.js) e não podem valer mais que o banco.
export function ehVazio(db) {
  if (!db) return true;
  if (db.demo) return true;
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return n(db.clientes) === 0 && n(db.agendamentos) === 0 && n(db.pacotes) === 0;
}

export function decidirAcao({ marca, local, nuvem }) {
  if (marca) return "sincronizar";
  if (!nuvem.existe) return "criar";
  // Sem marca o aparelho não tem como provar que descende do banco.
  // Vazio (ou exemplo) baixa; com dados reais, quem decide é gente.
  return ehVazio(local) ? "baixar" : "perguntar";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- sincronia`
Expected: PASS, 15 testes.

- [ ] **Step 5: Commit**

```bash
git add src/sincronia.js src/sincronia.test.js
git commit -m "Adiciona marca de sincronia e a decisao de subir, baixar ou perguntar"
```

---

### Task 4: Autenticação white-label

**Files:**
- Modify: `src/nuvem.js`
- Create: `src/nuvem.test.js`

**Interfaces:**
- Consumes: `cliente` e `DOMINIO_LOGIN`.
- Produces:
  - `emailDe(usuario: string): string`
  - `traduzirErro(erro: object|null): string`
  - `entrar(usuario, senha): Promise<{ ok: boolean, erro?: string }>`
  - `sair(): Promise<void>`
  - `sessaoAtual(): Promise<object|null>`

- [ ] **Step 1: Escrever os testes que falham**

`src/nuvem.test.js`:

```js
import { describe, expect, it } from "vitest";
import { emailDe, traduzirErro } from "./nuvem.js";

describe("endereço interno do login", () => {
  it("completa o usuário com o domínio de publicação", () => {
    expect(emailDe("mats")).toBe("mats@mats-barber.vercel.app");
  });

  it("ignora espaços e maiúsculas digitados sem querer", () => {
    expect(emailDe("  MATS ")).toBe("mats@mats-barber.vercel.app");
  });

  it("se alguém digitar o endereço inteiro, não duplica o domínio", () => {
    expect(emailDe("mats@mats-barber.vercel.app")).toBe("mats@mats-barber.vercel.app");
  });
});

describe("mensagens de erro", () => {
  it("credencial errada vira português comum", () => {
    expect(traduzirErro({ message: "Invalid login credentials" })).toBe("Usuário ou senha incorretos.");
  });

  it("falha de rede avisa que é a internet", () => {
    expect(traduzirErro({ message: "Failed to fetch" })).toBe("Sem conexão com a internet.");
  });

  it("nenhuma mensagem entrega o nome do fornecedor", () => {
    const casos = [{ message: "Invalid login credentials" }, { message: "Failed to fetch" }, { message: "algo muito estranho" }, null];
    for (const c of casos) {
      const txt = traduzirErro(c);
      expect(txt).not.toMatch(/supabase/i);
      expect(txt).not.toMatch(/[a-z]+\.co\b/i);
      expect(txt.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- nuvem`
Expected: FAIL, `emailDe is not a function`

- [ ] **Step 3: Implementar**

Primeiro, trocar a linha de import no topo de `src/nuvem.js` para incluir o domínio
(imports ficam no topo do arquivo, não junto do código novo):

```js
import { DOMINIO_LOGIN, SUPABASE_KEY, SUPABASE_URL } from "./config.js";
```

Depois, acrescentar ao fim de `src/nuvem.js`:

```js
// O Matheus digita só "mats". O formato de e-mail é exigência do login,
// não um endereço de verdade: ninguém envia nada para cá.
export function emailDe(usuario) {
  const u = String(usuario || "").trim().toLowerCase();
  return u.includes("@") ? u : `${u}@${DOMINIO_LOGIN}`;
}

// Mensagens próprias: as originais vêm em inglês e citam o fornecedor.
export function traduzirErro(erro) {
  const m = String(erro?.message || "");
  if (/invalid login credentials/i.test(m)) return "Usuário ou senha incorretos.";
  if (/failed to fetch|network|fetch failed/i.test(m)) return "Sem conexão com a internet.";
  if (/email not confirmed/i.test(m)) return "Esta conta ainda não foi liberada.";
  if (/rate limit|too many/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto.";
  return "Não foi possível entrar agora. Tente de novo.";
}

export async function entrar(usuario, senha) {
  try {
    const { error } = await cliente.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
    return error ? { ok: false, erro: traduzirErro(error) } : { ok: true };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}

export async function sair() {
  try { await cliente.auth.signOut(); } catch (e) { /* offline: a sessão local some no reload */ }
}

// Lê a sessão guardada no aparelho. Funciona sem internet, e é isso que
// deixa o app abrir offline para quem já entrou alguma vez.
export async function sessaoAtual() {
  try {
    const { data } = await cliente.auth.getSession();
    return data?.session || null;
  } catch (e) {
    return null;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- nuvem`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/nuvem.js src/nuvem.test.js
git commit -m "Adiciona entrada com usuario e senha, com mensagens proprias"
```

---

### Task 5: Leitura e gravação do retrato

**Files:**
- Modify: `src/nuvem.js`

**Interfaces:**
- Consumes: `cliente`.
- Produces:
  - `lerNuvem(): Promise<{ existe: boolean, versao: number|null, dados: object|null, em: string|null, erro?: string }>`
    — `em` é a data da última gravação, usada pela tela de escolha da Task 8.
  - `criarNuvem(dados, origem): Promise<{ ok: boolean, versao?: number, erro?: string }>`
  - `gravarNuvem(dados, versaoBase, origem): Promise<{ ok: boolean, versao?: number, conflito?: boolean, erro?: string }>`

- [ ] **Step 1: Implementar**

Acrescentar ao fim de `src/nuvem.js`:

```js
const TABELA = "barbearia";

export async function lerNuvem() {
  const vazio = { existe: false, versao: null, dados: null, em: null };
  try {
    const { data, error } = await cliente.from(TABELA).select("versao, dados, atualizado_em").maybeSingle();
    if (error) return { ...vazio, erro: traduzirErro(error) };
    if (!data) return vazio;
    return { existe: true, versao: data.versao, dados: data.dados, em: data.atualizado_em };
  } catch (e) {
    return { ...vazio, erro: traduzirErro(e) };
  }
}

export async function criarNuvem(dados, origem) {
  try {
    const sessao = await sessaoAtual();
    if (!sessao) return { ok: false, erro: "Sessão encerrada." };
    const { data, error } = await cliente.from(TABELA)
      .insert({ dono: sessao.user.id, dados, atualizado_por: origem })
      .select("versao").single();
    return error ? { ok: false, erro: traduzirErro(error) } : { ok: true, versao: data.versao };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}

// A gravação declara de qual versão partiu. Se o banco já passou dessa
// versão, nada é alterado e devolvemos conflito: quem está atrasado baixa
// antes de insistir. O número novo quem escolhe é o gatilho, no servidor.
export async function gravarNuvem(dados, versaoBase, origem) {
  try {
    const { data, error } = await cliente.from(TABELA)
      .update({ dados, atualizado_por: origem })
      .eq("versao", versaoBase)
      .select("versao");
    if (error) return { ok: false, erro: traduzirErro(error) };
    if (!data || data.length === 0) return { ok: false, conflito: true };
    return { ok: true, versao: data[0].versao };
  } catch (e) {
    return { ok: false, erro: traduzirErro(e) };
  }
}
```

- [ ] **Step 2: Conferir que o projeto ainda compila e os testes passam**

Run: `npm test`
Expected: PASS, tudo verde.

- [ ] **Step 3: Commit**

```bash
git add src/nuvem.js
git commit -m "Adiciona leitura e gravacao do retrato com controle de versao"
```

---

### Task 6: Tela de login

**Files:**
- Create: `src/telas/Login.jsx`
- Create: `src/telas/Login.test.jsx`

**Interfaces:**
- Consumes: `entrar` de `nuvem.js`, `CSS` de `estilos.js`, `Campo` de `componentes.jsx`.
- Produces: `Login({ onEntrou }): JSX` — chama `onEntrou()` depois de entrar.

- [ ] **Step 1: Escrever os testes que falham**

`src/telas/Login.test.jsx`:

```jsx
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Login } from "./Login.jsx";

vi.mock("../nuvem.js", () => ({ entrar: vi.fn() }));
import { entrar } from "../nuvem.js";

describe("tela de login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não mostra o nome de nenhum fornecedor", () => {
    const { container } = render(<Login onEntrou={() => {}} />);
    expect(container.textContent).not.toMatch(/supabase/i);
    expect(container.textContent).not.toMatch(/nuvem gratuita/i);
  });

  it("pede usuário e senha, não e-mail", () => {
    const { container } = render(<Login onEntrou={() => {}} />);
    expect(screen.getByLabelText(/usuário/i)).toBeTruthy();
    expect(screen.getByLabelText(/senha/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/e-?mail/i);
  });

  it("entrando certo, avisa quem chamou", async () => {
    entrar.mockResolvedValue({ ok: true });
    const onEntrou = vi.fn();
    render(<Login onEntrou={onEntrou} />);
    fireEvent.change(screen.getByLabelText(/usuário/i), { target: { value: "mats" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(onEntrou).toHaveBeenCalled());
    expect(entrar).toHaveBeenCalledWith("mats", "123456");
  });

  it("entrando errado, mostra o recado e não avisa quem chamou", async () => {
    entrar.mockResolvedValue({ ok: false, erro: "Usuário ou senha incorretos." });
    const onEntrou = vi.fn();
    render(<Login onEntrou={onEntrou} />);
    fireEvent.change(screen.getByLabelText(/usuário/i), { target: { value: "mats" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "errada" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/incorretos/i));
    expect(onEntrou).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Login`
Expected: FAIL, `Failed to resolve import "./Login.jsx"`

- [ ] **Step 3: Implementar**

`src/telas/Login.jsx`:

```jsx
/* =====================================================================
   Entrada do app. Usuário e senha; o endereço interno é montado por baixo.
   ===================================================================== */
import React, { useState } from "react";
import { CSS } from "../estilos.js";
import { Campo } from "../componentes.jsx";
import { entrar } from "../nuvem.js";

export function Login({ onEntrou }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (indo) return;
    setIndo(true);
    setErro("");
    const r = await entrar(usuario, senha);
    if (r.ok) onEntrou();
    else { setErro(r.erro); setIndo(false); }
  };

  return (
    <div className="mf">
      <style>{CSS}</style>
      <div className="mf-loading" style={{ flexDirection: "column", gap: 18 }}>
        <img className="mf-logo" src="icons/logo.png" alt="" />
        <span className="dsp" style={{ fontSize: 28 }}>Mats Flex</span>
        <form className="mf-stack" style={{ width: "min(320px, 86vw)", gap: 12 }} onSubmit={enviar}>
          <Campo label="Usuário">
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)}
              autoCapitalize="none" autoCorrect="off" autoComplete="username" />
          </Campo>
          <Campo label="Senha">
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password" />
          </Campo>
          {erro && <div className="mf-alerta" role="alert">{erro}</div>}
          <button className="mf-btn poste" type="submit" disabled={indo || !usuario || !senha}>
            {indo ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- Login`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/telas/Login.jsx src/telas/Login.test.jsx
git commit -m "Adiciona tela de entrada com usuario e senha"
```

---

### Task 7: Portão de login e carga inicial

**Files:**
- Modify: `src/App.jsx:36-64` (estado e efeito de carregar)
- Modify: `src/App.jsx:166-172` (tela de espera)

**Interfaces:**
- Consumes: `sessaoAtual`, `lerNuvem`, `criarNuvem` de `nuvem.js`;
  `decidirAcao`, `gravarMarca`, `lerMarca` de `sincronia.js`; `Login` de `telas/Login.jsx`.
- Produces: estado `sessao` (`null` = ainda checando, `false` = precisa entrar,
  objeto = entrou) e `escolhaMigracao` para o caso "perguntar".

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/App.test.jsx`:

```jsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("./nuvem.js", () => ({
  sessaoAtual: vi.fn(),
  lerNuvem: vi.fn(),
  criarNuvem: vi.fn(),
  gravarNuvem: vi.fn(),
  entrar: vi.fn(),
  sair: vi.fn(),
}));
import { lerNuvem, sessaoAtual } from "./nuvem.js";
import App from "./App.jsx";

describe("portão de login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("sem sessão, mostra a tela de entrada e não o app", async () => {
    sessaoAtual.mockResolvedValue(null);
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: /entrar/i })).toBeTruthy());
    expect(screen.queryByRole("navigation", { name: /menu principal/i })).toBe(null);
  });

  it("com sessão guardada, abre o app mesmo se a leitura da nuvem falhar", async () => {
    sessaoAtual.mockResolvedValue({ user: { id: "u1" } });
    lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, erro: "Sem conexão com a internet." });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation", { name: /menu principal/i })).toBeTruthy());
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- App`
Expected: FAIL — a tela de entrada não aparece; o app abre direto.

- [ ] **Step 3: Acrescentar os imports e o estado**

Em `src/App.jsx`, junto dos outros imports:

```jsx
import { criarNuvem, lerNuvem, sessaoAtual } from "./nuvem.js";
import { decidirAcao, ehVazio, gravarMarca, lerMarca } from "./sincronia.js";
import { Login } from "./telas/Login.jsx";
```

Junto dos outros `useState`:

```jsx
// null = ainda checando, false = precisa entrar, objeto = entrou
const [sessao, setSessao] = useState(null);
const [escolhaMigracao, setEscolhaMigracao] = useState(null);
```

- [ ] **Step 4: Trocar o efeito de carregar**

Substituir a linha `carregar().then((d) => { if (vivo) setDb(abrirDados(d)); });`
em `src/App.jsx:64` por:

```jsx
    (async () => {
      const s = await sessaoAtual();
      if (!vivo) return;
      if (!s) { setSessao(false); return; }
      setSessao(s);
      const local = abrirDados(await carregar());
      if (!vivo) return;

      // Abre com o que tem no aparelho antes de falar com a rede: sem
      // internet o app precisa funcionar do mesmo jeito.
      setDb(local);

      const nuvem = await lerNuvem();
      if (!vivo || nuvem.erro) return;

      const acao = decidirAcao({ marca: lerMarca(), local, nuvem });
      if (acao === "baixar") {
        setDb(migrar(nuvem.dados));
        gravarMarca(nuvem.versao, "celular");
      } else if (acao === "criar") {
        const base = ehVazio(local) ? baseVazia() : local;
        const r = await criarNuvem(base, "celular");
        if (r.ok) { setDb(base); gravarMarca(r.versao, "celular"); }
      } else if (acao === "perguntar") {
        setEscolhaMigracao({ local, nuvem });
      }
    })();
```

- [ ] **Step 5: Acrescentar o portão antes do `if (!db)`**

Em `src/App.jsx`, imediatamente antes de `if (!db) {` (linha 166):

```jsx
  if (sessao === false) return <Login onEntrou={() => window.location.reload()} />;
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- App`
Expected: PASS, os dois testes novos e os que já existiam.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "Exige entrada no app e busca os dados do banco ao abrir"
```

---

### Task 8: Escolha da migração

Cobre o caso `"perguntar"`: aparelho e banco com dados reais e sem marca que ligue os
dois. O app nunca decide sozinho aqui. Antes de qualquer escolha, um backup é baixado.

**Files:**
- Modify: `src/sincronia.js` (acrescentar `resumo`)
- Create: `src/telas/Migracao.jsx`
- Create: `src/telas/Migracao.test.jsx`
- Modify: `src/App.jsx` (renderizar a escolha)

**Interfaces:**
- Consumes: `escolhaMigracao` da Task 7; `fazerBackup` que já existe em
  `src/App.jsx:152`; `gravarNuvem` da Task 5.
- Produces:
  - `resumo(db): { clientes: number, agendamentos: number, pacotes: number }`
  - `Migracao({ local, nuvem, onBackup, onEscolher }): JSX` — chama
    `onEscolher("aparelho")` ou `onEscolher("banco")`.

- [ ] **Step 1: Escrever os testes que falham**

`src/telas/Migracao.test.jsx`:

```jsx
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Migracao } from "./Migracao.jsx";
import { baseVazia } from "../dados.js";

const comClientes = (n) => {
  const d = baseVazia();
  for (let i = 0; i < n; i++) d.clientes.push({ id: `c${i}`, nome: `Cliente ${i}` });
  return d;
};

const props = () => ({
  local: comClientes(3),
  nuvem: { versao: 8, dados: comClientes(41), em: "2026-09-20T18:00:00.000Z" },
  onBackup: vi.fn(),
  onEscolher: vi.fn(),
});

describe("escolha da migração", () => {
  it("baixa um backup sozinho ao abrir", async () => {
    const p = props();
    render(<Migracao {...p} />);
    await waitFor(() => expect(p.onBackup).toHaveBeenCalledTimes(1));
  });

  it("mostra quantos clientes tem de cada lado", () => {
    const { container } = render(<Migracao {...props()} />);
    expect(container.textContent).toMatch(/3 clientes/);
    expect(container.textContent).toMatch(/41 clientes/);
  });

  it("escolher o aparelho avisa quem chamou", () => {
    const p = props();
    render(<Migracao {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /deste aparelho/i }));
    expect(p.onEscolher).toHaveBeenCalledWith("aparelho");
  });

  it("escolher a conta avisa quem chamou", () => {
    const p = props();
    render(<Migracao {...p} />);
    fireEvent.click(screen.getByRole("button", { name: /da conta/i }));
    expect(p.onEscolher).toHaveBeenCalledWith("banco");
  });

  it("não cita fornecedor nenhum", () => {
    const { container } = render(<Migracao {...props()} />);
    expect(container.textContent).not.toMatch(/supabase/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- Migracao`
Expected: FAIL, `Failed to resolve import "./Migracao.jsx"`

- [ ] **Step 3: Acrescentar `resumo` a `src/sincronia.js`**

```js
export function resumo(db) {
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  return { clientes: n(db?.clientes), agendamentos: n(db?.agendamentos), pacotes: n(db?.pacotes) };
}
```

- [ ] **Step 4: Criar a tela**

`src/telas/Migracao.jsx`:

```jsx
/* =====================================================================
   Aparelho e conta têm dados e nada prova qual descende de qual.
   Quem decide é gente. Antes disso, um backup é baixado sozinho.
   ===================================================================== */
import React, { useEffect, useRef } from "react";
import { CSS } from "../estilos.js";
import { resumo } from "../sincronia.js";

const Lado = ({ titulo, quando, db }) => {
  const r = resumo(db);
  return (
    <div className="mf-banner" style={{ display: "block", marginBottom: 0 }}>
      <h3>{titulo}</h3>
      {quando && <p className="sub">{quando}</p>}
      <p>{r.clientes} clientes · {r.agendamentos} horários · {r.pacotes} pacotes</p>
    </div>
  );
};

export function Migracao({ local, nuvem, onBackup, onEscolher }) {
  const jaFez = useRef(false);
  useEffect(() => {
    if (jaFez.current) return;
    jaFez.current = true;
    onBackup();
  }, [onBackup]);

  const quandoNuvem = nuvem.em ? new Date(nuvem.em).toLocaleString("pt-BR") : "";

  return (
    <div className="mf">
      <style>{CSS}</style>
      <div className="mf-wrap mf-stack" style={{ gap: 14, maxWidth: 520, margin: "0 auto", paddingTop: 28 }}>
        <h2>Quais dados valem?</h2>
        <p className="sub">
          Este aparelho e a sua conta têm dados diferentes, e não dá para saber qual é o
          mais novo. Escolha qual fica valendo — o outro será substituído. Um backup
          deste aparelho acabou de ser baixado.
        </p>
        <Lado titulo="Deste aparelho" db={local} />
        <Lado titulo="Da conta" quando={quandoNuvem} db={nuvem.dados} />
        <button className="mf-btn poste" onClick={() => onEscolher("aparelho")}>
          Usar os deste aparelho
        </button>
        <button className="mf-btn" onClick={() => onEscolher("banco")}>
          Usar os da conta
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Ligar no `src/App.jsx`**

Junto dos outros imports:

```jsx
import { Migracao } from "./telas/Migracao.jsx";
```

E **estender** a linha de import de `nuvem.js` que a Task 7 criou, acrescentando
`gravarNuvem`. Nao abrir uma segunda linha do mesmo modulo:

```jsx
import { criarNuvem, gravarNuvem, lerNuvem, sessaoAtual } from "./nuvem.js";
```

Imediatamente antes de `if (!db) {` (depois do portão de login da Task 7):

```jsx
  if (escolhaMigracao) {
    const { local, nuvem } = escolhaMigracao;
    return (
      <Migracao local={local} nuvem={nuvem} onBackup={fazerBackup}
        onEscolher={async (qual) => {
          if (qual === "banco") {
            setDb(migrar(nuvem.dados));
            gravarMarca(nuvem.versao, "celular");
          } else {
            const r = await gravarNuvem(local, nuvem.versao, "celular");
            if (r.ok) gravarMarca(r.versao, "celular");
          }
          setEscolhaMigracao(null);
        }} />
    );
  }
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npm test -- Migracao`
Expected: PASS, 5 testes.

- [ ] **Step 7: Commit**

```bash
git add src/sincronia.js src/telas/Migracao.jsx src/telas/Migracao.test.jsx src/App.jsx
git commit -m "Pergunta quais dados valem quando aparelho e conta divergem"
```

---

### Task 9: Subida automática e indicador

**Files:**
- Modify: `src/App.jsx:86-90` (efeito de salvar)
- Modify: `src/App.jsx:196-205` (cabeçalho)

**Interfaces:**
- Consumes: `gravarNuvem` de `nuvem.js`; `gravarMarca`, `lerMarca` de `sincronia.js`.
  Os três já foram importados em `src/App.jsx` nas Tasks 7 e 8 — não duplicar a linha.
- Produces: estado `estadoSync` com `"ok" | "enviando" | "pendente"`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/App.test.jsx`, dentro do mesmo arquivo da Task 7:

```jsx
import { gravarNuvem } from "./nuvem.js";

describe("subida automática", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("sem marca de sincronia, nada é enviado", async () => {
    sessaoAtual.mockResolvedValue({ user: { id: "u1" } });
    lerNuvem.mockResolvedValue({ existe: false, versao: null, dados: null, em: null, erro: "Sem conexao com a internet." });
    render(<App />);
    await waitFor(() => expect(lerNuvem).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 3200));
    expect(gravarNuvem).not.toHaveBeenCalled();
  }, 10000);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- App`
Expected: FAIL — `gravarNuvem` ainda não existe no fluxo, ou é chamado sem marca.

- [ ] **Step 3: Acrescentar o estado e o efeito de subida**

Junto dos outros `useState` em `src/App.jsx`:

```jsx
const [estadoSync, setEstadoSync] = useState("ok");
```

Logo depois do efeito de salvar (`src/App.jsx:86-90`), acrescentar:

```jsx
  /* ---------- enviar para o banco (depois de salvar no aparelho) ---------- */
  useEffect(() => {
    if (!db || !sessao || db.demo) return;
    const marca = lerMarca();
    // Sem marca não existe subida: o aparelho não tem como provar que o
    // estado dele descende do banco. Ver sincronia.js.
    if (!marca) return;
    setEstadoSync("enviando");
    const t = setTimeout(async () => {
      const r = await gravarNuvem(db, marca.versao, "celular");
      if (r.ok) { gravarMarca(r.versao, "celular"); setEstadoSync("ok"); }
      else setEstadoSync("pendente");
    }, 3000);
    return () => clearTimeout(t);
  }, [db, sessao]);
```

- [ ] **Step 4: Acrescentar o indicador no cabeçalho**

Em `src/App.jsx`, dentro de `<header className="mf-top">`, logo antes do botão de
privacidade (linha 201):

```jsx
          {estadoSync !== "ok" && (
            <span className="mf-cont" title={estadoSync === "enviando" ? "Salvando" : "Aguardando internet"}
              aria-label={estadoSync === "enviando" ? "Salvando" : "Aguardando internet"}>
              {estadoSync === "enviando" ? "…" : "!"}
            </span>
          )}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS, tudo verde.

- [ ] **Step 6: Conferir no app de verdade**

```bash
npm run dev
```

Roteiro, em `http://localhost:5173`:

1. A tela de entrada aparece. Entrar com `mats` e a senha.
2. O app abre. No painel do projeto, `select versao, atualizado_em from barbearia;`
   devolve uma linha.
3. Marcar um horário na Agenda. Em ~3 segundos, rodar o mesmo `select`: `versao` subiu.
4. **Teste da trava:** nas ferramentas do navegador, `localStorage.clear()`, e recarregar.
   Entrar de novo. O app precisa **baixar** os dados do banco, e o `select` precisa
   mostrar a mesma `versao` de antes — nada foi sobrescrito por vazio.
5. **Teste do offline:** desligar a rede nas ferramentas do navegador. Marcar um
   horário: precisa funcionar, com o indicador `!` no topo. Religar a rede e
   recarregar: a `versao` sobe.

- [ ] **Step 7: Gerar a dist e commitar**

```bash
npm run build
git add -A
git commit -m "Envia as alteracoes para o banco e mostra o estado da sincronizacao"
```

---

## Pronto quando

- O Matheus entra com usuário e senha, sem ver nenhuma menção a fornecedor.
- Marcar um horário faz a `versao` subir no banco em segundos.
- Limpar o armazenamento do aparelho e recarregar **baixa** os dados, e o banco fica
  intacto.
- Com a rede desligada, o app continua marcando cliente, e o que ficou pendente sobe
  quando a conexão volta.

# Ofertas com combo e desconto por serviço – plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desconto em R$ por serviço nas campanhas e ofertas com um ou mais serviços, escolhidos em Vagas, na Agenda e por horário nos stories.

**Architecture:** As regras de preço ficam em `regras.js` (funções puras testadas). Um componente `SeletorServicos` em `componentes.jsx` é usado nas três telas. A oferta reaproveita o campo `adicionais` que os agendamentos já têm.

**Tech Stack:** React 18, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-26-ofertas-combo-desconto-por-servico-design.md`

## Global Constraints
- Nada de "Supabase" em texto do app. `dist/` versionada: build e commit juntos.
- `STORE_KEY` e id de campanha `mattsflex` não mudam.
- Preços sempre com `r2()`; texto de dinheiro com `brl()`.
- Depois de testes + build: commit, ff da `main`, push (autorização permanente do dono).

---

### Task 1: Regras de preço (`src/regras.js`, `src/regras.test.js`)

**Produces:**
- `precoCampanha(c, preco, servicoId)` – porServico: `max(0, preco - descontos[servicoId])`.
- `campanhaCobre(c, servicoId) → boolean`
- `rotuloDesconto(c, db)` – porServico: `"Cabelo −R$ 15, Barba −R$ 5"` na ordem da tabela; sem db: `"desconto por serviço"`.
- `montarOferta(db, c, ids) → { servicoId, valor, adicionais, total, cheio } | null` (null se nenhum coberto).
- `idsServicos(a)`, `totalOferta(a)`, `cheioDe(db, a)`.

```js
export function precoCampanha(c, preco, servicoId) {
  if (!c) return r2(preco);
  if (c.descontoTipo === "porServico") return r2(Math.max(0, preco - (Number(c.descontos?.[servicoId]) || 0)));
  /* modos antigos como estão */
}
export function campanhaCobre(c, servicoId) {
  if (!c) return false;
  if (c.descontoTipo === "porServico") return (Number(c.descontos?.[servicoId]) || 0) > 0;
  return c.tipo !== "servico" || !c.servicoIds?.length || c.servicoIds.includes(servicoId);
}
export function montarOferta(db, c, ids) {
  const servs = db.servicos.filter((s) => ids.includes(s.id));
  const principal = servs.find((s) => campanhaCobre(c, s.id));
  if (!principal) return null;
  const preco = (s) => (campanhaCobre(c, s.id) ? precoCampanha(c, s.preco, s.id) : r2(s.preco));
  const adicionais = servs.filter((s) => s !== principal).map((s) => ({ servicoId: s.id, valor: preco(s) }));
  const valor = preco(principal);
  return { servicoId: principal.id, valor, adicionais, total: r2(valor + soma(adicionais, (x) => x.valor)), cheio: r2(soma(servs, (s) => s.preco)) };
}
```

- [ ] Testes: porServico (15 no cabelo, 0 na sobrancelha); campanhaCobre nos três casos; rótulo; montarOferta Cabelo+Barba = 50 de 70; Cabelo + Sobrancelha sem desconto = 30 + 5; só Sobrancelha → null; campanha 20% vale para cada serviço; principal é o primeiro coberto.
- [ ] FAIL → implementar → PASS → commit.

### Task 2: Campanha "Por serviço" (`Planos.jsx`, `dados.js`, novo `src/telas/Campanhas.test.jsx`)
- Seg ganha `["porServico", "Por serviço"]`. Com ele: some o campo %/R$ do grid; aparece "Desconto em cada serviço (R$)" com um `NumInput` por serviço (`aria-label="Desconto em <nome>"`, min 0), em branco = sem desconto; os chips de serviço (campanha de serviços) somem.
- `descontoOk` porServico: algum valor > 0. Salva `descontos` só com valores > 0 (r2).
- Prévia e exemplo do cartão usam `precoCampanha(c, s.preco, s.id)`; prévia porServico só lista cobertos; exemplo = primeiro coberto. Rótulos com `rotuloDesconto(c, db)` em todas as telas.
- `migrar`: campanhas ganham `descontos: {}` por padrão.
- [ ] Teste: editar a Mats Flex, "Por serviço", Cabelo 15, Barba 5, salvar → campanha com `descontoTipo: "porServico"`, `descontos: { corte: 15, barba: 5 }`; prévia mostra R$ 30,00 e R$ 20,00 e não mostra Alisamento.

### Task 3: `SeletorServicos` + Vagas (`componentes.jsx`, `Vagas.jsx`, novo `src/telas/VagasTela.test.jsx`)
- `SeletorServicos({ db, camp, ids, onChange, rotulo })`: chips (`aria-pressed`), desmarcar o último coberto não faz nada; abaixo "de R$ X por R$ Y" (`montarOferta`). `primeiroCoberto(db, camp)` exportado de regras.
- Vagas: estado `ids` (padrão: primeiro coberto); se a campanha mudar e `montarOferta` der null, volta ao padrão. `ofertar` grava `{ servicoId, valor, adicionais }`. Mensagem com `nomeServicos`, cheio riscado só se maior que o total. "Em oferta" mostra `totalOferta`.
- [ ] Teste: campanha porServico (Cabelo 15, Barba 5), marca Barba, clica o primeiro "Ofertar" → oferta com principal corte 30, adicional barba 20.

### Task 4: Stories (`Vagas.jsx`, `Vagas.test.js`, `StorySheet.test.jsx`)
- `desenharStory`: nome = `nomeServicos(db, a)`, preço = `totalOferta(a)`, riscado = `cheioDe(db, a)` se maior. `nomeNoCartao` não quebra deixando a primeira linha terminar em "+".
- `StorySheet` recebe `update` e a `lista` viva (Vagas passa `ofPorDia[story.data]`); cada horário marcado mostra `SeletorServicos` e, ao mudar, grava `montarOferta` na oferta.
- [ ] Testes: desenho de "Cabelo + Barba" com total e riscado; quebra "Cabelo" / "+ Barba"; no StorySheet marcar 10:00 e ligar Barba chama `update` que grava adicional e a imagem mostra o combo.

### Task 5: Agenda (`Agenda.jsx`, `Planos.jsx`, `Agenda.test.jsx`)
- Rótulo do horário em oferta: `brl(totalOferta(ag))`.
- Ofertar vaga (NovoNoHorario): `SeletorServicos` no lugar do select; salva combo; painel de valor mostra cheio riscado e total; "Ajustar valor" mexe só no principal.
- Tela da oferta: nomes e total; "Preço da vaga (total)". Venda grava `adicionaisOferta`. Desfazer venda e cancelar pacote devolvem `adicionais: a.adicionaisOferta ?? []`.
- `campsServ` usa `campanhaCobre`; `precoCampanha` com o id do serviço nas linhas de campanha.
- [ ] Testes: desfazer venda devolve os adicionais; vender com "Preço da vaga" mantém adicionais e grava `adicionaisOferta`.

### Task 6: Fechamento
- [ ] `npm test`, `npm run build`, story real com combo no navegador sem janela, commit, publicar.

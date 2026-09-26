# Pagar depois – plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar um atendimento como "Pagar depois", lembrar na hora escolhida dentro do app e cobrar pelo WhatsApp.

**Architecture:** Regras puras em `regras.js`; telas novas num arquivo próprio `src/telas/Cobranca.jsx`, usadas pela Agenda, pelo Painel e pelo App.

**Tech Stack:** React 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-pagar-depois-design.md`

## Global Constraints
- Textos em português, sem "Supabase". `dist/` versionada: build e commit juntos.
- Datas locais: `lembrete` guarda `{ data: "YYYY-MM-DD", hora: "HH:MM" }` e compara com `momento()`.
- Publicar ao fim (autorização permanente).

### Task 1: Regras (`regras.js`, `regras.test.js`)
`A_RECEBER`, `aReceber`, `cobrancasVencidas`, `valorACobrar`, `msgCobranca`, `lembreteRapido`, `recebidoNoDia` pelo `pagoEm`.
- [ ] Testes: ordem da lista; vencida só depois da hora e antes de cobrar; mensagem exata; atalhos de hora (1h arredonda para 5 min; noite; amanhã); recebido ignora "A receber" e conta o pago depois no dia do pagamento; "A receber" aparece por forma de pagamento.
- [ ] FAIL → implementar → PASS → commit.

### Task 2: Telas de cobrança (`Cobranca.jsx`, `Cobranca.test.jsx`)
`CobrarDepoisSheet`, `RecebiSheet`, `ListaAReceber`, `AvisoCobranca`.
- [ ] Testes: salvar lembrete "Amanhã às 9:00"; link do WhatsApp com a mensagem; sem telefone não há link; Recebi com Dinheiro grava `pagoEm` e limpa o lembrete; aviso mostra a vencida, WhatsApp grava `cobradoEm`, Adiar 1 hora muda o lembrete; várias vencidas → "Hora de cobrar 2 clientes".
- [ ] FAIL → implementar → PASS → commit.

### Task 3: Ligar nas telas (`componentes.jsx`, `Agenda.jsx`, `Painel.jsx`, `App.jsx`, testes)
- `FormaPagamento` ganha `onDepois` (mostra "Pagar depois", marcado quando `A_RECEBER`).
- Detalhe do atendimento: "Pagar depois" abre `CobrarDepoisSheet`; em "A receber", mostra lembrete + WhatsApp; escolher outra forma grava `pagoEm` e limpa o lembrete.
- Fechamento em lote: opção "Pagar depois" com lembrete amanhã 9:00.
- Painel: `ListaAReceber` no topo; nota sobre "A receber" na forma de pagamento.
- App: `AvisoCobranca` junto das outras faixas; "Ver lista" vai ao Painel.
- [ ] Testes na Agenda (abre a janela; lote com Pagar depois) e no App (faixa aparece com vencida).
- [ ] Build, olhar a tela de verdade, commit, publicar.

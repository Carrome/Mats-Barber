# Sincronização sem login – adendo ao desenho de 2026-09-21

Data: 2026-09-25. Branch: `supabase-etapa1`.
Substitui, no desenho de `2026-09-21-supabase-sincronizacao-design.md`, as seções
**Autenticação**, **Sincronização** e **Migração do que já existe**. O resto continua
valendo.

## Por que mudou

O Matheus cadastrou clientes no celular dele e o celular do dono do projeto não
recebeu nada. Causa: com `EXIGIR_LOGIN = false` ninguém tem sessão, e a reconciliação
em `App.jsx` só roda com sessão. Mesmo com login, só existia a criação inicial: a
subida de cada alteração (tarefa 9) e a descida ao abrir não tinham sido feitas.

O dono pediu sincronização **sem usuário por enquanto**, com os dois celulares
iguais, e com os dados reais que já estão no celular do Matheus prevalecendo.

## Decisões do dono

| Pergunta | Escolha |
|---|---|
| Como o banco reconhece os aparelhos sem login | Código fixo dentro do app |
| Colisão entre os dois celulares | Vence quem gravou primeiro, sem aparelho preferido |
| Primeira conexão | Os dados reais do celular do Matheus prevalecem |

**Risco aceito:** o código viaja no JavaScript público do site. Quem o extrair consegue
ler e gravar o retrato da barbearia (nomes e telefones de clientes). As travas de
perda de dados continuam valendo; a de privacidade fica para quando o login voltar.

## Banco (`sql/02-sem-login.sql`, rodado pelo dono no SQL Editor)

- `barbearia.dono` deixa de ser obrigatório. Nada da parte de login é apagado.
- Coluna `unica boolean default true` com índice único: a tabela tem no máximo uma linha.
- `barbearia_historico`: o gatilho de versão passa a copiar a linha antiga para lá a
  cada alteração e mantém só as últimas 30. RLS ligado e sem políticas: só as funções
  enxergam.
- A tabela continua fechada para acesso direto (as políticas antigas exigem sessão).
  O app fala só por quatro funções `security definer`, que conferem o código pelo
  `sha256` antes de qualquer coisa:

| Função | Devolve |
|---|---|
| `mf_versao(codigo)` | número da versão, ou `null` se o banco está vazio |
| `mf_ler(codigo)` | `versao, dados, atualizado_em, atualizado_por` (zero ou uma linha) |
| `mf_criar(codigo, dados, origem)` | versão criada, ou `null` se alguém criou antes |
| `mf_gravar(codigo, dados, base, origem)` | versão nova, ou `null` se o banco já passou de `base` |

Código errado levanta erro. Não existe função de apagar.

## App

### `nuvem.js`
`lerNuvem`, `criarNuvem`, `gravarNuvem` passam a chamar as funções acima com o código
de `config.js`, mantendo os formatos de retorno. Entra `versaoNuvem`. As funções de
login ficam como estão.

### `sincronia.js` – decisão da primeira conexão (sem marca)

| Banco | Aparelho | Ação |
|---|---|---|
| vazio | vazio ou exemplo | `aguardar`: não cria banco vazio, tenta de novo depois |
| vazio | com dados | `criar` |
| com dados | vazio ou exemplo | `baixar` |
| com dados vazios | com dados | `subir` |
| com dados | com dados | vence quem tem mais registros (clientes + horários + pacotes); empate fica com o banco |

O lado que perde fica guardado: no aparelho como "cópia anterior" (recuperável em
Ajustes), no banco no histórico. A marca ganha o campo `pendente`, gravado a cada
alteração local ainda não enviada, para sobreviver a um fechamento do app.

### `sincronizar.js` – hook `useSincronia`
Só age no uso real (`!db.teste`). Nunca no modo teste.

- **Envio:** alteração local com marca → pendente → 3 s parado → `gravarNuvem` com a
  versão da marca como base. Sem rede, fica pendente. Ao esconder o app, tenta na hora.
- **Conferência:** ao abrir, ao voltar para o app, ao recuperar a rede e a cada 30 s
  com o app visível. Banco igual à marca e algo pendente → envia. Banco diferente da
  marca → baixa.
- **Colisão:** baixar com alteração local não enviada, ou `gravarNuvem` recusado,
  aplica a versão do banco, guarda a local como cópia anterior e avisa.
- Uma operação por vez. Um retorno de rede que chega depois de uma alteração local
  nunca apaga essa alteração sem guardá-la antes.
- Expõe `{ fase, ultima }` para Ajustes: `ok`, `enviando`, `pendente`, `sem-conexao`,
  `aguardando`.

### `App.jsx` e Ajustes
A reconciliação antiga (dependente de sessão) e o estado `escolhaMigracao` saem. O
login continua desligado. Ajustes mostra "Sincronizado às HH:MM" ou o estado atual, e
o texto "os dados ficam só neste aparelho" é corrigido.

## Colocar no ar
1. Dono roda `sql/02-sem-login.sql`.
2. Conferência das funções com o código (só leitura: `mf_versao`, `mf_ler`, e código
   errado recusado). Nenhuma escrita de teste no banco real.
3. Merge na `main` e publicação.
4. Celular do Matheus abre a versão nova e sobe. Conferência no banco (quantidades).
5. Celular do dono abre e baixa.

## Testes
Lógica de decisão e marca em `sincronia.test.js`; funções do banco com `rpc`
simulado em `nuvem.test.js`; o hook com um componente de teste e atrasos curtos em
`sincronizar.test.jsx` (primeira conexão nos cinco casos, envio, descida, colisão,
sem rede, pendência que sobrevive a reabrir, modo teste). App continua passando.

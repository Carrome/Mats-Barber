# Sincronização com Supabase e agenda pública

Data: 2026-09-21

## Objetivo

Hoje o Mats Flex guarda tudo no `localStorage` do aparelho. Se o celular do Matheus
quebrar, for formatado ou tiver o cache limpo, os dados da barbearia acabam junto.

Este desenho resolve duas coisas:

1. O banco do Supabase passa a ser o meio principal de armazenamento. Celular novo:
   instala o app, entra com usuário e senha, e tudo está lá, atualizado.
2. Um link público, só de leitura, mostra a agenda do mês atual e do seguinte para os
   clientes da barbearia, com liga e desliga na mão do Matheus.

O app precisa continuar funcionando sem internet. Ele é um PWA e a barbearia depende
dele para marcar cliente mesmo com a rede fora do ar.

## Decisões já fechadas

| Decisão | Escolha |
|---|---|
| Fonte da verdade | Supabase. O aparelho é cache de trabalho. |
| Funcionamento offline | Continua. O app lê e grava local e sincroniza por baixo. |
| Aparelho com preferência | Celular do Matheus. O computador entra como suporte. |
| Login | Usuário e senha escolhidos pelo Matheus, criados dentro do projeto. |
| E-mail | Nenhum. Endereço interno montado pelo app, sem caixa de entrada. |
| Marca | White-label. O nome do fornecedor não aparece em lugar nenhum da interface. |
| Conteúdo da página pública | Livre, Flex com preço, Ocupado, Fechado. Sem nomes nem serviços. |

## Arquitetura

Três camadas. A de baixo já existe e não muda.

**Camada 1 — `localStorage`.** Continua sendo onde o app lê e grava. `regras.js`, as
telas e os testes seguem intocados. É isso que mantém o funcionamento offline.

**Camada 2 — sincronização.** Módulo novo (`src/sincronia.js`) que observa as gravações,
empurra para o Supabase e traz de volta o que mudou. Não conhece regra de negócio;
lida com o retrato inteiro, versão e conflito.

**Camada 3 — Supabase.** Fonte da verdade, histórico e a agenda pública.

### Por que o app não precisa ser reescrito

Todas as telas gravam pelo mesmo funil, `update()` em `src/App.jsx:107`, e o
salvamento é um único efeito com atraso de 300ms em `src/App.jsx:86-90`. A
sincronização entra nesses dois pontos.

Nenhuma tela de negócio é alterada. Agenda, Clientes, Planos, Vagas e Painel ficam
como estão. O que a etapa 1 acrescenta é uma tela de login nova e um indicador de
estado na barra superior — nada que mexa em regra ou em fluxo existente.

## Modelo de dados

O retrato do app vai como documento único em `jsonb`, não espalhado em tabelas de
clientes, agendamentos e pacotes.

Motivo: preserva todo o código atual, a gravação é atômica (nunca existe estado pela
metade) e, com um aparelho principal só, normalizar não traz ganho real. O volume de
uma barbearia cabe com folga. As tabelas espelho da etapa 2 cobrem a necessidade de
abrir e consultar os dados como tabelas de verdade.

### `barbearia`

Uma linha por dono.

| Coluna | Tipo | Função |
|---|---|---|
| `id` | uuid | chave |
| `dono` | uuid | referência a `auth.users` |
| `dados` | jsonb | o retrato completo do app |
| `versao` | bigint | contador para controle de concorrência |
| `atualizado_em` | timestamptz | |
| `atualizado_por` | text | rótulo do aparelho (`celular`, `suporte`) |

RLS liga. Políticas de `select`, `insert` e `update` restritas a `auth.uid() = dono`.

**Sem política de `delete`.** A linha não pode ser apagada pelo app de jeito nenhum.
Não é uma regra que o cliente respeita por educação — a operação não existe para ele.

### `barbearia_historico`

Toda alteração em `barbearia` grava a versão anterior aqui, por gatilho. Guarda as
últimas 30 versões por dono; as mais velhas caem sozinhas.

RLS liga com política de `select` para o dono e **nenhuma** política de escrita. Só o
gatilho escreve, e ele roda com permissão própria. O app não consegue inserir,
alterar nem apagar histórico.

### `agenda_publica`

| Coluna | Tipo | Função |
|---|---|---|
| `slug` | text | código do link, gerado aleatório |
| `dono` | uuid | referência a `auth.users` |
| `ativo` | boolean | o liga e desliga |
| `dados` | jsonb | resumo magro da agenda |
| `atualizado_em` | timestamptz | |

Duas políticas: `select` para o papel anônimo apenas onde `ativo = true`, e acesso
total para o dono. É a única tabela que alguém sem login enxerga, e só enquanto o
Matheus deixar ligada.

O resumo carrega apenas data, horário, estado e, quando Flex, o preço. Nome,
telefone, aniversário, observação e faturamento não entram nessa tabela.

## Autenticação

Supabase Auth com e-mail e senha, mas o Matheus nunca vê um e-mail.

- Ele digita `matheus` e a senha que quiser. O app completa para
  `matheus@<domínio-controlado>`. O endereço não é entregável, então nada chega a
  ninguém por acidente.
- Confirmação de cadastro desligada no painel. O app nunca chama recuperação por
  e-mail. Troca de senha acontece logado, em Ajustes, e não dispara mensagem.
- Senha esquecida se resolve pelo painel, pelo dono da conta. Com o suporte sendo a
  mesma pessoa, é troca aceitável.
- Única exigência de senha: 6 caracteres, que é o mínimo da plataforma. Sem
  maiúscula, número, símbolo ou expiração.
- A sessão fica guardada e renova sozinha. Na prática ele entra uma vez por aparelho.

A conta do dono do projeto não se mistura com isso em nenhum momento.

### Por que não um login caseiro

A chave pública do Supabase viaja dentro do JavaScript e qualquer visitante consegue
lê-la. A proteção vem das políticas do banco, que precisam saber quem está pedindo.
Sem sessão de verdade, a política que deixa o app gravar deixaria qualquer um gravar
e ler — o cadastro inteiro de clientes ficaria aberto. Assinar sessões por fora
exigiria um servidor, que o projeto não tem, para refazer o que já vem pronto.

## Sincronização

### Subida

1. `update()` altera o estado e o efeito de 300ms grava no `localStorage` como hoje.
2. A sincronização marca pendência e espera ~3 segundos parada.
3. Se houver rede, sessão e marca de sincronia, envia
   `update barbearia set dados = ?, versao = versao + 1 where id = ? and versao = <base>`.
4. Zero linhas afetadas significa que o banco avançou. Cai no tratamento de conflito.
5. Sucesso grava a nova versão na marca de sincronia local.

Sem rede, a pendência fica marcada e sobe quando a conexão voltar. Não existe fila de
operações: o que sobe é sempre o retrato inteiro mais recente.

### Descida

Ao abrir o app, ao voltar para a aba e ao recuperar conexão, o app compara a versão do
banco com a da marca local. Banco à frente e sem alteração local pendente, ele baixa e
aplica. As duas coisas à frente ao mesmo tempo é conflito.

### Conflito

O celular do Matheus é o aparelho com preferência, declarada na marca de sincronia.

- **Celular contra banco:** o celular vence. Envia por cima, e a versão perdida fica
  guardada no histórico, recuperável.
- **Suporte contra banco:** o suporte perde. O app avisa que existe versão mais nova e
  oferece baixar antes de continuar. Ele não sobrescreve sozinho.

## Travas contra perda de dados

O risco que a sincronização cria e que hoje não existe: o aparelho perde o
`localStorage`, o app abre vazio, entende que vazio é a verdade e sobe isso por cima
do banco. O backup teria causado a perda.

Quatro camadas, em ordem de quem atua primeiro.

### 1. Marca de sincronia (estrutural, no aparelho)

O aparelho guarda, em chave própria do `localStorage` ao lado dos dados, de qual
versão do banco o estado atual descende. Limpar o armazenamento leva as duas coisas
juntas — é justamente o que torna a trava confiável.

A subida automática só existe quando há marca. Sem ela, o app não escolhe por
heurística qual lado vale: ele cai numa das quatro situações abaixo.

| Marca | Aparelho | Banco | O que acontece |
|---|---|---|---|
| tem | — | — | sincronização normal, com a versão da marca como base |
| não tem | vazio ou exemplo | com dados | **só baixa.** Celular novo, reinstalação ou cache limpo |
| não tem | com dados | vazio | sobe uma vez. É a primeira migração |
| não tem | com dados | com dados | para e pergunta, mostrando data e quantidade dos dois lados |

A segunda linha é a que responde ao risco principal: aparelho limpo nunca tem como
apagar o banco, porque nesse estado o código de subida não é alcançável. A mesma
linha é o que faz o celular novo funcionar sozinho, sem nenhum passo extra.

**Dados de exemplo contam como vazio.** `abrirDados` em `src/dados.js:118` gera uma
base de demonstração cheia de clientes quando não encontra nada salvo. Sem essa
ressalva, um celular recém-formatado abriria com quarenta clientes falsos, pareceria
"aparelho com dados" e cairia na linha de perguntar — ou pior, de subir. A demo nunca
vale mais que o banco.

A terceira e a quarta acontecem uma vez só na vida de cada aparelho, na migração.

### 2. Versão (no banco)

Toda gravação declara de qual versão partiu e o banco recusa se já avançou. Um
aparelho atrasado não consegue passar por cima de quem estava em dia. Enforçado pela
cláusula `where versao = <base>`, não por combinado entre as partes.

### 3. Guarda de volume (no banco)

Gatilho `before update` em `barbearia` compara as quantidades antes e depois. Se uma
gravação legítima ainda assim apagaria boa parte dos clientes, agendamentos ou
pacotes de uma vez, ela é recusada com erro.

Roda no servidor de propósito: nem um app com defeito, nem uma versão antiga em cache,
nem uma chamada manual passam por cima. Superar exige um sinalizador explícito na
sessão, escolhido por gente, nunca por acidente.

O app trata esse erro mostrando os dois lados — o que tem, o que viria — e perguntando.

### 4. Histórico

As últimas 30 versões ficam guardadas com data e aparelho de origem, restauráveis em
um clique em Ajustes. É a rede embaixo das outras três: mesmo que algo passe, dá para
voltar no tempo.

## Migração do que já existe

Na primeira vez que o Matheus abrir a versão nova e entrar:

1. O app baixa um `.json` de backup antes de qualquer coisa.
2. Compara o aparelho com o banco:
   - aparelho com dados, banco vazio → sobe;
   - banco com dados, aparelho vazio → desce;
   - os dois com dados → ele escolhe, vendo data e quantidade de cada lado.
3. Grava a marca de sincronia e segue a vida normal.

O `STORE_KEY` não muda. Os dados que já estão no aparelho continuam onde estão.

## Agenda pública

Endereço no mesmo domínio, no formato `?ag=<slug>`. Evita mexer na configuração de
deploy, que hoje funciona por arrastar a pasta e também pela Vercel sem reescrita de
rota.

### Estado de cada horário

Para cada dia do mês atual e do seguinte, para cada horário da grade
(`horariosDe(config)`):

| Condição | Estado |
|---|---|
| dia fora de `config.dias`, ou em `fechados` | `fechado` |
| `pausaEm(config, data, hora)` | `fechado` |
| agendamento com `tipo === "oferta"` e sem cliente | `flex`, com `valor` |
| qualquer outro agendamento no horário | `ocupado` |
| nada | `livre` |

Dias já passados aparecem apagados, como esgotados, e o dia de hoje fica destacado.

### Atualização

O resumo é recalculado e enviado junto de cada sincronização, apenas quando o link
está ligado. Marcar alguém no celular reflete na página em segundos. A página busca ao
abrir, a cada minuto e ao voltar para a aba.

Desligar é trocar `ativo` para falso. O link cai na hora, mesmo já compartilhado, e a
política do banco para de devolver a linha.

## Mantendo o projeto acordado

Projeto no plano gratuito hiberna depois de cerca de 7 dias sem acesso. No uso normal
isso não chega perto de acontecer, mas uma semana de barbearia fechada bastaria.

Rotina agendada no GitHub Actions, a cada 3 dias, fazendo uma leitura leve. Roda em
segundos e não depende de ninguém lembrar.

## Parâmetros

| Item | Valor |
|---|---|
| Endereço do projeto | `https://sgirqynnahnhbbeeqlvf.supabase.co` |
| Chave pública | `sb_publishable_o3WZPQz_j1n0fuKYtTC_Hg_OdGJcY4C` |
| Endereço de publicação | `https://mats-barber.vercel.app` |
| Login do Matheus | usuário `mats`, montado como `mats@mats-barber.vercel.app` |
| Senha inicial | combinada fora deste documento; trocável em Ajustes |

O endereço do projeto entra **sem** o sufixo `/rest/v1/` — a biblioteca acrescenta
esse caminho sozinha.

O subdomínio `vercel.app` não tem serviço de e-mail, então o endereço de login não é
entregável a ninguém, que é exatamente o que se quer dele.

A chave pública fica num arquivo de configuração versionado, não em variável de
ambiente. Ela é pública por natureza e a `dist/` é versionada, então o valor acabaria
embutido no pacote de todo jeito; um `.env` fora do repositório só criaria build
quebrado em outra máquina.

A chave `service_role` não entra no app, não entra no repositório e não é
compartilhada. O SQL de criação das tabelas é rodado pelo dono do projeto no SQL
Editor do painel, a partir do arquivo deixado pronto.

## Etapas

### Etapa 1 — fundação

Cliente do Supabase, tela de login white-label, `src/sync.js`, tabela `barbearia`,
RLS, travas 1 e 2, migração e indicador de estado da sincronização.

Pronto quando: o Matheus entra, os dados sobem, outro aparelho entra e baixa os
mesmos dados, e o app continua marcando cliente com a rede desligada.

### Etapa 2 — resistência

Histórico com restauração em Ajustes, guarda de volume, aviso de aparelho
desatualizado, rotina de manter acordado e as tabelas espelho geradas pelo banco a
partir do retrato.

Pronto quando: uma gravação que apagaria a maioria dos clientes é recusada, e dá para
voltar a uma versão anterior pela interface.

### Etapa 3 — agenda pública

Tabela `agenda_publica`, geração do resumo, liga e desliga em Ajustes com o link para
copiar, e a página pública.

Pronto quando: um aparelho sem login abre o link e vê os dois meses; marcar alguém no
celular muda a página; desligar derruba o link.

## Fica de fora

- **Agendamento pelo link.** A página é só leitura. Está no roadmap como item
  separado.
- **Tabelas normalizadas como fonte da verdade.** O retrato único atende, e reescrever
  `dados.js` num app do qual a barbearia depende é risco sem retorno agora.
- **Mesclagem por registro.** Só faz sentido com duas pessoas marcando ao mesmo tempo,
  que não é o caso.
- **Exclusão reversível.** Chegou a ser combinada para a etapa 2, e eu recuo: o
  histórico já cobre a recuperação, e marcar registro como removido obrigaria a mexer
  em todo caminho de exclusão e em toda tela que lista. Volta a valer se aparecer caso
  de uso que o histórico não resolva.
- **Domínio próprio.** O plano contratado não aparece de fora, então não serve ao
  objetivo de esconder que a nuvem é gratuita.

## Riscos

**Cache do service worker servindo app velho.** Um app antigo pode subir retrato em
formato antigo. A migração em `dados.js` já lida com versão, e a versão do retrato
entra na gravação.

**Sessão expirada no meio do expediente.** O app não pode travar. Sem sessão válida
ele continua funcionando local e só marca a sincronização como pendente.

**Hibernação durante fechamento longo.** Mitigada pela rotina agendada; a primeira
chamada depois de acordar pode demorar, então a interface mostra que está
sincronizando em vez de dar erro.

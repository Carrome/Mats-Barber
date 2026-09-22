# Roadmap – Mats Flex

Lista de próximas melhorias, na ordem de prioridade definida pelo dono da barbearia.
Itens ainda não implementados; regras de negócio devem ser confirmadas com o Matheus antes de codar.

_Atualizado em 22/09/2026._

## Em andamento: dados na nuvem (Supabase)
Objetivo: o banco da nuvem passa a ser o armazenamento principal. Se o celular do Matheus der problema, ele instala
o app em outro, entra com usuário e senha e tudo está lá. Offline continua funcionando; o celular dele é quem manda,
o computador é só para suporte. Apagar os dados do aparelho **nunca** pode apagar a nuvem.
Especificação e plano em `docs/superpowers/`. Trabalho na branch `supabase-etapa1`.

Regras que não mudam:
- Não aparece o nome "Supabase" nem "nuvem gratuita" para o Matheus.
- Login por usuário (`mats`) transformado em e-mail interno (`mats@mats-barber.vercel.app`); nenhum e-mail é enviado.
- A chave `service_role` nunca entra no app, no repositório nem no chat. SQL é rodado pelo dono no SQL Editor.
- Só o uso real sincroniza; o modo teste nunca fala com o banco.

### Etapa 1 – base, login, sincronização e travas
Feito:
- [x] Script do banco (`sql/01-etapa1.sql`) rodado: tabela única, sem permissão de apagar, versão incrementada pelo servidor.
- [x] Leitura/gravação com trava de versão (`src/nuvem.js`) e decisão ao abrir (`src/sincronia.js`).
- [x] Tela de entrada com usuário e senha (`src/telas/Login.jsx`).
- [x] Reconciliação ao abrir (`src/App.jsx`), hoje **desligada**: `EXIGIR_LOGIN = false`.

Falta:
- [ ] Corrigir os achados da revisão da tarefa 7: sessão vencida não pode travar o app offline; a limpeza do efeito
      não pode matar a reconciliação no meio; a tela inicial não pode esperar a internet; teste do caminho feliz.
- [ ] Tarefa 8 – tela de escolha na primeira migração (quando aparelho e nuvem têm dados diferentes).
- [ ] Tarefa 9 – envio automático depois de cada alteração e indicador discreto de "salvo".
- [ ] Revisão final da etapa.
- [ ] Criar o usuário `mats` no painel (Authentication), com confirmação de e-mail desligada.
- [ ] Ligar `EXIGIR_LOGIN = true` e publicar.

### Etapa 2 – histórico e proteção extra
- [ ] Histórico de versões na nuvem e restaurar uma versão anterior.
- [ ] Trava de volume: recusar gravação que apague de uma vez boa parte dos clientes/agendamentos.
- [ ] Tabelas espelho (clientes, agendamentos…) para consulta e relatórios.

### Etapa 3 – link público da agenda
Substitui o item 7 abaixo (veja a definição lá).

## 1. Pacote aniversariante
Pacote especial oferecido no mês/aniversário do cliente (preço, validade e regras a definir).

## 2. Perfil do cliente enriquecido
- Média de dias de retorno (já existe o cálculo de frequência — trazer para a ficha do cliente).
- Serviços que o cliente costuma fazer.
- Fotos de antes/depois de cada atendimento, com histórico visual na ficha.

## 3. Validade de plano com dias livres
Hoje a extensão de validade de um pacote é só +7/+15/+30 dias fixos. Trocar por campo livre,
onde o barbeiro digita o número de dias da extensão.

## 4. Custo do serviço (lucro real)
Cadastrar custo de material e mão de obra por serviço, para calcular o lucro real por
atendimento e no faturamento do mês (hoje só mostra o valor cobrado).

## 5. Relatório de faltas por cliente
Estatística de faltas por semana/mês e histórico detalhado por cliente (hoje só existe
contagem simples na busca).

## 6. Relatório de confirmação (1 dia antes)
Lista dos atendimentos do dia seguinte para conferir e mandar mensagem de confirmação
(complementa o lembrete automático que já existe).

## 7. Link público de horários vagos (vai ser a etapa 3 da nuvem)
Página só de ver, com um link único que o Matheus liga e desliga no app. Definição combinada:
- Mostra o mês atual e o seguinte; o dia de hoje em destaque e os dias que já passaram apagados, como esgotados.
- Cada horário aparece só como **Livre**, **Flex** (com o preço) ou **Ocupado**. Nenhum nome de cliente.
- Atualiza sozinho quando o Matheus marca um horário.
- Sem agendar pelo link (isso continua como ideia futura).

## 8. Cartão fidelidade
A cada X cortes, o cliente ganha um brinde. Precisa definir: contagem por cliente, valor de X,
o que é o brinde e como fica visível na ficha do cliente.

---

## Ideias sem prioridade definida
- Programa de indicação automatizado ("Amigo para Amigo")
- Plano "Pai e Filho"
- Comparação ano a ano
- Lista de espera
- Notificação push
- Link público de **agendamento** (não só visualização)


---

## Já entregue (22/09/2026, versão 4)
- Vários serviços no mesmo horário (adicionais).
- Pagamento dividido entre dinheiro e Pix em todo lugar onde se escolhe a forma.
- Horários editáveis por dia, grade de hora em hora e almoço por dia; pausas fixas com liga/desliga.
- Modo "Testar aplicativo", separado do uso real (que agora começa vazio).
- Stories com escolha de até 6 horários.
- Atendimento concluído em verde esmaecido.

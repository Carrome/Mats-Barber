# Mats Flex – PWA (versão 4)

Aplicativo da **Matheu's Barber**: agenda por semanas, vagas com desconto (Mats Flex),
planos pré-pagos (Flex 3, Flex 5 e novos), campanhas, clientes com retorno e aniversário,
e painel de faturamento por período.

## Rodar no computador
```bash
npm install
npm run dev        # abre em http://localhost:5173
npm test           # roda os testes automáticos (Vitest)
```

## Gerar a versão para publicar
```bash
npm run build      # cria a pasta dist/
npm run preview    # testa a versão final em http://localhost:4173
```
**Publicação oficial:** https://mats-barber.vercel.app. O Vercel está ligado ao GitHub e publica sozinho
a cada push na `main` (roda o build por conta própria). O trabalho em andamento fica na branch
`supabase-etapa1`; para publicar, a `main` avança até ela (`git merge --ff-only`) e recebe o push.
A pasta `dist/` também vem pronta, para publicar arrastando em https://app.netlify.com/drop.
O PWA só instala e funciona offline quando servido por **HTTPS** (ou localhost).
Depois de mudar o código, rode `npm run build` de novo: a `dist/` fica versionada no repositório.

## Logo e ícones
A logo original fica em `recursos/logo-matheus-barber.jpeg`. Se trocar a logo, rode:
```bash
npm run marca      # gera a logo das telas, a logo grande dos stories e os ícones do PWA em public/icons
```

## Instalar no celular
- **Android (Chrome):** abra o endereço publicado → menu ⋮ → "Instalar app" (ou o botão em Ajustes).
- **iPhone (Safari):** abra o endereço → Compartilhar → "Adicionar à Tela de Início".

## Onde ficam os dados
Hoje os dados ficam **no próprio aparelho** (localStorage). O app abre com ou sem internet e **não pede login**
(`EXIGIR_LOGIN = false` em `src/App.jsx`). A cópia no banco da nuvem está sendo construída (veja o ROADMAP).
- **Uso real × modo teste:** são dois conjuntos de dados separados, em chaves diferentes do aparelho
  (`matts-flex-app-v1` para o real, `matts-flex-teste-v1` para o teste). Cada conjunto carrega a marca `teste`,
  e é ela que decide onde ele é gravado, então um lado nunca sobrescreve o outro.
  **Ajustes → Testar aplicativo** abre o exemplo para o Matheus treinar; o aviso no topo volta ao uso real.
  No teste não há backup nem restauração. Só o uso real vai sincronizar com a nuvem, nunca o teste.
- **Primeira abertura da versão 4:** o que já estava no aparelho vai para o modo teste e o uso real começa sem
  clientes nem agendamentos, mantendo ajustes, serviços, planos e campanhas. O original também fica como cópia automática.
- **Ajustes → Fazer backup** gera um arquivo `.json` (no celular abre o menu de compartilhar: mande para o seu WhatsApp ou Drive).
- Sem backup há 7 dias ou mais (com dados reais e pelo menos 3 clientes), aparece um aviso no topo de **Ajustes**
  e o ícone de ajustes ganha um número com a quantidade de avisos.
- Antes de restaurar um backup ou apagar tudo, o app guarda uma **cópia automática** (Ajustes → Recuperar dados anteriores).
- Ações como cancelar horário, retirar oferta ou fechar dia mostram **Desfazer** por alguns segundos.

## Estrutura
- `src/App.jsx` – navegação, janelas globais, salvar/desfazer/backup, troca entre uso real e modo teste
- `src/telas/` – `Painel`, `Agenda` (inclui pendências, remarcar, encaixe), `Vagas` (inclui imagem de stories), `Clientes`, `Planos`, `Ajustes`, `Rosca` (gráfico de rosca do painel)
- `src/regras.js` – regras de negócio (preço de plano/campanha, pacotes, grade, pausas, faturamento e meta por período, vendas por serviço, Comum × Flex, retorno, avisos)
- `src/dados.js` – armazenamento (uso real e teste separados), migração de versões antigas e dados de exemplo
- `src/config.js`, `src/nuvem.js`, `src/sincronia.js`, `src/telas/Login.jsx` – banco na nuvem (Supabase):
  endereço e chave pública, leitura/gravação com controle de versão, decisão de quem manda ao abrir, tela de entrada
- `sql/` – script do banco (`01-etapa1.sql`, já rodado no projeto) e instruções em `sql/LEIA-ME.md`
- `docs/superpowers/` – especificação e plano da sincronização com a nuvem
- `src/util.js` – datas, formatos, WhatsApp, CSV, compartilhar arquivo
- `src/componentes.jsx` – janela, campos, busca de cliente, forma de pagamento (inclui dividido)
- `src/estilos.js` – CSS
- `public/sw.js` – service worker (offline). A lista de arquivos é injetada no build pelo `vite.config.js`
- `*.test.js(x)` – testes automáticos ao lado de cada arquivo (`npm test`)
- `scripts/gerar-marca.mjs` e `recursos/` – geração da logo e dos ícones (`npm run marca`)

## Regras principais
- Pacote: preço = quantidade × (preço do serviço − desconto por uso). Preço, quantidade e validade
  ficam **congelados na venda**. A validade pode ser estendida como cortesia (+7/+15/+30 dias).
- Plano pode ser marcado como **"só em horário Flex"**: ao vender uma vaga em oferta, dá para escolher "Pacote Flex".
- Uso do pacote: agendar escolhendo "Pacote" (ou vender a vaga Flex com pacote). Marcado = reservado; Concluído ou Faltou = usado.
- Cancelar pacote desmarca os horários futuros dele (vagas Flex voltam a ser oferta).
- Campanha: desconto em **%**, **R$ a menos** ou **preço fixo** (ex.: Mats Flex = corte R$ 45 por R$ 35).
- Formas de pagamento: **Pix**, **Dinheiro** ou **Dividido** (parte em dinheiro, o resto no Pix), em todo lugar onde se
  escolhe a forma. Guarda-se só o valor em dinheiro; o Pix é o total menos ele. Registros antigos com cartão viram Dinheiro.
- **Vários serviços no mesmo horário:** o atendimento tem um serviço principal e **adicionais** (cada um com seu valor).
  O total cobrado soma tudo; em vendas por serviço, cada adicional conta para o próprio serviço. Com pacote, o principal
  sai do pacote e só os adicionais são cobrados na hora.
- **Horários:** a grade padrão é de hora em hora. Cada dia pode ter a própria lista de horários (Agenda → opções do dia →
  Horários deste dia: tirar, acrescentar em qualquer hora, voltar ao padrão) e o **almoço daquele dia** (início e duração).
  Horário com cliente marcado não pode ser tirado. Pausas fixas têm liga/desliga; o almoço fixo antigo veio desligado.
- Atendimento **concluído** aparece em verde esmaecido na agenda.
- Imagem de stories: o Matheus escolhe os horários (começa sem nenhum, **até 6 por imagem**, para ficar legível).
  O título vem da campanha das ofertas do dia.
- Serviços padrão: Cabelo R$ 45, Cabelo feminino R$ 50, Barba R$ 25, Sobrancelha R$ 5, Pezinho R$ 5 e Alisamento R$ 60.
  Preços que variam (cabelo maior, alisamento) são ajustados na hora com "Ajustar valor".
- Painel por período (**Hoje**, **Essa semana**, **Esse mês**, **Mês anterior**; abre em Hoje).
  Faturamento do período = pacotes vendidos no período + atendimentos concluídos (preço normal e campanhas).
  "Previsto" = horários marcados ainda não concluídos.
- Meta: a meta mensal é dividida igualmente pelos dias de atendimento do mês (dias fechados não contam).
  Meta do dia = essa parte; meta da semana = soma dos dias de atendimento da semana (cada dia usa a meta do seu mês).
- Vendas por serviço e Comum × Flex: só atendimentos concluídos, em R$ e com o número de atendimentos.
  **Flex** = atendimento feito em vaga Flex vendida (pago na hora ou com pacote); **Comum** = os demais.
  Atendimento com pacote vale o que o cliente pagou por corte (a venda do pacote entra no faturamento).
- Privacidade: o olho na barra superior (no computador, no canto do painel) troca os valores em dinheiro
  do painel por `R$ *****`. A escolha fica lembrada no aparelho.
- Retorno: o app calcula a frequência de cada cliente (mediana dos últimos intervalos). Passou do tempo + tolerância
  e não tem horário marcado → aparece em "Chamar". Muito tempo sem vir → "Sumido".

---

## O que mudou na versão 4

### Novidades
- **Vários serviços no mesmo horário** (ex.: cabelo + barba), com total na hora de cobrar.
- **Pagamento dividido** entre dinheiro e Pix, com os dois valores ligados (mexe em um, o outro acompanha).
- **Horários do dia** editáveis um por um e **almoço por dia**; grade padrão de hora em hora
  (quem usava 45 min foi convertido mantendo o mesmo fim de expediente).
- **Testar aplicativo** em Ajustes: exemplo separado do uso real, para o Matheus aprender sem bagunçar a agenda de verdade.
  "Carregar dados de exemplo" saiu de Ajustes.
- **Stories:** escolha de até 6 horários por imagem.
- Atendimento concluído em **verde esmaecido**.

### Nuvem (em andamento, ainda desligado)
- Banco criado e script rodado (tabela única da barbearia, sem permissão de apagar, versão controlada pelo servidor).
- Leitura e gravação com trava de versão, tela de entrada com usuário e senha e reconciliação ao abrir já existem no código,
  mas o login está desligado até a etapa 1 terminar.

## O que mudou na versão 3

### Marca e visual
- Logo e cores da **Matheu's Barber** (preto e amarelo) no app, nos ícones e na imagem de stories.
- **Modo escuro** (Ajustes → Aparência: automático, claro ou escuro), com contraste conferido por testes.
- Imagem de stories com a logo grande no fundo e cartões de horário com borda listrada do Flex.

### Painel
- Seletor de período (Hoje, Essa semana, Esse mês, Mês anterior) e meta em todos os períodos.
- Gráficos de rosca: vendas por serviço e Comum × Flex.
- Painel mais enxuto: ficam os cards de hoje, o faturamento, as roscas e o recebido por forma de pagamento.
- Botão de privacidade para esconder os valores.

### Outras mudanças
- Tabela de serviços da barbearia e só Pix/Dinheiro como formas de pagamento.
- Aviso de backup saiu do painel e foi para Ajustes, com número no ícone de ajustes.
- O botão de vender plano saiu da barra superior (continua em Planos e na ficha do cliente).
- "Desfazer venda da vaga" pede confirmação e oferece Desfazer.
- Backup feito à noite não conta mais como do dia seguinte no aviso de backup.
- Testes automáticos com Vitest.

## O que mudou na versão 2

### Bugs corrigidos
- **Offline e instalação não funcionavam:** o service worker tentava salvar `index.html` duas vezes e o navegador recusava a instalação inteira. Agora a lista não repete arquivos e cada arquivo é salvo separado.
- **WhatsApp para DDD 55** (e números salvos com 0 na frente ou sem DDD) abria o número errado.
- **Campos numéricos travavam a digitação** (apagar "15" para digitar "12" virava 1 → 112 → 30). Agora só corrigem ao sair do campo.
- **Agendamentos sumiam da agenda** ao mudar o primeiro horário ou a duração. Agora continuam aparecendo (marcados como encaixe).
- **Valores com centavos quebrados** em campanhas de % (ex.: 59,4999…). Tudo arredondado em centavos.
- **Busca por telefone** na tela Clientes não achava números formatados.
- Cancelar pacote deixava horários futuros presos a um pacote cancelado.
- No iPhone instalado, o topo ficava embaixo do relógio; campos davam zoom ao tocar (fonte menor que 16px).
- Dias da semana no celular quebravam se a barbearia atendesse 5 ou 7 dias.
- Tecla Esc fechava todas as janelas de uma vez; arrastar seleção de texto para fora fechava a janela.
- Observações salvavam a cada letra (lento com muitos dados); agora salvam ao sair do campo.
- Painel de ocupação ignorava pausas e dias fechados; manifesto travava o app em modo retrato no tablet.
- Últimas alterações podiam se perder se o app fosse fechado logo depois; agora salva ao sair.

### Novidades
- **Pendências:** horários que já passaram sem marcar Concluído/Faltou aparecem em destaque, com fechamento rápido (forma de pagamento e "marcar todos").
- **Painel "Hoje":** próximo cliente, quanto entrou hoje por forma de pagamento, e lista de **lembretes do próximo dia** com botão de WhatsApp.
- **Clientes para chamar:** frequência de cada cliente (a cada ~15 dias, mensal, eventual), quem está atrasado ou sumido, com mensagem pronta de WhatsApp.
- **Aniversário** e **indicado por** (base para o plano Amigo para Amigo) na ficha do cliente; aviso de aniversários da semana.
- **Aviso de cliente repetido** ao cadastrar (mesmo telefone ou nome) e contagem de faltas na busca.
- **Remarcar** atendimento, **editar serviço e valor**, **encaixe** fora da grade, **repetir horário** a cada 7/15/30 dias.
- **Pausas fixas** (almoço, sábado mais curto) e **fechar dia** (feriado/folga).
- **Campanhas com preço fixo ou R$ de desconto**, com prévia do preço por serviço.
- **Imagem para stories** das vagas em oferta (1080×1920) para compartilhar no Instagram/WhatsApp.
- **Exportar planilha do mês** (CSV que abre no Excel/Google Planilhas) com atendimentos, pacotes e resumo.
- **Recebido por forma de pagamento**, faltas no mês e quanto falta por dia para bater a meta.
- **Desfazer**, cópia automática antes de ações grandes, proteção de armazenamento e aviso de nova versão.

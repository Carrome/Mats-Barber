# Matts Flex – PWA (versão 2)

Aplicativo para a barbearia do Matts: agenda por semanas, vagas com desconto (Matts Flex),
planos pré-pagos (Flex 3, Flex 5 e novos), campanhas, clientes com retorno e aniversário,
e painel de faturamento.

## Rodar no computador
```bash
npm install
npm run dev        # abre em http://localhost:5173
```

## Gerar a versão para publicar
```bash
npm run build      # cria a pasta dist/
npm run preview    # testa a versão final em http://localhost:4173
```
A pasta `dist/` já vem pronta neste pacote. Para publicar, arraste a pasta `dist/` em
https://app.netlify.com/drop, ou envie o projeto para a Vercel / GitHub Pages.
O PWA só instala e funciona offline quando servido por **HTTPS** (ou localhost).

## Instalar no celular
- **Android (Chrome):** abra o endereço publicado → menu ⋮ → "Instalar app" (ou o botão em Ajustes).
- **iPhone (Safari):** abra o endereço → Compartilhar → "Adicionar à Tela de Início".

## Onde ficam os dados
Os dados ficam **no próprio aparelho** (localStorage), sem sincronização entre aparelhos.
- **Ajustes → Fazer backup** gera um arquivo `.json` (no celular abre o menu de compartilhar: mande para o seu WhatsApp ou Drive).
- O painel lembra de fazer backup quando passam 7 dias.
- Antes de restaurar um backup, carregar exemplo ou apagar tudo, o app guarda uma **cópia automática** (Ajustes → Recuperar dados anteriores).
- Ações como cancelar horário, retirar oferta ou fechar dia mostram **Desfazer** por alguns segundos.

## Estrutura
- `src/App.jsx` – navegação, janelas globais, salvar/desfazer/backup
- `src/telas/` – `Painel`, `Agenda` (inclui pendências, remarcar, encaixe), `Vagas` (inclui imagem de stories), `Clientes`, `Planos`, `Ajustes`
- `src/regras.js` – regras de negócio (preço de plano/campanha, pacotes, grade, pausas, faturamento, retorno)
- `src/dados.js` – armazenamento, migração de versões antigas e dados de exemplo
- `src/util.js` – datas, formatos, WhatsApp, CSV, compartilhar arquivo
- `src/componentes.jsx` – janela, campos, busca de cliente
- `src/estilos.js` – CSS
- `public/sw.js` – service worker (offline). A lista de arquivos é injetada no build pelo `vite.config.js`

## Regras principais
- Pacote: preço = quantidade × (preço do serviço − desconto por uso). Preço, quantidade e validade
  ficam **congelados na venda**. A validade pode ser estendida como cortesia (+7/+15/+30 dias).
- Plano pode ser marcado como **"só em horário Flex"**: ao vender uma vaga em oferta, dá para escolher "Pacote Flex".
- Uso do pacote: agendar escolhendo "Pacote" (ou vender a vaga Flex com pacote). Marcado = reservado; Concluído ou Faltou = usado.
- Cancelar pacote desmarca os horários futuros dele (vagas Flex voltam a ser oferta).
- Campanha: desconto em **%**, **R$ a menos** ou **preço fixo** (ex.: Matts Flex = corte R$ 45 por R$ 35).
- Faturamento do mês = pacotes vendidos no mês + atendimentos concluídos (preço normal e campanhas).
  "Previsto" = horários marcados ainda não concluídos.
- Retorno: o app calcula a frequência de cada cliente (mediana dos últimos intervalos). Passou do tempo + tolerância
  e não tem horário marcado → aparece em "Chamar". Muito tempo sem vir → "Sumido".

---

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

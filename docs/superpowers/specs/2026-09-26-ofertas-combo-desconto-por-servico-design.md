# Ofertas com combo e desconto por serviço – desenho

Data: 2026-09-26. Aprovado pelo dono do projeto em conversa.

## Pedido
- A campanha (Mats Flex e as demais) pode ter um desconto em R$ **por serviço**: ex. Cabelo −15,
  Barba −5, ou só Cabelo −15.
- Uma oferta pode ter **mais de um serviço** (Cabelo + Barba), e ele escolhe os serviços de cada
  horário também na tela dos stories (08:00 Cabelo, 10:00 Barba).

## Decisões
| Pergunta | Escolha |
|---|---|
| Preço do combo | Soma: cada serviço com o seu desconto |
| Serviço sem desconto na oferta | Entra pelo preço cheio; a oferta precisa de ao menos um com desconto |
| Onde escolher os serviços | Vagas (antes de ofertar), Agenda → Ofertar vaga e Imagem para stories (por horário) |
| Trocar serviço nos stories | Muda a oferta gravada (serviço e preço), não só a imagem |

## Modelo
- Campanha: `descontoTipo: "porServico"` e `descontos: { [servicoId]: R$ }`. Serviço sem valor
  (ou 0) não tem desconto. Os modos antigos (`pct`, `valor`, `preco`) seguem iguais e passam a valer
  para cada serviço de uma oferta.
- `campanhaCobre(c, servicoId)`: porServico → tem valor > 0; campanha de serviços com lista →
  está na lista; senão → sim.
- Oferta: o formato de agendamento de sempre. `servicoId` é o principal (o primeiro coberto, na
  ordem da tabela de serviços), `valor` o preço dele, e `adicionais: [{ servicoId, valor }]` os
  demais, cada um com o seu desconto ou pelo preço cheio.
- Venda: grava `adicionaisOferta` (cópia) junto de `valorOferta`. Desfazer a venda e cancelar o
  pacote devolvem a oferta com esses adicionais.

## Telas
- **Campanha:** 4ª opção "Por serviço" em Tipo de desconto, com um campo R$ por serviço. A prévia
  mostra só os serviços com desconto. Em campanha de "Serviços na agenda" + Por serviço, os chips de
  serviços somem (o valor preenchido já diz quais valem). Rótulo: "Cabelo −R$ 15, Barba −R$ 5".
- **Seletor de serviços da oferta** (componente único): chips de todos os serviços, um ou mais
  marcados; não deixa desmarcar o último serviço com desconto; mostra "de R$ 70 por R$ 50".
- **Vagas:** o seletor substitui "Serviço ofertado". Mensagem: "• 08:00 – Cabelo + Barba de ~R$ 70~
  por *R$ 50*". "Em oferta" mostra o total.
- **Stories:** cada horário marcado ganha o seletor; mudar grava a oferta. O cartão mostra
  "Cabelo + Barba" (quebra antes do "+", nunca depois), o total e o cheio riscado.
- **Agenda:** Ofertar vaga usa o seletor; o horário em oferta e a tela de venda mostram o total e
  os nomes; "Preço da vaga" cobra o total; com Pacote Flex o principal é do pacote e os adicionais
  são pagos na hora (regra que já existe).

## Fica igual
Ofertas já criadas; "Agendar com campanha" fora das ofertas (adicionais a preço cheio); relatórios
(adicionais de uma vaga vendida já entram como hoje).

## Risco
Celular na versão antiga não entende `porServico` e mostraria preço cheio. Atualizar os dois antes
de usar.

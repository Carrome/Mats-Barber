# Pagar depois, com lembrete de cobrança – desenho

Data: 2026-09-26. Aprovado pelo dono do projeto em conversa.

## Pedido
O cliente termina o corte e diz "te mando um Pix quando chegar em casa". O Matheus marca
**Pagar depois**, escolhe quando quer ser lembrado e, na hora, cobra pelo WhatsApp do cliente.

## Decisões
| Pergunta | Escolha |
|---|---|
| Como avisa | Só dentro do app (faixa no topo + lista no Painel). Com o app fechado, não avisa. |
| Mensagem | Sem chave Pix: "Oi, João! Tudo bem? Passando para lembrar do pagamento de R$ 45,00 do seu atendimento de 26/09 (Cabelo + Barba). Obrigado!" |
| Fechamento em lote | Aceita "Pagar depois" com lembrete para amanhã às 9:00 |
| Venda de pacote | Fora por enquanto |

## Modelo (no agendamento)
- `pagamento: "A receber"` (`A_RECEBER` em `regras.js`), `emDinheiro: 0`.
- `lembrete: { data, hora }` – quando lembrar.
- `cobradoEm` (ISO) – quando ele tocou em cobrar no WhatsApp a partir do aviso; o aviso daquele
  lembrete some, a cobrança continua na lista.
- Ao receber: `pagamento` Pix/Dinheiro/Dividido, `pagoEm` (data) e `lembrete: null`.

## Regras (`regras.js`)
- `aReceber(db)`: concluídos com `A_RECEBER`, pelo lembrete (sem lembrete no fim).
- `cobrancasVencidas(db, agora)`: lembrete já passou e não foi cobrado depois dele.
- `valorACobrar(a)`: o que se paga na hora (principal quando paga, mais adicionais).
- `msgCobranca(db, a)`.
- `lembreteRapido(qual, agora)`: `"1h"` (arredonda para 5 min), `"noite"` (hoje 20:00),
  `"amanha"` (amanhã 09:00).
- Faturamento como hoje (pela data do atendimento); por forma de pagamento aparece "A receber".
  `recebidoNoDia` não conta "A receber" e conta o pago depois no dia `pagoEm`.

## Telas (`src/telas/Cobranca.jsx`)
- `CobrarDepoisSheet`: cliente, valor, serviços; "Quando lembrar?" (Daqui a 1 hora, Hoje às 20:00
  enquanto fizer sentido, Amanhã às 9:00, Escolher data e hora); "Cobrar agora no WhatsApp";
  "Salvar lembrete". Serve também para mudar o lembrete.
- `RecebiSheet`: Pix / Dinheiro / Dividido e confirmar.
- `ListaAReceber` (Painel, só quando há algo): nome, valor, dia do atendimento, lembrete
  (em destaque se já passou), WhatsApp, Recebi, tocar para mudar o lembrete.
- `AvisoCobranca` (App, qualquer tela): uma vencida → "Hora de cobrar João Silva: R$ 45,00" com
  WhatsApp, Recebi, Adiar (1 hora / amanhã 9:00); várias → "Hora de cobrar N clientes" e Ver lista.
- Agenda: "Pagar depois" junto das formas de pagamento ao concluir; com "A receber", mostra o
  lembrete e o WhatsApp; escolher Pix/Dinheiro/Dividido depois disso conta como recebido hoje.
- Cliente sem telefone: sem botão de WhatsApp, com o aviso para cadastrar.

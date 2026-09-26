import { describe, expect, it } from "vitest";
import { baseVazia } from "./dados.js";
import {
  avisosAjustes, capacidadeMes, capacidadePeriodo, comumFlex, DIVIDIDO, faturamentoMes, fatiasRosca, intervaloPeriodo, metaPeriodo, partesPagamento,
  recebidoNoDia, resumoPeriodo, rotuloPagamento, valorAdicionais, vendasPorServico,
  campanhaCobre, cheioDe, idsServicos, montarOferta, precoCampanha, primeiroCoberto, rotuloDesconto, totalOferta,
  gradeDoDia, horasDoDia, horasLivresNoDia, pausaDoDia, vagasLivres,
} from "./regras.js";

// quinta-feira, 17/09/2026 às 10h
const QUINTA = new Date(2026, 8, 17, 10, 0);

describe("intervaloPeriodo", () => {
  it("hoje é só o dia atual", () => {
    expect(intervaloPeriodo("hoje", QUINTA)).toMatchObject({ inicio: "2026-09-17", fim: "2026-09-17", rotulo: "Hoje, 17/09" });
  });
  it("essa semana vai de segunda a domingo", () => {
    expect(intervaloPeriodo("semana", QUINTA)).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20", rotulo: "Semana de 14/09 a 20/09" });
  });
  it("semana que atravessa a virada do mês", () => {
    expect(intervaloPeriodo("semana", new Date(2026, 9, 1, 9))).toMatchObject({ inicio: "2026-09-28", fim: "2026-10-04" });
  });
  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(intervaloPeriodo("semana", new Date(2026, 8, 20, 9))).toMatchObject({ inicio: "2026-09-14", fim: "2026-09-20" });
  });
  it("esse mês vai do dia 1 ao último dia", () => {
    expect(intervaloPeriodo("mes", QUINTA)).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", rotulo: "Setembro de 2026" });
  });
  it("mês anterior em janeiro é dezembro do ano anterior", () => {
    expect(intervaloPeriodo("mesAnterior", new Date(2027, 0, 10))).toMatchObject({ inicio: "2026-12-01", fim: "2026-12-31", rotulo: "Dezembro de 2026" });
  });
});

function dbExemplo() {
  const db = baseVazia();
  db.clientes.push({ id: "c1", nome: "Ana" }, { id: "c2", nome: "Bruno" });
  // Flex 3: 3 cortes por R$ 105 => R$ 35 por uso
  db.pacotes.push({ id: "p1", codigo: "F3-001", clienteId: "c1", planoId: "flex3", servicoId: "corte", qtd: 3, valorPago: 105, dataCompra: "2026-09-02", pagamento: "Pix", validadeDias: 45, extraDias: 0 });
  const ag = (o) => db.agendamentos.push({ id: `a${db.agendamentos.length}`, hora: "10:00", pagamento: "", obs: "", status: "concluido", ...o });
  ag({ data: "2026-09-14", tipo: "avulso", clienteId: "c2", servicoId: "corte", valor: 45, pagamento: "Dinheiro" });
  ag({ data: "2026-09-15", tipo: "avulso", clienteId: "c2", servicoId: "cabelo-feminino", valor: 50, pagamento: "Pix" });
  ag({ data: "2026-09-16", tipo: "campanha", campanhaId: "mattsflex", clienteId: "c2", servicoId: "corte", valor: 35, valorOferta: 35, deOferta: true, pagamento: "Pix" });
  ag({ data: "2026-09-17", tipo: "pacote", pacoteId: "p1", clienteId: "c1", servicoId: "corte", valor: 0, valorOferta: 35, deOferta: true });
  ag({ data: "2026-09-17", hora: "11:00", tipo: "pacote", pacoteId: "p1", clienteId: "c1", servicoId: "corte", valor: 0 });
  ag({ data: "2026-09-17", hora: "12:00", tipo: "avulso", clienteId: "c2", servicoId: "barba", valor: 25, status: "faltou" });
  ag({ data: "2026-09-18", hora: "09:00", tipo: "avulso", clienteId: "c2", servicoId: "barba", valor: 25, status: "agendado" });
  ag({ data: "2026-09-18", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 35, status: "agendado" });
  ag({ data: "2026-08-31", tipo: "avulso", clienteId: "c2", servicoId: "corte", valor: 45, pagamento: "Pix" });
  return db;
}

describe("resumoPeriodo", () => {
  it("num mês inteiro dá o mesmo resultado do faturamento mensal", () => {
    const db = dbExemplo();
    expect(resumoPeriodo(db, "2026-09-01", "2026-09-30")).toEqual(faturamentoMes(db, "2026-09"));
  });
  it("num dia só conta o que é daquele dia", () => {
    const r = resumoPeriodo(dbExemplo(), "2026-09-15", "2026-09-15");
    expect(r).toMatchObject({ total: 50, servicos: 50, pacotes: 0, atendimentos: 1, faltas: 0 });
  });
  it("na semana conta só o que caiu entre as datas (pacote vendido antes fica de fora)", () => {
    const r = resumoPeriodo(dbExemplo(), "2026-09-14", "2026-09-20");
    expect(r).toMatchObject({ pacotes: 0, servicos: 95, campanhas: 35, total: 130, previsto: 25, atendimentos: 5, faltas: 1 });
  });
});

describe("capacidadePeriodo", () => {
  it("num mês é igual à capacidade mensal", () => {
    const db = dbExemplo();
    expect(capacidadePeriodo(db, "2026-09-01", "2026-09-30")).toBe(capacidadeMes(db, "2026-09"));
  });
  it("num domingo sem atendimento é zero", () => {
    expect(capacidadePeriodo(dbExemplo(), "2026-09-20", "2026-09-20")).toBe(0);
  });
});

describe("vendasPorServico", () => {
  it("agrupa atendimentos concluídos por serviço, com pacote pelo valor por uso", () => {
    expect(vendasPorServico(dbExemplo(), "2026-09-14", "2026-09-20")).toEqual([
      { id: "corte", nome: "Cabelo", valor: 150, qtd: 4 },
      { id: "cabelo-feminino", nome: "Cabelo feminino", valor: 50, qtd: 1 },
    ]);
  });
  it("não conta faltas, horários marcados nem vagas não vendidas", () => {
    const nomes = vendasPorServico(dbExemplo(), "2026-09-17", "2026-09-18").map((s) => s.id);
    expect(nomes).toEqual(["corte"]);
  });
  it("período sem atendimentos devolve lista vazia", () => {
    expect(vendasPorServico(dbExemplo(), "2026-07-01", "2026-07-31")).toEqual([]);
  });
});

describe("comumFlex", () => {
  it("Flex é o atendimento feito em vaga Flex vendida (pago na hora ou com pacote)", () => {
    expect(comumFlex(dbExemplo(), "2026-09-14", "2026-09-20")).toEqual({
      comum: { valor: 130, qtd: 3 },
      flex: { valor: 70, qtd: 2 },
    });
  });
});

describe("fatiasRosca", () => {
  const itens = [
    { id: "a", nome: "A", valor: 10, qtd: 5 }, { id: "b", nome: "B", valor: 60, qtd: 1 }, { id: "c", nome: "C", valor: 30, qtd: 2 },
    { id: "d", nome: "D", valor: 5, qtd: 1 }, { id: "e", nome: "E", valor: 4, qtd: 1 }, { id: "f", nome: "F", valor: 3, qtd: 1 },
    { id: "g", nome: "G", valor: 2, qtd: 1 },
  ];
  it("ordena pela medida escolhida e junta o que passar de 6 fatias em Outros", () => {
    expect(fatiasRosca(itens, "valor")).toEqual([
      { id: "b", nome: "B", v: 60, qtd: 1 }, { id: "c", nome: "C", v: 30, qtd: 2 }, { id: "a", nome: "A", v: 10, qtd: 5 },
      { id: "d", nome: "D", v: 5, qtd: 1 }, { id: "e", nome: "E", v: 4, qtd: 1 }, { id: "outros", nome: "Outros", v: 5, qtd: 2 },
    ]);
  });
  it("com até 6 itens não cria Outros e ignora itens zerados", () => {
    expect(fatiasRosca([{ id: "a", nome: "A", valor: 0, qtd: 2 }, { id: "b", nome: "B", valor: 7, qtd: 1 }], "qtd"))
      .toEqual([{ id: "a", nome: "A", v: 2, qtd: 2 }, { id: "b", nome: "B", v: 1, qtd: 1 }]);
    expect(fatiasRosca([{ id: "a", nome: "A", valor: 0, qtd: 2 }], "valor")).toEqual([]);
  });
});

describe("avisosAjustes", () => {
  const comClientes = (extra = {}) => {
    const db = baseVazia();
    db.clientes = [{ id: "c1", nome: "A" }, { id: "c2", nome: "B" }, { id: "c3", nome: "C" }];
    Object.assign(db.config, extra);
    return db;
  };
  it("sem nenhum backup, avisa", () => {
    expect(avisosAjustes(comClientes(), "2026-09-17")).toEqual([{ id: "backup", texto: "Você ainda não fez nenhum backup." }]);
  });
  it("backup de 7 dias ou mais atrás, avisa com os dias", () => {
    const iso = new Date(2026, 8, 9, 10, 0).toISOString();
    expect(avisosAjustes(comClientes({ ultimoBackup: iso }), "2026-09-17")).toEqual([{ id: "backup", texto: "Último backup há 8 dias." }]);
  });
  it("backup recente não avisa", () => {
    const iso = new Date(2026, 8, 14, 10, 0).toISOString();
    expect(avisosAjustes(comClientes({ ultimoBackup: iso }), "2026-09-17")).toEqual([]);
  });
  it("backup feito à noite conta no dia local, não no dia seguinte em UTC", () => {
    const iso = new Date(2026, 8, 10, 23, 30).toISOString(); // 10/09 às 23h30 no horário local
    expect(avisosAjustes(comClientes({ ultimoBackup: iso }), "2026-09-17")).toEqual([{ id: "backup", texto: "Último backup há 7 dias." }]);
  });
  it("dados de exemplo ou com poucos clientes não pedem backup", () => {
    const demo = comClientes(); demo.demo = true;
    expect(avisosAjustes(demo, "2026-09-17")).toEqual([]);
    const poucos = comClientes(); poucos.clientes.pop();
    expect(avisosAjustes(poucos, "2026-09-17")).toEqual([]);
  });
});

describe("metaPeriodo", () => {
  // setembro/2026 atendendo de segunda a sábado: 26 dias; outubro/2026: 27 dias
  const db = () => { const d = baseVazia(); d.config.meta = 6000; d.config.dias = [1, 2, 3, 4, 5, 6]; return d; };
  const r2 = (n) => Math.round(n * 100) / 100;

  it("no mês inteiro é a meta mensal", () => {
    expect(metaPeriodo(db(), "2026-09-01", "2026-09-30")).toBe(6000);
  });
  it("num dia de atendimento é a meta dividida pelos dias de atendimento do mês", () => {
    expect(metaPeriodo(db(), "2026-09-17", "2026-09-17")).toBe(230.77);
  });
  it("num domingo sem atendimento é zero", () => {
    expect(metaPeriodo(db(), "2026-09-20", "2026-09-20")).toBe(0);
  });
  it("na semana soma os dias de atendimento", () => {
    expect(metaPeriodo(db(), "2026-09-14", "2026-09-20")).toBe(r2((6000 * 6) / 26));
  });
  it("semana que atravessa o mês usa a meta diária de cada mês", () => {
    expect(metaPeriodo(db(), "2026-09-28", "2026-10-04")).toBe(r2((6000 * 3) / 26 + (6000 * 3) / 27));
  });
  it("dia fechado (feriado) não tem meta e a meta dele se divide pelos outros dias", () => {
    const d = db(); d.fechados = [{ data: "2026-09-07", motivo: "Feriado" }];
    expect(metaPeriodo(d, "2026-09-07", "2026-09-07")).toBe(0);
    expect(metaPeriodo(d, "2026-09-17", "2026-09-17")).toBe(240);
    expect(metaPeriodo(d, "2026-09-01", "2026-09-30")).toBe(6000);
  });
  it("sem meta cadastrada é zero", () => {
    const d = db(); d.config.meta = 0;
    expect(metaPeriodo(d, "2026-09-14", "2026-09-20")).toBe(0);
  });
});

describe("serviços adicionais no mesmo horário", () => {
  // Semana de 14 a 20/09, a partir do exemplo:
  // corte avulso + barba (Dinheiro), corte do pacote + sobrancelha paga em Pix,
  // e uma barba ainda marcada + pezinho.
  const comAdicionais = () => {
    const db = dbExemplo();
    db.agendamentos[0].adicionais = [{ servicoId: "barba", valor: 25 }];
    Object.assign(db.agendamentos[3], { adicionais: [{ servicoId: "sobrancelha", valor: 5 }], pagamento: "Pix" });
    db.agendamentos[6].adicionais = [{ servicoId: "pezinho", valor: 5 }];
    return db;
  };

  it("valorAdicionais soma os adicionais e trata atendimento antigo como sem adicional", () => {
    expect(valorAdicionais({ adicionais: [{ servicoId: "barba", valor: 25 }, { servicoId: "pezinho", valor: 5 }] })).toBe(30);
    expect(valorAdicionais({})).toBe(0);
  });

  it("adicional entra no faturamento como serviço, inclusive em cima de pacote", () => {
    const r = resumoPeriodo(comAdicionais(), "2026-09-14", "2026-09-20");
    expect(r).toMatchObject({ servicos: 125, campanhas: 35, pacotes: 0, total: 160, atendimentos: 5 });
  });

  it("adicional de horário ainda marcado entra no previsto", () => {
    expect(resumoPeriodo(comAdicionais(), "2026-09-14", "2026-09-20").previsto).toBe(30);
  });

  it("adicional é recebido na forma de pagamento do atendimento", () => {
    const { porPagamento } = resumoPeriodo(comAdicionais(), "2026-09-14", "2026-09-20");
    expect(porPagamento).toMatchObject({ Dinheiro: 70, Pix: 90 });
  });

  it("cada adicional conta para o próprio serviço na rosca", () => {
    expect(vendasPorServico(comAdicionais(), "2026-09-14", "2026-09-20")).toEqual([
      { id: "corte", nome: "Cabelo", valor: 150, qtd: 4 },
      { id: "cabelo-feminino", nome: "Cabelo feminino", valor: 50, qtd: 1 },
      { id: "barba", nome: "Barba", valor: 25, qtd: 1 },
      { id: "sobrancelha", nome: "Sobrancelha", valor: 5, qtd: 1 },
    ]);
  });

  it("Comum × Flex soma o valor do adicional sem contar um atendimento a mais", () => {
    expect(comumFlex(comAdicionais(), "2026-09-14", "2026-09-20")).toEqual({
      comum: { valor: 155, qtd: 3 },
      flex: { valor: 75, qtd: 2 },
    });
  });

  it("recebido no dia inclui o adicional", () => {
    expect(recebidoNoDia(comAdicionais(), "2026-09-14")).toEqual({ total: 70, porPagamento: { Dinheiro: 70 } });
    expect(recebidoNoDia(comAdicionais(), "2026-09-17").total).toBe(5);
  });

  it("adicional de falta não conta", () => {
    const db = comAdicionais();
    db.agendamentos[5].adicionais = [{ servicoId: "pezinho", valor: 5 }];
    expect(resumoPeriodo(db, "2026-09-14", "2026-09-20").total).toBe(160);
  });
});

describe("pagamento dividido entre dinheiro e Pix", () => {
  it("pagamento numa forma só vai inteiro para ela", () => {
    expect(partesPagamento("Pix", 0, 70)).toEqual({ Pix: 70 });
  });

  it("dividido guarda a parte em dinheiro e o resto é Pix", () => {
    expect(partesPagamento(DIVIDIDO, 20, 70)).toEqual({ Dinheiro: 20, Pix: 50 });
  });

  it("se o total mudar depois, o Pix se ajusta e a soma continua fechando", () => {
    expect(partesPagamento(DIVIDIDO, 20, 95)).toEqual({ Dinheiro: 20, Pix: 75 });
  });

  it("dinheiro acima do total fica limitado ao total", () => {
    expect(partesPagamento(DIVIDIDO, 100, 70)).toEqual({ Dinheiro: 70, Pix: 0 });
  });

  it("rótulo mostra as duas partes", () => {
    expect(rotuloPagamento(DIVIDIDO, 20, 70)).toMatch(/^Dinheiro R\$\s20,00 \+ Pix R\$\s50,00$/);
    expect(rotuloPagamento("Pix", 0, 70)).toBe("Pix");
  });

  it("recebido por forma de pagamento separa atendimento e pacote divididos", () => {
    const db = dbExemplo();
    // corte de 14/09 (R$ 45) pago R$ 15 em dinheiro e o resto em Pix
    Object.assign(db.agendamentos[0], { pagamento: DIVIDIDO, emDinheiro: 15 });
    // pacote de R$ 105 pago R$ 5 em dinheiro e o resto em Pix
    Object.assign(db.pacotes[0], { pagamento: DIVIDIDO, emDinheiro: 5 });
    const { porPagamento, total } = resumoPeriodo(db, "2026-09-01", "2026-09-30");
    const antes = resumoPeriodo(dbExemplo(), "2026-09-01", "2026-09-30");
    expect(total).toBe(antes.total);
    expect(porPagamento.Dinheiro).toBe(r(antes.porPagamento.Dinheiro - 45 + 15 + 5));
    expect(porPagamento.Pix).toBe(r(antes.porPagamento.Pix + 30 - 105 + 100));
  });

  it("recebido no dia também separa", () => {
    const db = dbExemplo();
    Object.assign(db.agendamentos[0], { pagamento: DIVIDIDO, emDinheiro: 15 });
    expect(recebidoNoDia(db, "2026-09-14")).toEqual({ total: 45, porPagamento: { Dinheiro: 15, Pix: 30 } });
  });
});

const r = (n) => Math.round(n * 100) / 100;

describe("horários do dia", () => {
  // 17/09/2026 é quinta; 18/09 é sexta
  const base = () => {
    const db = baseVazia();
    Object.assign(db.config, { abertura: "08:00", intervalo: 60, qtdHorarios: 11, dias: [1, 2, 3, 4, 5, 6], pausas: [] });
    return db;
  };
  const DE_HORA_EM_HORA = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const cedo = (db) => { db.gradeDia = { "2026-09-17": { horas: ["07:00", "12:00", "15:00"], almoco: { de: "12:00", minutos: 60 } } }; return db; };

  it("sem personalizar, o dia segue a grade padrão de hora em hora", () => {
    expect(gradeDoDia(base(), "2026-09-17")).toEqual(DE_HORA_EM_HORA);
  });

  it("dia personalizado usa a lista dele, em ordem, e não mexe nos outros dias", () => {
    const db = base();
    db.gradeDia = { "2026-09-17": { horas: ["09:30", "06:40", "07:15"], almoco: null } };
    expect(gradeDoDia(db, "2026-09-17")).toEqual(["06:40", "07:15", "09:30"]);
    expect(gradeDoDia(db, "2026-09-18")).toEqual(DE_HORA_EM_HORA);
  });

  it("almoço do dia bloqueia só o que cai dentro dele, naquele dia", () => {
    const db = cedo(base());
    expect(pausaDoDia(db, "2026-09-17", "12:30")).toMatchObject({ motivo: "Almoço", de: "12:00", ate: "13:00" });
    expect(pausaDoDia(db, "2026-09-17", "13:00")).toBe(null);
    expect(pausaDoDia(db, "2026-09-18", "12:30")).toBe(null);
  });

  it("o início do almoço aparece na agenda mesmo que não esteja na lista", () => {
    const db = base();
    db.gradeDia = { "2026-09-17": { horas: ["11:00", "13:00"], almoco: { de: "12:10", minutos: 40 } } };
    expect(horasDoDia(db, "2026-09-17")).toEqual(["11:00", "12:10", "13:00"]);
  });

  it("vagas livres seguem o dia personalizado e pulam o almoço", () => {
    const v = vagasLivres(cedo(base()), "2026-09-17", "2026-09-17", new Date(2026, 8, 17, 6)).map((x) => x.hora);
    expect(v).toEqual(["07:00", "15:00"]);
  });

  it("capacidade do dia conta os horários dele menos o almoço", () => {
    expect(capacidadePeriodo(cedo(base()), "2026-09-17", "2026-09-17")).toBe(2);
  });

  it("horários para remarcar seguem o dia personalizado", () => {
    expect(horasLivresNoDia(cedo(base()), "2026-09-17", null, new Date(2026, 8, 17, 6))).toEqual(["07:00", "15:00"]);
  });

  it("pausa fixa desligada não bloqueia nada", () => {
    const db = base();
    db.config.pausas = [{ id: "a", motivo: "Almoço", dias: [4], de: "12:00", ate: "13:00", ativa: false }];
    expect(pausaDoDia(db, "2026-09-17", "12:00")).toBe(null);
    db.config.pausas[0].ativa = true;
    expect(pausaDoDia(db, "2026-09-17", "12:00")).toMatchObject({ motivo: "Almoço" });
  });
});

describe("desconto por serviço e ofertas com mais de um serviço", () => {
  // Cabelo (corte) 45, Barba 25, Sobrancelha 5, Alisamento 60
  const flex = (extra = {}) => ({ id: "mattsflex", nome: "Mats Flex", tipo: "vaga", descontoTipo: "porServico", descontos: { corte: 15, barba: 5 }, ativa: true, ...extra });

  it("por serviço: cada serviço tem o seu desconto em R$; sem valor, preço cheio", () => {
    expect(precoCampanha(flex(), 45, "corte")).toBe(30);
    expect(precoCampanha(flex(), 25, "barba")).toBe(20);
    expect(precoCampanha(flex(), 5, "sobrancelha")).toBe(5);
    expect(precoCampanha(flex({ descontos: { corte: 50 } }), 45, "corte")).toBe(0);
  });

  it("os modos antigos continuam iguais", () => {
    expect(precoCampanha({ descontoTipo: "valor", descontoValor: 10 }, 45, "corte")).toBe(35);
    expect(precoCampanha({ descontoTipo: "pct", descontoPct: 20 }, 45, "corte")).toBe(36);
    expect(precoCampanha({ descontoTipo: "preco", descontoValor: 30 }, 45, "corte")).toBe(30);
  });

  it("a campanha cobre um serviço quando dá desconto nele", () => {
    expect(campanhaCobre(flex(), "corte")).toBe(true);
    expect(campanhaCobre(flex(), "sobrancelha")).toBe(false);
    expect(campanhaCobre({ tipo: "vaga", descontoTipo: "valor", descontoValor: 10 }, "sobrancelha")).toBe(true);
    const deServicos = { tipo: "servico", descontoTipo: "pct", descontoPct: 10, servicoIds: ["barba"] };
    expect(campanhaCobre(deServicos, "barba")).toBe(true);
    expect(campanhaCobre(deServicos, "corte")).toBe(false);
    expect(campanhaCobre({ ...deServicos, servicoIds: [] }, "corte")).toBe(true);
    expect(campanhaCobre(null, "corte")).toBe(false);
  });

  it("o rótulo por serviço lista os descontos na ordem da tabela", () => {
    const db = baseVazia();
    expect(rotuloDesconto(flex({ descontos: { barba: 5, corte: 15 } }), db)).toBe("Cabelo −R$ 15, Barba −R$ 5");
    expect(rotuloDesconto(flex(), undefined)).toBe("desconto por serviço");
    expect(rotuloDesconto({ descontoTipo: "valor", descontoValor: 10 }, db)).toBe("R$ 10 off");
  });

  it("combo: cada serviço com o seu desconto, e a soma é o preço da oferta", () => {
    const o = montarOferta(baseVazia(), flex(), ["barba", "corte"]);
    expect(o).toEqual({ servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }], total: 50, cheio: 70 });
  });

  it("serviço sem desconto entra pelo preço cheio junto de um com desconto", () => {
    const o = montarOferta(baseVazia(), flex(), ["corte", "sobrancelha"]);
    expect(o).toMatchObject({ servicoId: "corte", valor: 30, adicionais: [{ servicoId: "sobrancelha", valor: 5 }], total: 35, cheio: 50 });
  });

  it("o principal é o primeiro serviço com desconto, mesmo que outro venha antes na tabela", () => {
    const o = montarOferta(baseVazia(), flex({ descontos: { barba: 5 } }), ["corte", "barba"]);
    expect(o).toMatchObject({ servicoId: "barba", valor: 20, adicionais: [{ servicoId: "corte", valor: 45 }], total: 65 });
  });

  it("sem nenhum serviço com desconto não existe oferta", () => {
    expect(montarOferta(baseVazia(), flex(), ["sobrancelha"])).toBe(null);
    expect(montarOferta(baseVazia(), flex(), [])).toBe(null);
  });

  it("nas campanhas antigas o desconto vale para cada serviço da oferta", () => {
    const o = montarOferta(baseVazia(), { tipo: "vaga", descontoTipo: "pct", descontoPct: 20 }, ["corte", "barba"]);
    expect(o).toMatchObject({ valor: 36, adicionais: [{ servicoId: "barba", valor: 20 }], total: 56, cheio: 70 });
  });

  it("primeiro serviço coberto pela campanha, para começar a escolha", () => {
    expect(primeiroCoberto(baseVazia(), flex({ descontos: { barba: 5 } }))).toBe("barba");
    expect(primeiroCoberto(baseVazia(), flex({ descontos: {} }))).toBe(undefined);
  });

  it("total, preço cheio e serviços de uma oferta gravada", () => {
    const db = baseVazia();
    const a = { servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }] };
    expect(idsServicos(a)).toEqual(["corte", "barba"]);
    expect(totalOferta(a)).toBe(50);
    expect(cheioDe(db, a)).toBe(70);
    expect(totalOferta({ servicoId: "corte", valor: 35 })).toBe(35);
  });
});

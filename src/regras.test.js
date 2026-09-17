import { describe, expect, it } from "vitest";
import { baseVazia } from "./dados.js";
import {
  capacidadeMes, capacidadePeriodo, comumFlex, faturamentoMes, fatiasRosca, intervaloPeriodo, resumoPeriodo, vendasPorServico,
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

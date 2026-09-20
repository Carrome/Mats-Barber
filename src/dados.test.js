import { describe, expect, it } from "vitest";
import { abrirDados, baseVazia, migrar } from "./dados.js";
import { PAGAMENTOS } from "./util.js";

describe("formas de pagamento", () => {
  it("a barbearia só aceita Pix e Dinheiro", () => {
    expect(PAGAMENTOS).toEqual(["Pix", "Dinheiro"]);
  });

  it("migração converte cartão para Dinheiro em atendimentos, pacotes e padrão", () => {
    const d = baseVazia();
    d.config.pagamentoPadrao = "Cartão de crédito";
    d.agendamentos.push(
      { id: "a1", data: "2026-09-01", hora: "10:00", tipo: "avulso", valor: 45, status: "concluido", pagamento: "Cartão de débito" },
      { id: "a2", data: "2026-09-01", hora: "11:00", tipo: "avulso", valor: 45, status: "concluido", pagamento: "Pix" },
      { id: "a3", data: "2026-09-01", hora: "12:00", tipo: "avulso", valor: 45, status: "concluido", pagamento: "" },
    );
    d.pacotes.push({ id: "p1", valorPago: 105, pagamento: "Cartão de crédito" });
    const m = migrar(d);
    expect(m.agendamentos.map((a) => a.pagamento)).toEqual(["Dinheiro", "Pix", ""]);
    expect(m.pacotes[0].pagamento).toBe("Dinheiro");
    expect(m.config.pagamentoPadrao).toBe("Dinheiro");
  });

  it("migrar duas vezes dá o mesmo resultado", () => {
    const d = baseVazia();
    d.agendamentos.push({ id: "a1", data: "2026-09-01", hora: "10:00", tipo: "avulso", valor: 45, status: "concluido", pagamento: "Cartão de crédito" });
    const uma = migrar(d);
    expect(migrar(JSON.parse(JSON.stringify(uma)))).toEqual(uma);
  });
});

const SERVICOS = [
  { id: "corte", nome: "Cabelo", preco: 45 },
  { id: "cabelo-feminino", nome: "Cabelo feminino", preco: 50 },
  { id: "barba", nome: "Barba", preco: 25 },
  { id: "sobrancelha", nome: "Sobrancelha", preco: 5 },
  { id: "pezinho", nome: "Pezinho", preco: 5 },
  { id: "alisamento", nome: "Alisamento", preco: 60 },
];

describe("serviços da barbearia", () => {
  it("dados novos já vêm com a tabela de serviços da barbearia", () => {
    expect(baseVazia().servicos).toEqual(SERVICOS);
  });

  it("dados reais de versão anterior ganham os serviços que faltam, sem perder nada", () => {
    const d = { versao: 2, servicos: [{ id: "corte", nome: "Corte", preco: 50 }, { id: "barba", nome: "Barba", preco: 25 }, { id: "combo", nome: "Corte + barba", preco: 70 }], clientes: [{ id: "c1", nome: "Ana" }] };
    const m = migrar(d);
    expect(m.servicos.map((s) => [s.id, s.nome, s.preco])).toEqual([
      ["corte", "Cabelo", 50], ["barba", "Barba", 25], ["combo", "Corte + barba", 70],
      ["cabelo-feminino", "Cabelo feminino", 50], ["sobrancelha", "Sobrancelha", 5], ["pezinho", "Pezinho", 5], ["alisamento", "Alisamento", 60],
    ]);
    expect(m.clientes).toHaveLength(1);
  });

  it("não renomeia um serviço que o dono já personalizou", () => {
    const m = migrar({ versao: 2, servicos: [{ id: "corte", nome: "Degradê", preco: 45 }] });
    expect(m.servicos[0].nome).toBe("Degradê");
  });

  it("na versão atual não recoloca serviço que o dono excluiu", () => {
    const d = baseVazia();
    d.servicos = d.servicos.filter((s) => s.id !== "pezinho");
    expect(migrar(d).servicos.map((s) => s.id)).not.toContain("pezinho");
  });
});

describe("abrirDados", () => {
  it("sem nada salvo abre os dados de exemplo", () => {
    expect(abrirDados(null).demo).toBe(true);
  });
  it("dados de exemplo de versão anterior são gerados de novo com os serviços atuais", () => {
    const antigo = { versao: 2, demo: true, servicos: [{ id: "combo", nome: "Corte + barba", preco: 70 }], clientes: [], agendamentos: [] };
    const d = abrirDados(antigo);
    expect(d.demo).toBe(true);
    expect(d.servicos.map((s) => s.id)).toContain("alisamento");
    expect(d.agendamentos.length).toBeGreaterThan(0);
    expect(d.agendamentos.some((a) => a.servicoId === "combo")).toBe(false);
  });
  it("dados reais nunca são trocados pelo exemplo", () => {
    const d = abrirDados({ versao: 2, demo: false, clientes: [{ id: "c1", nome: "Ana" }] });
    expect(d.demo).toBe(false);
    expect(d.clientes).toHaveLength(1);
  });
});

describe("nome da barbearia", () => {
  it("quem estava no nome antigo passa a ver Barbearia do Matheus", () => {
    const m = migrar({ versao: 3, config: { nome: "Barbearia do Matts" } });
    expect(m.config.nome).toBe("Barbearia do Matheus");
  });

  it("nome escolhido à mão pelo dono não é sobrescrito", () => {
    const m = migrar({ versao: 3, config: { nome: "Studio do Zé" } });
    expect(m.config.nome).toBe("Studio do Zé");
  });

  it("quem já está na versão nova não é mexido de novo", () => {
    const m = migrar({ versao: 4, config: { nome: "Barbearia do Matts" } });
    expect(m.config.nome).toBe("Barbearia do Matts");
  });

  it("instalação nova já nasce com o nome certo", () => {
    expect(baseVazia().config.nome).toBe("Barbearia do Matheus");
  });
});

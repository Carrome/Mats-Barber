import { describe, expect, it } from "vitest";
import { abrirReal, baseVazia, migrar, montarPacote } from "./dados.js";
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

describe("abrirReal", () => {
  it("dados reais nunca são trocados pelo exemplo", () => {
    const d = abrirReal({ versao: 2, demo: false, clientes: [{ id: "c1", nome: "Ana" }] });
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

describe("serviços adicionais", () => {
  it("atendimento antigo ganha lista de adicionais vazia", () => {
    const d = baseVazia();
    d.agendamentos.push({ id: "a1", data: "2026-09-01", hora: "10:00", tipo: "avulso", servicoId: "corte", valor: 45, status: "concluido" });
    expect(migrar(d).agendamentos[0].adicionais).toEqual([]);
  });

  it("adicionais existentes são mantidos, com o valor arredondado em centavos", () => {
    const d = baseVazia();
    d.agendamentos.push({ id: "a1", data: "2026-09-01", hora: "10:00", tipo: "avulso", servicoId: "corte", valor: 45, status: "concluido", adicionais: [{ servicoId: "barba", valor: 24.999999 }] });
    expect(migrar(d).agendamentos[0].adicionais).toEqual([{ servicoId: "barba", valor: 25 }]);
  });
});

describe("venda de pacote com pagamento dividido", () => {
  it("guarda a parte em dinheiro", () => {
    const p = montarPacote(baseVazia(), { clienteId: "c1", planoId: "flex3", dataCompra: "2026-09-01", pagamento: "Dividido", emDinheiro: 40 });
    expect(p).toMatchObject({ pagamento: "Dividido", emDinheiro: 40 });
  });
  it("numa forma só não guarda parte em dinheiro", () => {
    const p = montarPacote(baseVazia(), { clienteId: "c1", planoId: "flex3", dataCompra: "2026-09-01", pagamento: "Pix", emDinheiro: 40 });
    expect(p.emDinheiro).toBe(0);
  });
});

describe("horários de hora em hora", () => {
  it("instalação nova já vem de hora em hora, sem dia personalizado", () => {
    expect(baseVazia().config).toMatchObject({ intervalo: 60, qtdHorarios: 11 });
    expect(baseVazia().gradeDia).toEqual({});
  });

  it("quem estava no padrão antigo de 45 min passa para 1 h, terminando no mesmo horário", () => {
    const m = migrar({ versao: 4, config: { abertura: "08:00", intervalo: 45, qtdHorarios: 15 } });
    expect(m.config).toMatchObject({ intervalo: 60, qtdHorarios: 11 });
  });

  it("quem já tinha escolhido outra duração fica como está", () => {
    expect(migrar({ versao: 4, config: { intervalo: 30, qtdHorarios: 20 } }).config).toMatchObject({ intervalo: 30, qtdHorarios: 20 });
  });

  it("almoço fixo fica desligado; as outras pausas continuam valendo", () => {
    const m = migrar({ versao: 4, config: { pausas: [
      { id: "a", motivo: "Almoço", dias: [1], de: "12:00", ate: "13:00" },
      { id: "s", motivo: "Sábado só até 14h", dias: [6], de: "14:00", ate: "23:59" },
    ] } });
    expect(m.config.pausas.map((p) => p.ativa)).toEqual([false, true]);
  });

  it("depois de convertido, o que o dono escolher de novo fica", () => {
    const m = migrar({ versao: 5, config: { intervalo: 45, qtdHorarios: 15, pausas: [{ id: "a", motivo: "Almoço", dias: [1], de: "12:00", ate: "13:00", ativa: true }] } });
    expect(m.config).toMatchObject({ intervalo: 45, qtdHorarios: 15 });
    expect(m.config.pausas[0].ativa).toBe(true);
  });
});

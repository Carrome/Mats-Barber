// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Agenda, PendenciasSheet, SlotSheet } from "./Agenda.jsx";
import { baseVazia } from "../dados.js";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});

afterEach(cleanup);

function dbComVagaVendida() {
  const db = baseVazia();
  db.clientes.push({ id: "c1", nome: "João Silva", telefone: "", obs: "", aniversario: "", indicadoPor: "" });
  db.agendamentos.push({
    id: "a1", data: "2026-09-14", hora: "10:00", tipo: "campanha", campanhaId: "mattsflex", clienteId: "c1",
    servicoId: "corte", valor: 35, valorOferta: 35, deOferta: true, status: "concluido", pagamento: "Pix", obs: "",
  });
  return db;
}

function abrirVagaVendida() {
  const db = dbComVagaVendida();
  const props = { db, update: vi.fn(), notify: vi.fn(), ask: vi.fn(), abrir: { cliente: vi.fn() }, onClose: vi.fn() };
  render(<SlotSheet {...props} data="2026-09-14" hora="10:00" />);
  return props;
}

describe("Desfazer venda da vaga", () => {
  it("pede confirmação antes de mexer na venda", () => {
    const p = abrirVagaVendida();
    fireEvent.click(screen.getByText("Desfazer venda da vaga"));
    expect(p.update).not.toHaveBeenCalled();
    expect(p.ask).toHaveBeenCalledTimes(1);
    expect(p.ask.mock.calls[0][0]).toMatch(/João Silva/);
  });

  it("depois de confirmar, volta a vaga para oferta com Desfazer disponível", () => {
    const p = abrirVagaVendida();
    fireEvent.click(screen.getByText("Desfazer venda da vaga"));
    p.ask.mock.calls[0][1]();

    expect(p.update).toHaveBeenCalledTimes(1);
    const [fn, desfazivel] = p.update.mock.calls[0];
    expect(desfazivel).toBe(true);
    const ag = fn(dbComVagaVendida()).agendamentos.find((a) => a.id === "a1");
    expect(ag).toMatchObject({ tipo: "oferta", clienteId: null, status: "agendado", pagamento: "", deOferta: false, valor: 35 });
    expect(p.notify).toHaveBeenCalledWith(expect.any(String), true);
  });
});

describe("aviso de atendimentos sem fechar", () => {
  it("aparece na agenda, com o botão de fechar agora", () => {
    const db = baseVazia();
    db.clientes.push({ id: "c1", nome: "João Silva" });
    db.agendamentos.push({ id: "a1", data: "2020-01-02", hora: "10:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "agendado", pagamento: "", obs: "" });
    const abrir = { agenda: vi.fn(), aba: vi.fn(), cliente: vi.fn(), pacote: vi.fn(), horario: vi.fn(), pendencias: vi.fn() };
    render(<Agenda db={db} update={vi.fn()} notify={vi.fn()} ask={vi.fn()} abrir={abrir} />);
    expect(screen.getByText(/sem fechar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar agora" }));
    expect(abrir.pendencias).toHaveBeenCalled();
  });
});

describe("serviços adicionais no atendimento", () => {
  const dbCom = (extra = {}) => {
    const db = baseVazia();
    db.clientes.push({ id: "c1", nome: "João Silva", telefone: "" });
    db.pacotes.push({ id: "p1", codigo: "F3-001", clienteId: "c1", planoId: "flex3", planoNome: "Mats Flex 3", servicoId: "corte", qtd: 3, valorPago: 105, dataCompra: "2026-09-01", validadeDias: 45, extraDias: 0 });
    db.agendamentos.push({ id: "a1", data: "2026-09-14", hora: "10:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "agendado", pagamento: "", obs: "", adicionais: [], ...extra });
    return db;
  };
  const abrirCom = (extra) => {
    const props = { db: dbCom(extra), update: vi.fn(), notify: vi.fn(), ask: vi.fn(), abrir: { cliente: vi.fn() }, onClose: vi.fn() };
    render(<SlotSheet {...props} data="2026-09-14" hora="10:00" />);
    return props;
  };
  // aplica a última alteração pedida a uma cópia nova dos dados
  const aplicar = (p, extra) => p.update.mock.calls.at(-1)[0](dbCom(extra)).agendamentos[0];
  const BARBA = { servicoId: "barba", valor: 25 };

  it("acrescenta o serviço escolhido, pelo preço da tabela", () => {
    const p = abrirCom();
    fireEvent.change(screen.getByLabelText("Adicionar serviço"), { target: { value: "barba" } });
    expect(aplicar(p).adicionais).toEqual([BARBA]);
  });

  it("mostra o adicional e o total do atendimento", () => {
    abrirCom({ adicionais: [BARBA] });
    expect(screen.getByRole("button", { name: "Remover Barba" })).toBeTruthy();
    expect(screen.getByText("Total").parentElement.textContent).toMatch(/70,00/);
  });

  it("remove um adicional", () => {
    const p = abrirCom({ adicionais: [BARBA] });
    fireEvent.click(screen.getByRole("button", { name: "Remover Barba" }));
    expect(aplicar(p, { adicionais: [BARBA] }).adicionais).toEqual([]);
  });

  it("em horário de pacote com adicional concluído, pede a forma de pagamento do adicional", () => {
    abrirCom({ tipo: "pacote", pacoteId: "p1", valor: 0, status: "concluido", adicionais: [BARBA] });
    expect(screen.getByRole("button", { name: "Pix" })).toBeTruthy();
  });

  it("em horário de pacote sem adicional, não há o que pagar", () => {
    abrirCom({ tipo: "pacote", pacoteId: "p1", valor: 0, status: "concluido" });
    expect(screen.queryByRole("button", { name: "Pix" })).toBe(null);
  });

  it("desfazer a venda da vaga tira os adicionais junto", () => {
    const p = abrirCom({ tipo: "campanha", campanhaId: "mattsflex", servicoId: "corte", valor: 35, valorOferta: 35, deOferta: true, adicionais: [BARBA] });
    fireEvent.click(screen.getByText("Desfazer venda da vaga"));
    p.ask.mock.calls[0][1]();
    expect(aplicar(p, { deOferta: true, adicionais: [BARBA] })).toMatchObject({ tipo: "oferta", adicionais: [] });
  });
});

describe("fechamento rápido com pagamento dividido", () => {
  it("fecha o atendimento com a parte em dinheiro e o resto no Pix", () => {
    const db = baseVazia();
    db.clientes.push({ id: "c1", nome: "João Silva" });
    db.agendamentos.push({ id: "a1", data: "2020-01-02", hora: "10:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "agendado", pagamento: "", obs: "", adicionais: [] });
    const update = vi.fn();
    render(<PendenciasSheet db={db} update={update} notify={vi.fn()} ask={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Forma de pagamento"), { target: { value: "Dividido" } });
    fireEvent.change(screen.getByLabelText("Valor em dinheiro"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /Feito/ }));
    const ag = update.mock.calls.at(-1)[0](JSON.parse(JSON.stringify(db))).agendamentos[0];
    expect(ag).toMatchObject({ status: "concluido", pagamento: "Dividido", emDinheiro: 15 });
  });
});

describe("horários do dia", () => {
  const DIA = "2026-09-17"; // quinta
  const dbDia = (extra = (db) => db) => {
    const db = baseVazia();
    db.clientes.push({ id: "c1", nome: "João Silva" });
    return extra(db);
  };
  const abrirDia = (db) => {
    const update = vi.fn();
    const abrir = { agenda: vi.fn(), aba: vi.fn(), cliente: vi.fn(), pacote: vi.fn(), horario: vi.fn(), pendencias: vi.fn() };
    render(<Agenda db={db} update={update} notify={vi.fn()} ask={vi.fn()} abrir={abrir} dataInicial={DIA} />);
    fireEvent.click(screen.getAllByRole("button", { name: "opções do dia" })[0]);
    return update;
  };
  const aplicar = (update, db) => update.mock.calls.at(-1)[0](JSON.parse(JSON.stringify(db)));

  it("tira um horário só deste dia", () => {
    const db = dbDia();
    const update = abrirDia(db);
    fireEvent.click(screen.getByRole("button", { name: "Tirar 09:00" }));
    const horas = aplicar(update, db).gradeDia[DIA].horas;
    expect(horas).not.toContain("09:00");
    expect(horas).toContain("08:00");
  });

  it("horário com cliente marcado não pode ser tirado", () => {
    const db = dbDia((d) => { d.agendamentos.push({ id: "a1", data: DIA, hora: "10:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "agendado", pagamento: "", obs: "", adicionais: [] }); return d; });
    abrirDia(db);
    expect(screen.queryByRole("button", { name: "Tirar 10:00" })).toBe(null);
    expect(screen.getByText("tem horário marcado")).toBeTruthy();
  });

  it("acrescenta um horário em qualquer hora", () => {
    const db = dbDia();
    const update = abrirDia(db);
    fireEvent.change(screen.getByLabelText("Novo horário"), { target: { value: "06:40" } });
    fireEvent.click(screen.getByRole("button", { name: /Acrescentar/ }));
    expect(aplicar(update, db).gradeDia[DIA].horas[0]).toBe("06:40");
  });

  it("marca o almoço do dia", () => {
    const db = dbDia();
    const update = abrirDia(db);
    fireEvent.click(screen.getByLabelText("Almoço neste dia"));
    expect(aplicar(update, db).gradeDia[DIA].almoco).toEqual({ de: "12:00", minutos: 60 });
  });

  it("volta o dia para o padrão", () => {
    const db = dbDia((d) => { d.gradeDia = { [DIA]: { horas: ["07:00"], almoco: null } }; return d; });
    const update = abrirDia(db);
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao padrão" }));
    expect(aplicar(update, db).gradeDia[DIA]).toBeUndefined();
  });

  it("o almoço aparece na agenda daquele dia", () => {
    const db = dbDia((d) => { d.gradeDia = { [DIA]: { horas: ["11:00", "13:00"], almoco: { de: "12:00", minutos: 60 } } }; return d; });
    const abrir = { agenda: vi.fn(), aba: vi.fn(), cliente: vi.fn(), pacote: vi.fn(), horario: vi.fn(), pendencias: vi.fn() };
    render(<Agenda db={db} update={vi.fn()} notify={vi.fn()} ask={vi.fn()} abrir={abrir} dataInicial={DIA} />);
    expect(screen.getByRole("button", { name: /12:00 Almoço/ })).toBeTruthy();
  });
});

describe("oferta com mais de um serviço", () => {
  // Mats Flex com R$ 15 no cabelo e R$ 5 na barba; 10/01/2030 é uma quinta-feira
  const dbFlex = () => {
    const db = baseVazia();
    Object.assign(db.campanhas.find((c) => c.id === "mattsflex"), { descontoTipo: "porServico", descontos: { corte: 15, barba: 5 } });
    db.clientes.push({ id: "c1", nome: "João Silva", telefone: "" });
    return db;
  };
  const combo = { servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }] };
  const dbComOferta = () => {
    const db = dbFlex();
    db.agendamentos.push({ id: "o1", data: "2030-01-10", hora: "10:00", tipo: "oferta", campanhaId: "mattsflex", ...combo, status: "agendado", pagamento: "", obs: "" });
    return db;
  };
  const abrirSlot = (db, hora = "10:00") => {
    const props = { db, update: vi.fn(), notify: vi.fn(), ask: vi.fn(), abrir: { cliente: vi.fn() }, onClose: vi.fn() };
    render(<SlotSheet {...props} data="2030-01-10" hora={hora} />);
    return props;
  };

  it("ofertar vaga pela agenda com cabelo + barba grava o combo com o desconto de cada um", () => {
    const p = abrirSlot(dbFlex(), "11:00");
    fireEvent.click(screen.getByRole("radio", { name: "Ofertar vaga" }));
    const servicos = screen.getByRole("group", { name: "Serviços da oferta" });
    fireEvent.click(within(servicos).getByRole("button", { name: "Barba" }));
    fireEvent.click(screen.getByRole("button", { name: "Ofertar vaga" }));
    const [fn] = p.update.mock.calls[0];
    const nova = fn(dbFlex()).agendamentos.find((a) => a.hora === "11:00");
    expect(nova).toMatchObject({ tipo: "oferta", campanhaId: "mattsflex", ...combo });
  });

  it("a tela da oferta mostra os serviços e o total, e vender mantém o combo", () => {
    const p = abrirSlot(dbComOferta());
    expect(screen.getByText(/Cabelo \+ Barba/)).toBeTruthy();
    expect(document.body.textContent).toMatch(/R\$\s*50,00/);
    fireEvent.click(screen.getByRole("button", { name: /João Silva/ }));
    fireEvent.click(screen.getByRole("button", { name: "Vender vaga" }));
    const [fn] = p.update.mock.calls[0];
    const vendida = fn(dbComOferta()).agendamentos[0];
    expect(vendida).toMatchObject({ tipo: "campanha", clienteId: "c1", deOferta: true, valor: 30, valorOferta: 30, adicionais: combo.adicionais, adicionaisOferta: combo.adicionais });
  });

  it("desfazer a venda devolve a oferta com os mesmos serviços", () => {
    const db = dbFlex();
    db.agendamentos.push({ id: "o1", data: "2030-01-10", hora: "10:00", tipo: "campanha", campanhaId: "mattsflex", clienteId: "c1", deOferta: true, valorOferta: 30, adicionaisOferta: combo.adicionais,
      servicoId: "corte", valor: 30, adicionais: [...combo.adicionais, { servicoId: "sobrancelha", valor: 5 }], status: "agendado", pagamento: "", obs: "" });
    const p = abrirSlot(db);
    fireEvent.click(screen.getByText("Desfazer venda da vaga"));
    p.ask.mock.calls[0][1]();
    const [fn] = p.update.mock.calls[0];
    // a sobrancelha foi pedida pelo cliente na hora: não faz parte da oferta
    expect(fn(structuredClone(db)).agendamentos[0]).toMatchObject({ tipo: "oferta", clienteId: null, valor: 30, adicionais: combo.adicionais });
  });
});

// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Agenda, SlotSheet } from "./Agenda.jsx";
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

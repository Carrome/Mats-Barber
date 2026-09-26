// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AvisoCobranca, CobrarDepoisSheet, ListaAReceber, RecebiSheet } from "./Cobranca.jsx";
import { baseVazia } from "../dados.js";
import { A_RECEBER, lembreteRapido, msgCobranca } from "../regras.js";
import { hojeYmd } from "../util.js";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(cleanup);

const dbCom = ({ telefone = "(22) 99999-0000", ags = [] } = {}) => {
  const db = baseVazia();
  db.clientes.push({ id: "c1", nome: "João Silva", telefone }, { id: "c2", nome: "Pedro Lima", telefone: "(22) 98888-0000" });
  db.agendamentos.push(...ags);
  return db;
};
const feito = (extra = {}) => ({ id: "a1", data: "2026-09-26", hora: "10:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "concluido", pagamento: "", emDinheiro: 0, obs: "", ...extra });

// tela com dados de verdade: o que for gravado aparece em `atual`
let atual;
function Palco({ inicial, children }) {
  const [db, setDb] = useState(inicial);
  atual = db;
  const update = (fn) => setDb((d) => fn(structuredClone(d)));
  return children({ db, update, notify: vi.fn() });
}
const ag = (id = "a1") => atual.agendamentos.find((a) => a.id === id);

describe("janela Cobrar depois", () => {
  const abrir = (db, onClose = vi.fn()) => render(
    <Palco inicial={db}>{(p) => <CobrarDepoisSheet {...p} ag={p.db.agendamentos[0]} onClose={onClose} />}</Palco>,
  );

  it("salva como a receber com o lembrete para amanhã às 9:00", () => {
    abrir(dbCom({ ags: [feito()] }));
    fireEvent.click(screen.getByRole("button", { name: "Amanhã às 9:00" }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar lembrete/ }));
    expect(ag()).toMatchObject({ pagamento: A_RECEBER, emDinheiro: 0, lembrete: lembreteRapido("amanha") });
  });

  it("dá para escolher o dia e a hora", () => {
    abrir(dbCom({ ags: [feito()] }));
    fireEvent.click(screen.getByRole("button", { name: "Escolher dia e hora" }));
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar lembrete/ }));
    expect(ag().lembrete).toEqual({ data: "2026-09-30", hora: "18:30" });
  });

  it("cobrar agora abre o WhatsApp do cliente com a mensagem e já deixa a receber", () => {
    const db = dbCom({ ags: [feito()] });
    abrir(db);
    const link = screen.getByRole("link", { name: /Cobrar agora no WhatsApp/ });
    expect(link.getAttribute("href")).toContain("wa.me/5522999990000");
    expect(decodeURIComponent(link.getAttribute("href"))).toContain(msgCobranca(db, feito()));
    fireEvent.click(link);
    expect(ag().pagamento).toBe(A_RECEBER);
  });

  it("cliente sem telefone: não tem botão de WhatsApp, só o aviso", () => {
    abrir(dbCom({ telefone: "", ags: [feito()] }));
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBe(null);
    expect(screen.getByText(/Cadastre o WhatsApp do cliente/)).toBeTruthy();
  });
});

describe("recebi o pagamento", () => {
  it("em dinheiro: vira pago hoje e o lembrete some", () => {
    const db = dbCom({ ags: [feito({ pagamento: A_RECEBER, lembrete: { data: "2026-09-26", hora: "20:00" } })] });
    render(<Palco inicial={db}>{(p) => <RecebiSheet {...p} ag={p.db.agendamentos[0]} onClose={() => {}} />}</Palco>);
    fireEvent.click(screen.getByRole("button", { name: "Dinheiro" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar recebimento/ }));
    expect(ag()).toMatchObject({ pagamento: "Dinheiro", emDinheiro: 0, pagoEm: hojeYmd(), lembrete: null });
  });
});

describe("aviso na hora de cobrar", () => {
  const agora = new Date(2026, 8, 26, 21, 0);
  const devendo = (id, clienteId, hora) => feito({ id, clienteId, pagamento: A_RECEBER, lembrete: { data: "2026-09-26", hora } });
  const abrir = (ags, onVerLista = vi.fn()) => {
    render(<Palco inicial={dbCom({ ags })}>{(p) => <AvisoCobranca {...p} agora={agora} onVerLista={onVerLista} />}</Palco>);
    return onVerLista;
  };

  it("mostra quem cobrar e o valor; +1 hora adia o lembrete", () => {
    abrir([devendo("a1", "c1", "20:00")]);
    expect(screen.getByText(/Hora de cobrar João Silva/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/R\$\s*45,00/);
    fireEvent.click(screen.getByRole("button", { name: "+1 hora" }));
    const novo = ag().lembrete;
    expect(`${novo.data} ${novo.hora}` > "2026-09-26 20:00").toBe(true);
  });

  it("depois de cobrar pelo WhatsApp o aviso some, mas continua a receber", () => {
    abrir([devendo("a1", "c1", "20:00")]);
    fireEvent.click(screen.getByRole("link", { name: /WhatsApp/ }));
    expect(ag().cobradoEm).toBeTruthy();
    expect(ag().pagamento).toBe(A_RECEBER);
    expect(screen.queryByText(/Hora de cobrar/)).toBe(null);
  });

  it("lembrete que ainda não chegou não avisa", () => {
    abrir([devendo("a1", "c1", "22:00")]);
    expect(screen.queryByText(/Hora de cobrar/)).toBe(null);
  });

  it("várias ao mesmo tempo: um aviso só, com o botão de ver a lista", () => {
    const ver = abrir([devendo("a1", "c1", "19:00"), devendo("a2", "c2", "20:00")]);
    expect(screen.getByText(/Hora de cobrar 2 clientes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver lista" }));
    expect(ver).toHaveBeenCalled();
  });
});

describe("lista A receber", () => {
  it("mostra as cobranças pendentes e o botão de recebi abre a confirmação", () => {
    const ags = [feito({ id: "a1", pagamento: A_RECEBER, lembrete: { data: "2026-09-26", hora: "20:00" } }), feito({ id: "a2", clienteId: "c2", pagamento: A_RECEBER, lembrete: null })];
    render(<Palco inicial={dbCom({ ags })}>{(p) => <ListaAReceber {...p} agora={new Date(2026, 8, 26, 12, 0)} />}</Palco>);
    expect(screen.getByText(/A receber \(2\)/)).toBeTruthy();
    expect(screen.getByText("João Silva")).toBeTruthy();
    expect(screen.getByText("Pedro Lima")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Recebi" })[0]);
    expect(screen.getByRole("button", { name: /Confirmar recebimento/ })).toBeTruthy();
  });

  it("sem nada a receber, não aparece", () => {
    const { container } = render(<Palco inicial={dbCom()}>{(p) => <ListaAReceber {...p} />}</Palco>);
    expect(container.textContent).toBe("");
  });
});

// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Planos } from "./Planos.jsx";
import { baseVazia } from "../dados.js";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(cleanup);

// Planos com dados de verdade: o que for salvo aparece de volta na tela
let atual;
function Palco() {
  const [db, setDb] = useState(baseVazia);
  atual = db;
  const update = (fn) => setDb((d) => fn(structuredClone(d)));
  return <Planos db={db} update={update} notify={() => {}} ask={() => {}} abrir={{}} sub="campanhas" setSub={() => {}} />;
}
const flex = () => atual.campanhas.find((c) => c.id === "mattsflex");
const dinheiro = (v) => new RegExp(`R\\$\\s*${v}`);

describe("campanha com desconto por serviço", () => {
  it("dá R$ 15 no cabelo e R$ 5 na barba, mostra a prévia só deles e salva", () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Por serviço" }));
    fireEvent.change(screen.getByLabelText("Desconto em Cabelo"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Desconto em Barba"), { target: { value: "5" } });

    const previa = screen.getByText("Como fica o preço:").parentElement;
    expect(within(previa).getByText("Cabelo").parentElement.textContent).toMatch(dinheiro("30,00"));
    expect(within(previa).getByText("Barba").parentElement.textContent).toMatch(dinheiro("20,00"));
    expect(within(previa).queryByText("Alisamento")).toBe(null);

    fireEvent.click(screen.getByRole("button", { name: "Salvar campanha" }));
    expect(flex()).toMatchObject({ descontoTipo: "porServico", descontos: { corte: 15, barba: 5 } });
    // o cartão da campanha mostra os descontos de cada serviço
    expect(screen.getByText("Cabelo −R$ 15, Barba −R$ 5")).toBeTruthy();
  });

  it("sem nenhum serviço com desconto não deixa salvar", () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Por serviço" }));
    expect(screen.getByRole("button", { name: "Salvar campanha" }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Desconto em Cabelo"), { target: { value: "15" } });
    expect(screen.getByRole("button", { name: "Salvar campanha" }).disabled).toBe(false);
  });

  it("serviço com zero fica sem desconto e não é gravado", () => {
    render(<Palco />);
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Por serviço" }));
    fireEvent.change(screen.getByLabelText("Desconto em Cabelo"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Desconto em Barba"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar campanha" }));
    expect(flex().descontos).toEqual({ corte: 15 });
  });
});

// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Vagas } from "./Vagas.jsx";
import { baseVazia } from "../dados.js";

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
afterEach(cleanup);

// Mats Flex com R$ 15 no cabelo e R$ 5 na barba
const dbFlex = () => {
  const db = baseVazia();
  Object.assign(db.campanhas.find((c) => c.id === "mattsflex"), { descontoTipo: "porServico", descontos: { corte: 15, barba: 5 } });
  return db;
};
let atual;
function Palco() {
  const [db, setDb] = useState(dbFlex);
  atual = db;
  const update = (fn) => setDb((d) => fn(structuredClone(d)));
  return <Vagas db={db} update={update} notify={() => {}} />;
}
const servicos = () => screen.getByRole("group", { name: "Serviços da oferta" });
const chip = (nome) => within(servicos()).getByRole("button", { name: nome });
const ofertarPrimeira = () => fireEvent.click(screen.getAllByRole("button", { name: "Ofertar" })[0]);

describe("ofertar vaga com um ou mais serviços", () => {
  it("começa com o primeiro serviço que tem desconto, já com o preço dele", () => {
    render(<Palco />);
    expect(chip("Cabelo").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Barba").getAttribute("aria-pressed")).toBe("false");
    ofertarPrimeira();
    expect(atual.agendamentos[0]).toMatchObject({ tipo: "oferta", campanhaId: "mattsflex", servicoId: "corte", valor: 30 });
  });

  it("cabelo + barba: cada um com o seu desconto, e a oferta mostra o total", () => {
    render(<Palco />);
    fireEvent.click(chip("Barba"));
    ofertarPrimeira();
    expect(atual.agendamentos[0]).toMatchObject({ servicoId: "corte", valor: 30, adicionais: [{ servicoId: "barba", valor: 20 }] });
    const emOferta = screen.getByText(/Em oferta/).closest("section");
    expect(emOferta.textContent).toMatch(/R\$\s*50,00/);
  });

  it("não deixa tirar o último serviço com desconto", () => {
    render(<Palco />);
    fireEvent.click(chip("Sobrancelha"));
    fireEvent.click(chip("Cabelo"));
    // sem o cabelo, a oferta ficaria só com a sobrancelha, que não tem desconto
    expect(chip("Cabelo").getAttribute("aria-pressed")).toBe("true");
    ofertarPrimeira();
    expect(atual.agendamentos[0]).toMatchObject({ servicoId: "corte", valor: 30, adicionais: [{ servicoId: "sobrancelha", valor: 5 }] });
  });

  it("a mensagem do WhatsApp mostra o combo, o preço cheio riscado e o total", async () => {
    render(<Palco />);
    fireEvent.click(chip("Barba"));
    ofertarPrimeira();
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    const texto = decodeURIComponent(link.getAttribute("href"));
    expect(texto).toMatch(/Cabelo \+ Barba de ~R\$\s*70,00~ por \*R\$\s*50,00\*/);
  });
});

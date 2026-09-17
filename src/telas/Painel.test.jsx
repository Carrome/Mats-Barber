// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Painel } from "./Painel.jsx";
import { baseVazia } from "../dados.js";
import { ddmm, hojeYmd } from "../util.js";

beforeAll(() => {
  // recharts mede o tamanho do contêiner
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

function abrirPainel(extra = {}) {
  const db = baseVazia();
  db.clientes.push({ id: "c1", nome: "Ana" });
  db.agendamentos.push({ id: "a1", data: hojeYmd(), hora: "00:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "concluido", pagamento: "Pix", obs: "" });
  const abrir = { agenda: vi.fn(), aba: vi.fn(), cliente: vi.fn(), pacote: vi.fn(), horario: vi.fn(), pendencias: vi.fn() };
  render(<Painel db={db} notify={vi.fn()} abrir={abrir} fazerBackup={vi.fn()} ocultar={false} alternarOcultar={vi.fn()} {...extra} />);
}

describe("Painel com seletor de período", () => {
  it("vendas por serviço tem só a rosca em R$, com o número de atendimentos antes do valor", () => {
    abrirPainel();
    const sec = screen.getByText("Vendas por serviço").closest("section");
    expect(within(sec).queryByText("Em quantidade")).toBeNull();
    const item = within(sec).getByText("Cabelo").closest("li");
    expect(item.textContent).toMatch(/1 atend\.\s*R\$\s*45,00/);
  });

  it("comum × flex tem só a rosca em R$, com o número de atendimentos antes do valor", () => {
    abrirPainel();
    const sec = screen.getByText("Comum × Flex").closest("section");
    expect(within(sec).queryByText("Em quantidade")).toBeNull();
    const item = within(sec).getByText("Comum").closest("li");
    expect(item.textContent).toMatch(/1 atend\.\s*R\$\s*45,00/);
  });

  it("abre em Hoje, sem a planilha do mês", () => {
    abrirPainel();
    expect(screen.getByRole("radio", { name: "Hoje" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(`Hoje, ${ddmm(hojeYmd())}`);
    expect(screen.queryByText(/Exportar planilha/)).toBeNull();
    expect(screen.getByText("Vendas por serviço")).toBeTruthy();
    expect(screen.getByText("Comum × Flex")).toBeTruthy();
  });

  it("em Esse mês mostra a planilha do mês", () => {
    abrirPainel();
    fireEvent.click(screen.getByRole("radio", { name: "Esse mês" }));
    expect(screen.getByText(/Exportar planilha do mês/)).toBeTruthy();
  });

  it("período sem atendimentos mostra aviso no lugar das roscas", () => {
    abrirPainel();
    fireEvent.click(screen.getByRole("radio", { name: "Mês anterior" }));
    expect(screen.getAllByText("Nenhum atendimento concluído neste período.").length).toBe(2);
  });
});

describe("Painel enxuto", () => {
  it("abaixo das roscas fica só o recebido por forma de pagamento", () => {
    abrirPainel();
    fireEvent.click(screen.getByRole("radio", { name: "Esse mês" }));
    for (const titulo of ["Faturamento por dia", "Atendimentos", "Vagas com desconto", "Pacotes", "Clientes para chamar", "Pacotes que precisam de atenção", "Últimos 6 meses"]) {
      expect(screen.queryByRole("heading", { name: titulo }), titulo).toBeNull();
    }
    expect(screen.queryByText(/Flex é o atendimento feito em vaga Flex vendida/)).toBeNull();
    expect(screen.getByRole("heading", { name: /Recebido por forma de pagamento/ })).toBeTruthy();
  });
});

describe("esconder valores", () => {
  const dinheiroVisivel = () => /R\$\s*\d/.test(document.body.textContent);

  it("com valores escondidos, nenhum valor em dinheiro aparece no painel", () => {
    abrirPainel({ ocultar: true });
    fireEvent.click(screen.getByRole("radio", { name: "Esse mês" }));
    expect(dinheiroVisivel()).toBe(false);
    expect(document.body.textContent).toContain("R$ *****");
  });

  it("o botão do painel (usado no computador, onde não há barra superior) alterna os valores", () => {
    const alternarOcultar = vi.fn();
    abrirPainel({ ocultar: false, alternarOcultar });
    fireEvent.click(screen.getByRole("button", { name: "Esconder valores" }));
    expect(alternarOcultar).toHaveBeenCalledTimes(1);
  });
});

describe("meta em todos os períodos", () => {
  // atende todos os dias, para o teste valer em qualquer data
  const abrirComMeta = () => abrirPainel({ db: (() => { const d = baseVazia(); d.config.dias = [0, 1, 2, 3, 4, 5, 6]; d.config.meta = 6000; return d; })() });

  it("em Hoje mostra a meta do dia", () => {
    abrirComMeta();
    expect(screen.getByText(/% da meta do dia de R\$/)).toBeTruthy();
  });
  it("em Essa semana mostra a meta da semana", () => {
    abrirComMeta();
    fireEvent.click(screen.getByRole("radio", { name: "Essa semana" }));
    expect(screen.getByText(/% da meta da semana de R\$/)).toBeTruthy();
  });
  it("em Esse mês continua a meta do mês", () => {
    abrirComMeta();
    fireEvent.click(screen.getByRole("radio", { name: "Esse mês" }));
    expect(screen.getByText(/% da meta de R\$\s*6\.000,00/)).toBeTruthy();
  });
});

describe("aviso de atendimentos sem fechar", () => {
  it("não aparece no painel (fica só na agenda)", () => {
    const db = baseVazia();
    db.clientes.push({ id: "c1", nome: "Ana" });
    db.agendamentos.push({ id: "a1", data: hojeYmd(), hora: "00:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "agendado", pagamento: "", obs: "" });
    abrirPainel({ db });
    expect(screen.queryByText(/sem fechar/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Fechar agora" })).toBeNull();
  });
});

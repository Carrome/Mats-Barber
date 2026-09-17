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

function abrirPainel() {
  const db = baseVazia();
  db.clientes.push({ id: "c1", nome: "Ana" });
  db.agendamentos.push({ id: "a1", data: hojeYmd(), hora: "00:00", tipo: "avulso", clienteId: "c1", servicoId: "corte", valor: 45, status: "concluido", pagamento: "Pix", obs: "" });
  const abrir = { agenda: vi.fn(), aba: vi.fn(), cliente: vi.fn(), pacote: vi.fn(), horario: vi.fn(), pendencias: vi.fn() };
  render(<Painel db={db} notify={vi.fn()} abrir={abrir} fazerBackup={vi.fn()} />);
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

  it("abre em Hoje, sem meta nem planilha do mês", () => {
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

// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormaPagamento } from "./componentes.jsx";

afterEach(cleanup);

describe("forma de pagamento", () => {
  it("oferece Pix, Dinheiro e Dividido", () => {
    render(<FormaPagamento pagamento="Pix" emDinheiro={0} total={70} onChange={() => {}} />);
    for (const nome of ["Pix", "Dinheiro", "Dividido"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
    expect(screen.queryByLabelText("Valor em dinheiro")).toBe(null);
  });

  it("escolher Dividido abre os dois campos", () => {
    const onChange = vi.fn();
    render(<FormaPagamento pagamento="Pix" emDinheiro={0} total={70} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Dividido" }));
    expect(onChange).toHaveBeenCalledWith({ pagamento: "Dividido", emDinheiro: 0 });
  });

  it("no dividido mostra a parte em dinheiro e o que falta no Pix", () => {
    render(<FormaPagamento pagamento="Dividido" emDinheiro={20} total={70} onChange={() => {}} />);
    expect(screen.getByLabelText("Valor em dinheiro").value).toBe("20");
    expect(screen.getByLabelText("Valor no Pix").value).toBe("50");
  });

  it("digitar o dinheiro guarda esse valor", () => {
    const onChange = vi.fn();
    render(<FormaPagamento pagamento="Dividido" emDinheiro={20} total={70} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Valor em dinheiro"), { target: { value: "30" } });
    expect(onChange).toHaveBeenLastCalledWith({ pagamento: "Dividido", emDinheiro: 30 });
  });

  it("digitar o Pix acerta o dinheiro pelo que falta", () => {
    const onChange = vi.fn();
    render(<FormaPagamento pagamento="Dividido" emDinheiro={20} total={70} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Valor no Pix"), { target: { value: "60" } });
    expect(onChange).toHaveBeenLastCalledWith({ pagamento: "Dividido", emDinheiro: 10 });
  });

  it("voltar para uma forma só zera a parte em dinheiro", () => {
    const onChange = vi.fn();
    render(<FormaPagamento pagamento="Dividido" emDinheiro={20} total={70} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Pix" }));
    expect(onChange).toHaveBeenCalledWith({ pagamento: "Pix", emDinheiro: 0 });
  });
});

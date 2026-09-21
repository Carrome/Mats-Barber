// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Login } from "./Login.jsx";

vi.mock("../nuvem.js", () => ({ entrar: vi.fn() }));
import { entrar } from "../nuvem.js";

describe("tela de login", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("não mostra o nome de nenhum fornecedor", () => {
    const { container } = render(<Login onEntrou={() => {}} />);
    expect(container.textContent).not.toMatch(/supabase/i);
    expect(container.textContent).not.toMatch(/nuvem gratuita/i);
  });

  it("pede usuário e senha, não e-mail", () => {
    const { container } = render(<Login onEntrou={() => {}} />);
    expect(screen.getByLabelText(/usuário/i)).toBeTruthy();
    expect(screen.getByLabelText(/senha/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/e-?mail/i);
  });

  it("entrando certo, avisa quem chamou", async () => {
    entrar.mockResolvedValue({ ok: true });
    const onEntrou = vi.fn();
    render(<Login onEntrou={onEntrou} />);
    fireEvent.change(screen.getByLabelText(/usuário/i), { target: { value: "mats" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(onEntrou).toHaveBeenCalled());
    expect(entrar).toHaveBeenCalledWith("mats", "123456");
  });

  it("entrando errado, mostra o recado e não avisa quem chamou", async () => {
    entrar.mockResolvedValue({ ok: false, erro: "Usuário ou senha incorretos." });
    const onEntrou = vi.fn();
    render(<Login onEntrou={onEntrou} />);
    fireEvent.change(screen.getByLabelText(/usuário/i), { target: { value: "mats" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "errada" } });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/incorretos/i));
    expect(onEntrou).not.toHaveBeenCalled();
  });
});

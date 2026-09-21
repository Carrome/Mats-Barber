import { describe, expect, it } from "vitest";
import { DOMINIO_LOGIN, SUPABASE_KEY, SUPABASE_URL } from "./config.js";

describe("configuração", () => {
  it("o endereço não leva o caminho da API REST", () => {
    expect(SUPABASE_URL).toBe("https://sgirqynnahnhbbeeqlvf.supabase.co");
    expect(SUPABASE_URL).not.toContain("/rest/v1");
    expect(SUPABASE_URL.endsWith("/")).toBe(false);
  });

  it("usa a chave pública, nunca a de serviço", () => {
    expect(SUPABASE_KEY.startsWith("sb_publishable_")).toBe(true);
    expect(SUPABASE_KEY).not.toContain("service_role");
  });

  it("o domínio do login é o endereço de publicação", () => {
    expect(DOMINIO_LOGIN).toBe("mats-barber.vercel.app");
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CODIGO_SYNC, DOMINIO_LOGIN, SUPABASE_KEY, SUPABASE_URL } from "./config.js";

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

  // O banco guarda só o resumo do código. Se um dos dois mudar sozinho, o app
  // passa a ser recusado e para de sincronizar sem avisar ninguém.
  it("o código de sincronia é longo e bate com o resumo gravado no SQL", () => {
    expect(CODIGO_SYNC).toMatch(/^[0-9a-f]{48}$/);
    const sql = readFileSync(new URL("../sql/02-sem-login.sql", import.meta.url), "utf8");
    const resumo = createHash("sha256").update(CODIGO_SYNC, "utf8").digest("hex");
    expect(sql).toContain(`'${resumo}'`);
  });
});

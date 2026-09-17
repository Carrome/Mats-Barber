import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const raiz = path.resolve(__dirname, "..");
const ICONES = { "icon-192.png": 192, "icon-512.png": 512, "icon-maskable-512.png": 512, "apple-touch-icon.png": 180 };
const AMARELO = [255, 244, 6];

async function analisar(arquivo) {
  const { data, info } = await sharp(arquivo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  let amarelos = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (Math.abs(data[i] - AMARELO[0]) < 40 && Math.abs(data[i + 1] - AMARELO[1]) < 40 && data[i + 2] < 90) amarelos++;
  }
  const cantos = [px(1, 1), px(info.width - 2, 1), px(1, info.height - 2), px(info.width - 2, info.height - 2)];
  return { info, cantos, fracaoAmarela: amarelos / (info.width * info.height) };
}

describe("marca Matheu's Barber", () => {
  for (const [nome, lado] of Object.entries(ICONES)) {
    it(`${nome} é ${lado}x${lado}, fundo preto e com a logo amarela`, async () => {
      const { info, cantos, fracaoAmarela } = await analisar(path.join(raiz, "public/icons", nome));
      expect([info.width, info.height]).toEqual([lado, lado]);
      for (const c of cantos) expect(Math.max(...c)).toBeLessThan(12);
      expect(fracaoAmarela).toBeGreaterThan(0.08);
    });
  }

  it("a logo usada nas telas existe e tem resolução para tela retina", async () => {
    const m = await sharp(path.join(raiz, "public/icons/logo.png")).metadata();
    expect(m.height).toBeGreaterThanOrEqual(160);
  });

  it("o app mostra a logo no lugar do poste de barbeiro", () => {
    const app = fs.readFileSync(path.join(raiz, "src/App.jsx"), "utf8");
    expect(app).not.toMatch(/mf-pole/);
    expect(app.match(/src="icons\/logo\.png"/g)?.length).toBe(3);
  });

  it("a logo original não vai junto no site publicado (fica fora de public/)", () => {
    const soltos = fs.readdirSync(path.join(raiz, "public")).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    expect(soltos).toEqual([]);
  });
});

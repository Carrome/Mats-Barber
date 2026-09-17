/* Gera a logo das telas e os ícones do PWA a partir da logo original.
   Uso: npm run marca   (rode de novo se trocar recursos/logo-matheus-barber.jpeg) */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEM = path.join(raiz, "recursos/logo-matheus-barber.jpeg");
const ICONES = path.join(raiz, "public/icons");
const PRETO = { r: 0, g: 0, b: 0, alpha: 1 };

// logo centralizada num quadrado preto; "ocupa" = fração do lado usada pela logo
async function icone(nome, lado, ocupa) {
  const caixa = Math.round(lado * ocupa);
  const logo = await sharp(ORIGEM).resize(caixa, caixa, { fit: "contain", background: PRETO }).toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 3, background: PRETO } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, colors: 64 })
    .toFile(path.join(ICONES, nome));
}

await sharp(ORIGEM).resize({ height: 240 }).png({ palette: true, colors: 64 }).toFile(path.join(ICONES, "logo.png"));
// fundo da imagem de stories (ocupa a largura inteira: 1080 px)
await sharp(ORIGEM).resize({ width: 1080 }).png({ palette: true, colors: 64 }).toFile(path.join(ICONES, "logo-grande.png"));
await icone("icon-192.png", 192, 0.9);
await icone("icon-512.png", 512, 0.9);
await icone("apple-touch-icon.png", 180, 0.86);
// maskable: o sistema pode recortar em círculo; a logo fica dentro da zona segura (80%)
await icone("icon-maskable-512.png", 512, 0.72);
console.log("Logo e ícones gerados em public/icons");

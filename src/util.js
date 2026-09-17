/* =====================================================================
   Utilitários de data, formato, WhatsApp e arquivos
   ===================================================================== */
export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_LONGO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const PAGAMENTOS = ["Pix", "Dinheiro"];

export const pad = (n, l = 2) => String(n).padStart(l, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const hojeYmd = () => ymd(new Date());
export const inicioMes = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const fimMesYmd = (d) => ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
export const segundaDe = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const mesKey = (s) => s.slice(0, 7);
export const ddmm = (s) => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const ddmmaa = (s) => { const d = parse(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const diffDias = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);
export const toMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
export const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const soma = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);
export const nomeMes = (d) => `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const momento = (data, hora) => { const d = parse(data); const [h, m] = hora.split(":").map(Number); d.setHours(h, m, 0, 0); return d; };
export const primeiroNome = (n) => (n || "").trim().split(/\s+/)[0] || "";
export const iniciais = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
export const dataLonga = (s) => { const d = parse(s); return `${DIAS_LONGO[d.getDay()]}, ${ddmm(s)}`; };
export const horaValida = (h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h || "");

/* ---------- telefone e WhatsApp ---------- */
export const digitos = (s) => (s || "").replace(/\D/g, "");

export function formatarTel(tel) {
  let d = digitos(tel);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return (tel || "").trim();
}

// Número no formato internacional exigido pelo wa.me (55 + DDD + número).
// Corrige o caso de DDD 55 (RS) e completa o DDD padrão quando o número vem sem ele.
export function foneWa(tel, ddd = "") {
  let d = digitos(tel).replace(/^0+/, "");
  if (!d) return "";
  if ((d.length === 8 || d.length === 9) && digitos(ddd).length === 2) d = digitos(ddd) + d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}
export const whats = (tel, msg, ddd) => `https://wa.me/${foneWa(tel, ddd)}?text=${encodeURIComponent(msg)}`;

/* ---------- aniversário (guardado como "DD/MM") ---------- */
export function mascaraDDMM(v) {
  const d = digitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
export function aniversarioValido(s) {
  const m = /^(\d{2})\/(\d{2})$/.exec(s || "");
  if (!m) return false;
  const dia = Number(m[1]), mes = Number(m[2]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(2024, mes, 0).getDate();
}
// Dias até o próximo aniversário (0 = hoje)
export function diasAteAniversario(s, hoje = hojeYmd()) {
  if (!aniversarioValido(s)) return null;
  const [dia, mes] = s.split("/").map(Number);
  const h = parse(hoje);
  // 29/02 em ano não bissexto vira 28/02
  const noAno = (ano) => new Date(ano, mes - 1, Math.min(dia, new Date(ano, mes, 0).getDate()));
  let alvo = noAno(h.getFullYear());
  if (ymd(alvo) < hoje) alvo = noAno(h.getFullYear() + 1);
  return diffDias(ymd(alvo), hoje);
}

/* ---------- semanas ---------- */
export function semanasDoMes(ref, dias) {
  const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  let seg = segundaDe(inicioMes(ref));
  const out = [];
  while (seg <= ultimo) {
    const tem = [0, 1, 2, 3, 4, 5, 6].some((i) => {
      const d = addDays(seg, i);
      return d.getMonth() === ref.getMonth() && dias.includes(d.getDay());
    });
    if (tem) out.push(seg);
    seg = addDays(seg, 7);
  }
  return out;
}
export const diasDaSemana = (seg, dias) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(seg, i)).filter((d) => dias.includes(d.getDay()));

/* ---------- arquivos: compartilhar (celular) ou baixar ---------- */
export async function entregarArquivo(nome, blob, titulo) {
  try {
    const file = new File([blob], nome, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: titulo || nome });
      return "compartilhado";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelado";
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "baixado";
  } catch (e) {
    return "erro";
  }
}

// CSV no padrão do Excel brasileiro (; como separador, vírgula decimal, BOM para acentos)
export function gerarCsv(linhas) {
  const cel = (v) => {
    if (typeof v === "number") return String(r2(v)).replace(".", ",");
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return new Blob(["\ufeff" + linhas.map((l) => l.map(cel).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}

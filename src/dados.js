/* =====================================================================
   Armazenamento, dados iniciais, migração e dados de exemplo
   ===================================================================== */
import { addDays, formatarTel, hojeYmd, momento, pad, PAGAMENTOS, r2, uid, ymd } from "./util.js";
import { horariosDe, pausaEm, precoCampanha, precoPlano } from "./regras.js";

export const STORE_KEY = "matts-flex-app-v1";
const KEY_ANTERIOR = STORE_KEY + "-anterior";
export const VERSAO = 4;

// Tabela de serviços da barbearia (id "corte" mantido: os planos Mats Flex apontam para ele)
export const SERVICOS_PADRAO = [
  { id: "corte", nome: "Cabelo", preco: 45 },
  { id: "cabelo-feminino", nome: "Cabelo feminino", preco: 50 },
  { id: "barba", nome: "Barba", preco: 25 },
  { id: "sobrancelha", nome: "Sobrancelha", preco: 5 },
  { id: "pezinho", nome: "Pezinho", preco: 5 },
  { id: "alisamento", nome: "Alisamento", preco: 60 },
];

const temWindowStorage = () => typeof window !== "undefined" && window.storage && window.storage.get && window.storage.set;

async function ler(chave) {
  if (temWindowStorage()) {
    const r = await window.storage.get(chave, false);
    return r ? r.value : null;
  }
  return window.localStorage.getItem(chave);
}
async function gravar(chave, txt) {
  if (temWindowStorage()) await window.storage.set(chave, txt, false);
  else window.localStorage.setItem(chave, txt);
}

export async function carregar() {
  try {
    const raw = await ler(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Erro ao carregar", e);
    return null;
  }
}

// Retorna true se salvou (false = armazenamento cheio/bloqueado)
export async function salvar(db) {
  try {
    await gravar(STORE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error("Erro ao salvar", e);
    return false;
  }
}

// Cópia de segurança automática antes de restaurar backup, apagar tudo ou carregar exemplo
export async function guardarCopiaAnterior(db) {
  try { await gravar(KEY_ANTERIOR, JSON.stringify({ salvoEm: new Date().toISOString(), db })); } catch (e) { /* sem espaço: ignora */ }
}
export async function lerCopiaAnterior() {
  try { const raw = await ler(KEY_ANTERIOR); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

export function baseVazia() {
  return {
    versao: VERSAO,
    demo: false,
    config: {
      nome: "Barbearia do Matheus", abertura: "08:00", intervalo: 45, qtdHorarios: 15, dias: [1, 2, 3, 4, 5, 6],
      alertaDias: 7, meta: 6000, ddd: "", pagamentoPadrao: "Pix", retornoPadrao: 30, toleranciaRetorno: 5,
      pausas: [], ultimoBackup: "", tema: "auto",
    },
    servicos: SERVICOS_PADRAO.map((s) => ({ ...s })),
    planos: [
      { id: "flex3", nome: "Mats Flex 3", sigla: "F3", servicoId: "corte", qtd: 3, descontoPorUso: 10, validadeDias: 45, ativo: true, somenteVagas: true, descricao: "3 cortes pagos adiantado, com R$ 10 de desconto em cada. Usados em horários Flex." },
      { id: "flex5", nome: "Mats Flex 5", sigla: "F5", servicoId: "corte", qtd: 5, descontoPorUso: 10, validadeDias: 45, ativo: true, somenteVagas: true, descricao: "5 cortes pagos adiantado, com R$ 10 de desconto em cada. Usados em horários Flex." },
    ],
    campanhas: [
      { id: "mattsflex", nome: "Mats Flex", tipo: "vaga", descontoTipo: "valor", descontoValor: 10, descontoPct: 20, servicoIds: [], inicio: "", fim: "", ativa: true, descricao: "Horário vago da agenda divulgado nos stories com preço menor." },
    ],
    clientes: [],
    pacotes: [],
    agendamentos: [],
    fechados: [],
  };
}

export function migrar(d) {
  const b = baseVazia();
  const src = d && typeof d === "object" ? d : {};
  const versaoAntiga = Number(src.versao) || 0;
  const out = { ...b, ...src, versao: VERSAO, config: { ...b.config, ...(src.config || {}) } };
  ["servicos", "planos", "campanhas"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = b[k]; });
  ["clientes", "pacotes", "agendamentos", "fechados"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  // versão 3: tabela de serviços da barbearia (acrescenta o que falta, sem apagar nem mudar preço)
  if (versaoAntiga < 3) {
    out.servicos = out.servicos.map((s) => (s.id === "corte" && s.nome === "Corte" ? { ...s, nome: "Cabelo" } : s));
    SERVICOS_PADRAO.forEach((p) => { if (!out.servicos.some((s) => s.id === p.id)) out.servicos.push({ ...p }); });
  }
  const cfg = out.config;
  // versão 4: a barbearia passou a se chamar "Barbearia do Matheus".
  // Só troca quem ainda estava no nome antigo: nome escolhido à mão fica como está.
  if (versaoAntiga < 4 && cfg.nome === "Barbearia do Matts") cfg.nome = "Barbearia do Matheus";
  if (!Array.isArray(cfg.dias) || !cfg.dias.length) cfg.dias = b.config.dias;
  if (!Array.isArray(cfg.pausas)) cfg.pausas = [];
  out.campanhas = out.campanhas.map((c) => ({ servicoIds: [], descontoTipo: "pct", descontoValor: 0, descontoPct: 0, descricao: "", ...c }));
  out.planos = out.planos.map((p) => ({ somenteVagas: false, descricao: "", ...p }));
  out.clientes = out.clientes.map((c) => ({ telefone: "", obs: "", aniversario: "", indicadoPor: "", ...c }));
  // a barbearia só aceita Pix e Dinheiro: registros antigos de cartão viram Dinheiro
  const semCartao = (p) => (/^cart[aã]o/i.test(p || "") ? "Dinheiro" : p);
  cfg.pagamentoPadrao = semCartao(cfg.pagamentoPadrao);
  out.pacotes = out.pacotes.map((p) => ({ extraDias: 0, ...p, pagamento: semCartao(p.pagamento) }));
  out.agendamentos = out.agendamentos.map((a) => ({ pagamento: "", obs: "", ...a, valor: r2(a.valor), pagamento: semCartao(a.pagamento) || "" }));
  return out;
}

// Dados ao abrir o app: exemplo antigo é gerado de novo; dados reais só migram
export function abrirDados(d) {
  if (!d) return criarDemo();
  if (d.demo && (Number(d.versao) || 0) < VERSAO) return criarDemo();
  return migrar(d);
}

export function montarPacote(db, { clienteId, planoId, dataCompra, pagamento }) {
  const plano = db.planos.find((p) => p.id === planoId);
  const doPlano = db.pacotes.filter((p) => p.planoId === planoId || p.codigo?.startsWith(plano.sigla + "-"));
  const maior = doPlano.reduce((m, p) => Math.max(m, Number((p.codigo || "").split("-")[1]) || 0), 0);
  return {
    id: uid(), codigo: `${plano.sigla}-${pad(maior + 1, 3)}`, clienteId, planoId, planoNome: plano.nome,
    servicoId: plano.servicoId, qtd: Number(plano.qtd), validadeDias: Number(plano.validadeDias), extraDias: 0,
    valorPago: precoPlano(db, plano), economia: r2(plano.qtd * plano.descontoPorUso), somenteVagas: !!plano.somenteVagas,
    dataCompra, pagamento, cancelado: false, criadoEm: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------
   Dados de exemplo: ~40 clientes com os 3 perfis do Matheus
   (a cada 15 dias, mensal e eventual), ~3 meses de histórico
   --------------------------------------------------------------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function criarDemo() {
  const db = baseVazia();
  db.demo = true;
  db.config.pausas = [
    { id: "almoco", motivo: "Almoço", dias: [1, 2, 3, 4, 5, 6], de: "12:30", ate: "13:15" },
    { id: "sabado", motivo: "Sábado só até 14h", dias: [6], de: "14:00", ate: "23:59" },
  ];
  const rnd = mulberry32(11);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const nomes = ["Rafael Monteiro", "Lucas Andrade", "Bruno Tavares", "Diego Ramos", "Felipe Nogueira", "Gustavo Pires",
    "Henrique Lopes", "Igor Barcelos", "João Vitor Silva", "Leandro Cunha", "Marcelo Dias", "Otávio Reis",
    "Pedro Henrique Costa", "Renan Duarte", "Samuel Freitas", "Thiago Moreira", "Vinícius Prado", "Wesley Campos",
    "André Luiz Rocha", "Caio Mendes", "Daniel Farias", "Eduardo Viana", "Fábio Correia", "Gabriel Antunes",
    "Hugo Martins", "Ítalo Barros", "Júlio César Lima", "Kauã Ferreira", "Luan Batista", "Matheus Guedes",
    "Nicolas Teixeira", "Paulo Sérgio Alves", "Ricardo Lemos", "Sérgio Paiva", "Tiago Brandão", "Victor Hugo Sales",
    "Yuri Pacheco", "Alexandre Braga", "Murilo Castro", "Enzo Carvalho"];
  const hoje = new Date();
  const hojeS = hojeYmd();
  db.clientes = nomes.map((nome, i) => ({
    id: "c" + i, nome,
    telefone: formatarTel(`229${pad(8100 + i * 37, 4)}${pad(1000 + i * 113, 4).slice(-4)}`),
    obs: i % 7 === 0 ? "Degradê baixo, tesoura em cima" : "",
    aniversario: i % 3 === 0 ? `${pad(((i * 7) % 28) + 1)}/${pad(((hoje.getMonth() + (i % 4)) % 12) + 1)}` : "",
    indicadoPor: i > 5 && i % 5 === 0 ? "c" + (i % 4) : "",
    criadoEm: ymd(addDays(hoje, -110)),
  }));
  // perfis: 0-11 quinzenal, 12-29 mensal, 30-39 eventual
  const intervaloDe = (i) => (i < 12 ? 15 : i < 30 ? 30 : 70);
  const sumiu = new Set(["c4", "c15", "c22", "c33"]);

  const cfg = db.config;
  const horas = horariosDe(cfg);
  const ocupado = new Set();
  const add = (a) => { ocupado.add(`${a.data} ${a.hora}`); db.agendamentos.push({ id: uid(), pagamento: "", obs: "", criadoEm: new Date().toISOString(), ...a }); };
  const diaUtil = (d) => { let x = d; while (!cfg.dias.includes(x.getDay())) x = addDays(x, 1); return x; };
  const horaLivre = (data) => {
    const livres = horas.filter((h) => !ocupado.has(`${data} ${h}`) && !pausaEm(cfg, data, h));
    return livres.length ? pick(livres) : null;
  };
  const inicio = addDays(hoje, -100);
  const limite = ymd(addDays(hoje, 6));
  const camp = db.campanhas[0];

  db.clientes.forEach((c, i) => {
    const iv = intervaloDe(i);
    let d = addDays(inicio, Math.floor(rnd() * iv));
    const servPref = i % 10 === 3 ? "alisamento" : i % 7 === 0 ? "cabelo-feminino" : i % 6 === 0 ? "barba" : i % 8 === 0 ? "sobrancelha" : i % 13 === 0 ? "pezinho" : "corte";
    while (ymd(d) <= limite) {
      const dia = diaUtil(d);
      const data = ymd(dia);
      if (data > limite) break;
      if (sumiu.has(c.id) && data > ymd(addDays(hoje, -45))) break;
      const hora = horaLivre(data);
      if (hora) {
        const passado = momento(data, hora) < hoje;
        const preco = db.servicos.find((s) => s.id === servPref).preco;
        if (passado) {
          const recente = data >= ymd(addDays(hoje, -2));
          const status = recente && rnd() < 0.35 ? "agendado" : rnd() < 0.94 ? "concluido" : "faltou";
          add({ data, hora, tipo: "avulso", clienteId: c.id, servicoId: servPref, valor: preco, status, pagamento: status === "concluido" ? pick(PAGAMENTOS) : "" });
        } else if (data >= hojeS) {
          add({ data, hora, tipo: "avulso", clienteId: c.id, servicoId: servPref, valor: preco, status: "agendado" });
        }
      }
      d = addDays(dia, iv + Math.round((rnd() - 0.5) * 6));
    }
  });

  // pacotes Mats Flex
  const vender = (clienteId, planoId, diasAtras, pagamento) => {
    const p = montarPacote(db, { clienteId, planoId, dataCompra: ymd(diaUtil(addDays(hoje, -diasAtras))), pagamento });
    db.pacotes.push(p);
    return p;
  };
  const usar = (pac, dias, status) => {
    const data = ymd(diaUtil(addDays(hoje, dias)));
    const hora = horaLivre(data);
    if (hora) add({ data, hora, tipo: "pacote", pacoteId: pac.id, clienteId: pac.clienteId, servicoId: pac.servicoId, valor: 0, status, campanhaId: camp.id, deOferta: true, valorOferta: precoCampanha(camp, 45) });
  };
  const p1 = vender("c1", "flex3", 40, "Pix");
  const p2 = vender("c13", "flex5", 9, "Dinheiro");
  const p3 = vender("c20", "flex3", 3, "Pix");
  usar(p1, -38, "concluido"); usar(p1, -20, "concluido");
  usar(p2, -6, "concluido");
  usar(p3, 2, "agendado");

  // vagas Mats Flex: vendidas, não vendidas e em oferta
  for (let d = new Date(inicio); ymd(d) <= limite; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!cfg.dias.includes(d.getDay())) continue;
    horas.forEach((hora) => {
      if (ocupado.has(`${data} ${hora}`) || pausaEm(cfg, data, hora)) return;
      const r = rnd();
      const passado = momento(data, hora) < hoje;
      const valor = precoCampanha(camp, 45);
      if (passado && r < 0.07) add({ data, hora, tipo: "campanha", campanhaId: camp.id, clienteId: pick(db.clientes).id, servicoId: "corte", valor, status: "concluido", pagamento: pick(PAGAMENTOS), deOferta: true, valorOferta: valor });
      else if (passado && r < 0.1) add({ data, hora, tipo: "oferta", campanhaId: camp.id, servicoId: "corte", valor, status: "agendado" });
      else if (!passado && data >= hojeS && r < 0.12) add({ data, hora, tipo: "oferta", campanhaId: camp.id, servicoId: "corte", valor, status: "agendado" });
    });
  }

  db.campanhas.push({ id: uid(), nome: "Amigo para Amigo", tipo: "servico", descontoTipo: "pct", descontoPct: 15, descontoValor: 0, servicoIds: [], inicio: "", fim: "", ativa: false, descricao: "Exemplo: desconto para quem indica e para quem foi indicado." });
  return db;
}

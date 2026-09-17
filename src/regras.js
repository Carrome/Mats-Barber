/* =====================================================================
   Regras de negócio
   ===================================================================== */
import {
  addDays, cap, ddmm, diffDias, fimMesYmd, fromMin, hojeYmd, inicioMes, momento, nomeMes, parse, r2, segundaDe, soma, toMin, ymd, PAGAMENTOS,
} from "./util.js";

export const TIPOS_ATENDIMENTO = ["avulso", "pacote", "campanha"];

export const servicoDe = (db, id) => db.servicos.find((s) => s.id === id);
export const clienteDe = (db, id) => db.clientes.find((c) => c.id === id);
export const campanhaDe = (db, id) => db.campanhas.find((c) => c.id === id);
export const pacoteDe = (db, id) => db.pacotes.find((p) => p.id === id);

/* ---------- planos e campanhas ---------- */
export const precoPlano = (db, p) =>
  r2((Number(p.qtd) || 0) * Math.max(0, (servicoDe(db, p.servicoId)?.preco || 0) - (Number(p.descontoPorUso) || 0)));

export function precoCampanha(c, preco) {
  if (!c) return r2(preco);
  const v = Number(c.descontoValor) || 0;
  if (c.descontoTipo === "valor") return r2(Math.max(0, preco - v));
  if (c.descontoTipo === "preco") return r2(Math.max(0, Math.min(preco, v)));
  return r2(Math.max(0, preco * (1 - (Number(c.descontoPct) || 0) / 100)));
}

export function rotuloDesconto(c) {
  if (!c) return "";
  const v = Number(c.descontoValor) || 0;
  if (c.descontoTipo === "valor") return `R$ ${String(v).replace(".", ",")} off`;
  if (c.descontoTipo === "preco") return `por R$ ${String(v).replace(".", ",")}`;
  return `${Number(c.descontoPct) || 0}% off`;
}

export const campanhaVale = (c, data) => !!c && c.ativa && (!c.inicio || data >= c.inicio) && (!c.fim || data <= c.fim);

/* ---------- pacotes ---------- */
export const venceEm = (p) => ymd(addDays(parse(p.dataCompra), (Number(p.validadeDias) || 0) + (Number(p.extraDias) || 0)));

export function infoPacote(db, p, hoje = hojeYmd()) {
  const ags = db.agendamentos.filter((a) => a.pacoteId === p.id && a.tipo === "pacote");
  const usados = ags.filter((a) => a.status !== "agendado").length;
  const reservados = ags.filter((a) => a.status === "agendado").length;
  const saldo = Math.max(0, p.qtd - usados - reservados);
  const vence = venceEm(p);
  const dias = diffDias(vence, hoje);
  let status = "Ativo";
  if (p.cancelado) status = "Cancelado";
  else if (usados >= p.qtd) status = "Concluído";
  else if (dias < 0) status = "Vencido";
  else if (dias <= (Number(db.config.alertaDias) || 0)) status = "Vence em breve";
  return { usados, reservados, saldo, vence, dias, status, ags };
}

export const TOM_STATUS = { "Ativo": "ok", "Vence em breve": "alerta", "Vencido": "erro", "Concluído": "neutro", "Cancelado": "neutro" };

// Pacotes que o cliente pode usar numa data
export function pacotesUsaveis(db, clienteId, data) {
  if (!clienteId) return [];
  return db.pacotes
    .filter((p) => p.clienteId === clienteId && !p.cancelado && p.dataCompra <= data)
    .map((p) => ({ p, i: infoPacote(db, p), plano: db.planos.find((x) => x.id === p.planoId) }))
    .filter(({ i }) => i.saldo > 0 && data <= i.vence && i.status !== "Concluído");
}

/* ---------- grade da agenda ---------- */
export const horariosDe = (cfg) =>
  Array.from({ length: Number(cfg.qtdHorarios) || 0 }, (_, i) => fromMin(toMin(cfg.abertura) + i * (Number(cfg.intervalo) || 45)))
    .filter((h) => toMin(h) < 24 * 60);

export const diaFechado = (db, data) => (db.fechados || []).find((f) => f.data === data) || null;
export const atendeNoDia = (db, data) => db.config.dias.includes(parse(data).getDay());

export function pausaEm(cfg, data, hora) {
  const dia = parse(data).getDay();
  return (cfg.pausas || []).find((p) => p.dias?.includes(dia) && p.de && p.ate && hora >= p.de && hora < p.ate) || null;
}

// Mapa "data hora" -> agendamento (o primeiro ganha; duplicados ficam na lista extra)
export function mapaAgenda(db) {
  const m = new Map();
  for (const a of db.agendamentos) {
    const k = `${a.data} ${a.hora}`;
    if (!m.has(k)) m.set(k, a);
  }
  return m;
}

// Horários exibidos num dia: grade + qualquer agendamento fora da grade (encaixes ou grade antiga)
export function horasDoDia(db, data, grade = horariosDe(db.config)) {
  const extra = db.agendamentos.filter((a) => a.data === data && !grade.includes(a.hora)).map((a) => a.hora);
  return [...new Set([...grade, ...extra])].sort();
}

export function vagasLivres(db, de, ate, agora = new Date()) {
  const horas = horariosDe(db.config);
  const ocupado = new Set(db.agendamentos.map((a) => `${a.data} ${a.hora}`));
  const out = [];
  for (let d = parse(de); ymd(d) <= ate; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!atendeNoDia(db, data) || diaFechado(db, data)) continue;
    for (const hora of horas) {
      if (momento(data, hora) <= agora) continue;
      if (pausaEm(db.config, data, hora)) continue;
      if (!ocupado.has(`${data} ${hora}`)) out.push({ data, hora });
    }
  }
  return out;
}

// Horários livres num dia para remarcar / encaixar
export function horasLivresNoDia(db, data, ignorarId, agora = new Date()) {
  const ocup = new Set(db.agendamentos.filter((a) => a.data === data && a.id !== ignorarId).map((a) => a.hora));
  return horariosDe(db.config).filter((h) => !ocup.has(h) && !pausaEm(db.config, data, h) && momento(data, h) > agora);
}

// Limites de um mês "AAAA-MM"
const limitesMes = (key) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1, 1); return [ymd(d), fimMesYmd(d)]; };

export function capacidadeMes(db, key) {
  return capacidadePeriodo(db, ...limitesMes(key));
}

export function capacidadePeriodo(db, inicio, fim) {
  const horas = horariosDe(db.config);
  let total = 0;
  for (let d = parse(inicio); ymd(d) <= fim; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!atendeNoDia(db, data) || diaFechado(db, data)) continue;
    total += horas.filter((h) => !pausaEm(db.config, data, h)).length;
  }
  return total;
}

/* ---------- períodos do painel ---------- */
export const PERIODOS = [["hoje", "Hoje"], ["semana", "Essa semana"], ["mes", "Esse mês"], ["mesAnterior", "Mês anterior"]];

export function intervaloPeriodo(periodo, agora = new Date()) {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (periodo === "semana") {
    const seg = segundaDe(hoje), dom = addDays(seg, 6);
    return { inicio: ymd(seg), fim: ymd(dom), rotulo: `Semana de ${ddmm(ymd(seg))} a ${ddmm(ymd(dom))}` };
  }
  if (periodo === "mes" || periodo === "mesAnterior") {
    const ref = periodo === "mes" ? inicioMes(hoje) : new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    return { inicio: ymd(ref), fim: fimMesYmd(ref), rotulo: cap(nomeMes(ref)) };
  }
  return { inicio: ymd(hoje), fim: ymd(hoje), rotulo: `Hoje, ${ddmm(ymd(hoje))}` };
}

const noPeriodo = (data, inicio, fim) => data >= inicio && data <= fim;

// Vaga Flex vendida: pela oferta (deOferta) ou campanha de horário vago
export const ehFlex = (db, a) => !!a.deOferta || (a.tipo === "campanha" && campanhaDe(db, a.campanhaId)?.tipo === "vaga");

// Valor de um atendimento concluído; uso de pacote vale o que o cliente pagou por corte
export function valorAtendimento(db, a) {
  if (a.tipo !== "pacote") return Number(a.valor) || 0;
  const p = pacoteDe(db, a.pacoteId);
  return p && Number(p.qtd) ? r2(p.valorPago / p.qtd) : 0;
}

const concluidosNoPeriodo = (db, inicio, fim) =>
  db.agendamentos.filter((a) => a.status === "concluido" && TIPOS_ATENDIMENTO.includes(a.tipo) && noPeriodo(a.data, inicio, fim));

export function vendasPorServico(db, inicio, fim) {
  const grupos = new Map();
  for (const a of concluidosNoPeriodo(db, inicio, fim)) {
    const g = grupos.get(a.servicoId) || { id: a.servicoId, nome: servicoDe(db, a.servicoId)?.nome || "Serviço removido", valor: 0, qtd: 0 };
    g.valor = r2(g.valor + valorAtendimento(db, a)); g.qtd++;
    grupos.set(a.servicoId, g);
  }
  return [...grupos.values()].sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
}

// Fatias de uma rosca pela medida ("valor" ou "qtd"): no máximo 6, as menores viram "Outros"
export function fatiasRosca(itens, medida, max = 6) {
  const fatias = itens.map((x) => ({ id: x.id, nome: x.nome, v: Number(x[medida]) || 0, qtd: Number(x.qtd) || 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (fatias.length <= max) return fatias;
  const resto = fatias.slice(max - 1);
  return [...fatias.slice(0, max - 1), { id: "outros", nome: "Outros", v: r2(soma(resto, (x) => x.v)), qtd: soma(resto, (x) => x.qtd) }];
}

export function comumFlex(db, inicio, fim) {
  const out = { comum: { valor: 0, qtd: 0 }, flex: { valor: 0, qtd: 0 } };
  for (const a of concluidosNoPeriodo(db, inicio, fim)) {
    const g = ehFlex(db, a) ? out.flex : out.comum;
    g.valor = r2(g.valor + valorAtendimento(db, a)); g.qtd++;
  }
  return out;
}

/* ---------- faturamento ---------- */
export function faturamentoMes(db, key) {
  return resumoPeriodo(db, ...limitesMes(key));
}

export function resumoPeriodo(db, inicio, fim) {
  const pac = db.pacotes.filter((p) => !p.cancelado && noPeriodo(p.dataCompra, inicio, fim));
  const ags = db.agendamentos.filter((a) => noPeriodo(a.data, inicio, fim));
  const feitos = ags.filter((a) => a.status === "concluido");
  const pacotes = soma(pac, (p) => p.valorPago);
  const servicos = soma(feitos.filter((a) => a.tipo === "avulso"), (a) => a.valor);
  const campanhas = soma(feitos.filter((a) => a.tipo === "campanha"), (a) => a.valor);
  const total = r2(pacotes + servicos + campanhas);
  const previsto = soma(ags.filter((a) => a.status === "agendado" && (a.tipo === "avulso" || a.tipo === "campanha")), (a) => a.valor);
  const atendimentos = feitos.filter((a) => TIPOS_ATENDIMENTO.includes(a.tipo)).length;
  const pagantes = feitos.filter((a) => a.tipo === "avulso" || a.tipo === "campanha");
  const faltas = ags.filter((a) => a.status === "faltou" && TIPOS_ATENDIMENTO.includes(a.tipo)).length;
  const porPagamento = {};
  [...PAGAMENTOS, "Não informado"].forEach((k) => { porPagamento[k] = 0; });
  pac.forEach((p) => { const k = p.pagamento || "Não informado"; porPagamento[k] = r2((porPagamento[k] || 0) + p.valorPago); });
  pagantes.forEach((a) => { const k = a.pagamento || "Não informado"; porPagamento[k] = r2((porPagamento[k] || 0) + a.valor); });
  return {
    pacotes: r2(pacotes), servicos: r2(servicos), campanhas: r2(campanhas), total, previsto: r2(previsto), atendimentos, faltas,
    ticket: pagantes.length ? (servicos + campanhas) / pagantes.length : 0, qtdPacotes: pac.length, porPagamento,
  };
}

export function recebidoNoDia(db, data) {
  const feitos = db.agendamentos.filter((a) => a.data === data && a.status === "concluido" && (a.tipo === "avulso" || a.tipo === "campanha"));
  const pac = db.pacotes.filter((p) => !p.cancelado && p.dataCompra === data);
  const porPagamento = {};
  feitos.forEach((a) => { const k = a.pagamento || "Não informado"; porPagamento[k] = r2((porPagamento[k] || 0) + a.valor); });
  pac.forEach((p) => { const k = p.pagamento || "Não informado"; porPagamento[k] = r2((porPagamento[k] || 0) + p.valorPago); });
  return { total: r2(soma(feitos, (a) => a.valor) + soma(pac, (p) => p.valorPago)), porPagamento };
}

// Atendimentos cujo horário já passou e que ainda estão como "agendado"
export function pendentes(db, agora = new Date()) {
  return db.agendamentos
    .filter((a) => a.status === "agendado" && TIPOS_ATENDIMENTO.includes(a.tipo) && momento(a.data, a.hora) < agora)
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
}

/* ---------- retorno de clientes ---------- */
export function perfilFrequencia(intervalo) {
  if (!intervalo) return "";
  if (intervalo <= 21) return "a cada ~15 dias";
  if (intervalo <= 42) return "mensal";
  return "eventual";
}

export function infoRetorno(db, cliente, hoje = hojeYmd()) {
  const meus = db.agendamentos.filter((a) => a.clienteId === cliente.id && TIPOS_ATENDIMENTO.includes(a.tipo));
  const datas = [...new Set(meus.filter((a) => a.status === "concluido").map((a) => a.data))].filter((d) => d <= hoje).sort();
  const futuro = meus.filter((a) => a.status === "agendado" && a.data >= hoje).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))[0] || null;
  const faltas = meus.filter((a) => a.status === "faltou").length;
  const ultima = datas[datas.length - 1] || null;
  const gaps = [];
  for (let i = 1; i < datas.length; i++) gaps.push(diffDias(datas[i], datas[i - 1]));
  // mediana dos últimos intervalos (ignora voltas em poucos dias, ex.: corte e depois barba)
  const recentes = gaps.filter((g) => g >= 4).slice(-5).sort((a, b) => a - b);
  const meio = Math.floor(recentes.length / 2);
  const mediana = recentes.length ? (recentes.length % 2 ? recentes[meio] : (recentes[meio - 1] + recentes[meio]) / 2) : null;
  const intervaloReal = mediana ? Math.max(7, Math.round(mediana)) : null;
  const intervalo = intervaloReal || Number(db.config.retornoPadrao) || 30;
  const semVisita = ultima ? diffDias(hoje, ultima) : null;
  const proxima = ultima ? ymd(addDays(parse(ultima), intervalo)) : null;
  const atraso = proxima ? diffDias(hoje, proxima) : null;
  const tolerancia = Number(db.config.toleranciaRetorno) || 5;
  let situacao = "Sem visitas";
  if (futuro) situacao = "Agendado";
  else if (ultima && atraso < tolerancia) situacao = "Em dia";
  else if (ultima && semVisita > Math.max(90, intervalo * 3)) situacao = "Sumido";
  else if (ultima) situacao = "Chamar";
  return { visitas: datas.length, ultima, intervalo, intervaloReal, perfil: perfilFrequencia(intervaloReal), semVisita, proxima, atraso, futuro, faltas, situacao };
}

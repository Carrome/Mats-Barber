/* =====================================================================
   Regras de negócio
   ===================================================================== */
import {
  addDays, brl, cap, ddmm, diffDias, fimMesYmd, fromMin, hojeYmd, inicioMes, momento, nomeMes, parse, r2, segundaDe, soma, toMin, ymd, PAGAMENTOS,
} from "./util.js";

export const TIPOS_ATENDIMENTO = ["avulso", "pacote", "campanha"];

export const servicoDe = (db, id) => db.servicos.find((s) => s.id === id);
export const clienteDe = (db, id) => db.clientes.find((c) => c.id === id);
export const campanhaDe = (db, id) => db.campanhas.find((c) => c.id === id);
export const pacoteDe = (db, id) => db.pacotes.find((p) => p.id === id);

/* ---------- planos e campanhas ---------- */
export const precoPlano = (db, p) =>
  r2((Number(p.qtd) || 0) * Math.max(0, (servicoDe(db, p.servicoId)?.preco || 0) - (Number(p.descontoPorUso) || 0)));

// "porServico": descontos[servicoId] é o R$ a menos daquele serviço; sem valor, preço cheio.
// Os outros modos valem igual para qualquer serviço.
export function precoCampanha(c, preco, servicoId) {
  if (!c) return r2(preco);
  if (c.descontoTipo === "porServico") return r2(Math.max(0, preco - (Number(c.descontos?.[servicoId]) || 0)));
  const v = Number(c.descontoValor) || 0;
  if (c.descontoTipo === "valor") return r2(Math.max(0, preco - v));
  if (c.descontoTipo === "preco") return r2(Math.max(0, Math.min(preco, v)));
  return r2(Math.max(0, preco * (1 - (Number(c.descontoPct) || 0) / 100)));
}

// A campanha dá desconto neste serviço?
export function campanhaCobre(c, servicoId) {
  if (!c) return false;
  if (c.descontoTipo === "porServico") return (Number(c.descontos?.[servicoId]) || 0) > 0;
  return c.tipo !== "servico" || !c.servicoIds?.length || c.servicoIds.includes(servicoId);
}

const reais = (v) => String(v).replace(".", ",");
export function rotuloDesconto(c, db) {
  if (!c) return "";
  if (c.descontoTipo === "porServico") {
    if (!db) return "desconto por serviço";
    return db.servicos.filter((s) => campanhaCobre(c, s.id)).map((s) => `${s.nome} −R$ ${reais(Number(c.descontos[s.id]))}`).join(", ") || "sem desconto";
  }
  const v = Number(c.descontoValor) || 0;
  if (c.descontoTipo === "valor") return `R$ ${reais(v)} off`;
  if (c.descontoTipo === "preco") return `por R$ ${reais(v)}`;
  return `${Number(c.descontoPct) || 0}% off`;
}

export const primeiroCoberto = (db, c) => db.servicos.find((s) => campanhaCobre(c, s.id))?.id;

// Oferta com um ou mais serviços: cada um com o seu desconto, e quem não tem desconto
// entra pelo preço cheio. O principal é o primeiro com desconto, na ordem da tabela;
// os demais vão como adicionais. Sem nenhum serviço com desconto, não há oferta.
export function montarOferta(db, c, ids) {
  const servs = db.servicos.filter((s) => ids.includes(s.id));
  const principal = servs.find((s) => campanhaCobre(c, s.id));
  if (!principal) return null;
  const preco = (s) => (campanhaCobre(c, s.id) ? precoCampanha(c, s.preco, s.id) : r2(s.preco));
  const adicionais = servs.filter((s) => s !== principal).map((s) => ({ servicoId: s.id, valor: preco(s) }));
  const valor = preco(principal);
  return { servicoId: principal.id, valor, adicionais, total: r2(valor + soma(adicionais, (x) => x.valor)), cheio: r2(soma(servs, (s) => s.preco)) };
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

// Pausa fixa de Ajustes que vale neste horário (as desligadas não contam)
export function pausaEm(cfg, data, hora) {
  const dia = parse(data).getDay();
  return (cfg.pausas || []).find((p) => p.ativa !== false && p.dias?.includes(dia) && p.de && p.ate && hora >= p.de && hora < p.ate) || null;
}

/* ---------- horários de um dia ----------
   Cada data pode ter a lista própria de horários e o almoço daquele dia
   (db.gradeDia["AAAA-MM-DD"]). Sem isso, vale a grade padrão de Ajustes. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function gradeDoDia(db, data) {
  const g = db.gradeDia?.[data];
  if (!Array.isArray(g?.horas)) return horariosDe(db.config);
  return [...new Set(g.horas.filter((h) => HORA.test(h)))].sort();
}

export function almocoDoDia(db, data) {
  const a = db.gradeDia?.[data]?.almoco;
  if (!a || !HORA.test(a.de || "") || !(Number(a.minutos) > 0)) return null;
  return { motivo: "Almoço", de: a.de, ate: fromMin(Math.min(toMin(a.de) + Number(a.minutos), 23 * 60 + 59)), doDia: true };
}

// O que bloqueia um horário: o almoço marcado no dia ou uma pausa fixa ligada
export function pausaDoDia(db, data, hora) {
  const al = almocoDoDia(db, data);
  if (al && hora >= al.de && hora < al.ate) return al;
  return pausaEm(db.config, data, hora);
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

// Horários exibidos num dia: grade do dia + agendamentos fora dela (encaixes ou
// grade antiga) + o início do almoço, para ele aparecer na agenda
export function horasDoDia(db, data, grade = gradeDoDia(db, data)) {
  const extra = db.agendamentos.filter((a) => a.data === data && !grade.includes(a.hora)).map((a) => a.hora);
  const al = almocoDoDia(db, data);
  return [...new Set([...grade, ...extra, ...(al ? [al.de] : [])])].sort();
}

export function vagasLivres(db, de, ate, agora = new Date()) {
  const ocupado = new Set(db.agendamentos.map((a) => `${a.data} ${a.hora}`));
  const out = [];
  for (let d = parse(de); ymd(d) <= ate; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!atendeNoDia(db, data) || diaFechado(db, data)) continue;
    for (const hora of gradeDoDia(db, data)) {
      if (momento(data, hora) <= agora) continue;
      if (pausaDoDia(db, data, hora)) continue;
      if (!ocupado.has(`${data} ${hora}`)) out.push({ data, hora });
    }
  }
  return out;
}

// Horários livres num dia para remarcar / encaixar
export function horasLivresNoDia(db, data, ignorarId, agora = new Date()) {
  const ocup = new Set(db.agendamentos.filter((a) => a.data === data && a.id !== ignorarId).map((a) => a.hora));
  return gradeDoDia(db, data).filter((h) => !ocup.has(h) && !pausaDoDia(db, data, h) && momento(data, h) > agora);
}

// Limites de um mês "AAAA-MM"
const limitesMes = (key) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1, 1); return [ymd(d), fimMesYmd(d)]; };

export function capacidadeMes(db, key) {
  return capacidadePeriodo(db, ...limitesMes(key));
}

export function capacidadePeriodo(db, inicio, fim) {
  let total = 0;
  for (let d = parse(inicio); ymd(d) <= fim; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!atendeNoDia(db, data) || diaFechado(db, data)) continue;
    total += gradeDoDia(db, data).filter((h) => !pausaDoDia(db, data, h)).length;
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

// Serviços adicionais feitos no mesmo horário. São sempre pagos na hora, mesmo
// quando o principal sai de um pacote ou de uma vaga Flex.
export const adicionaisDe = (a) => (Array.isArray(a.adicionais) ? a.adicionais : []);
export const valorAdicionais = (a) => r2(soma(adicionaisDe(a), (x) => Number(x.valor) || 0));
export const idsServicos = (a) => [a.servicoId, ...adicionaisDe(a).map((x) => x.servicoId)];
export const nomeServicos = (db, a) => idsServicos(a).map((id) => servicoDe(db, id)?.nome || "Serviço removido").join(" + ");
// preço de uma oferta com os seus adicionais, e quanto seria sem desconto nenhum
export const totalOferta = (a) => r2((Number(a.valor) || 0) + valorAdicionais(a));
export const cheioDe = (db, a) => r2(soma(idsServicos(a), (id) => servicoDe(db, id)?.preco || 0));

const pagaPrincipal = (a) => a.tipo === "avulso" || a.tipo === "campanha";
const pagoNaHora = (a) => r2((pagaPrincipal(a) ? Number(a.valor) || 0 : 0) + valorAdicionais(a));
const pagaNaHora = (a) => pagaPrincipal(a) || (TIPOS_ATENDIMENTO.includes(a.tipo) && valorAdicionais(a) > 0);

const concluidosNoPeriodo = (db, inicio, fim) =>
  db.agendamentos.filter((a) => a.status === "concluido" && TIPOS_ATENDIMENTO.includes(a.tipo) && noPeriodo(a.data, inicio, fim));

export function vendasPorServico(db, inicio, fim) {
  const grupos = new Map();
  const somar = (servicoId, valor) => {
    const g = grupos.get(servicoId) || { id: servicoId, nome: servicoDe(db, servicoId)?.nome || "Serviço removido", valor: 0, qtd: 0 };
    g.valor = r2(g.valor + valor); g.qtd++;
    grupos.set(servicoId, g);
  };
  for (const a of concluidosNoPeriodo(db, inicio, fim)) {
    somar(a.servicoId, valorAtendimento(db, a));
    for (const x of adicionaisDe(a)) somar(x.servicoId, Number(x.valor) || 0);
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
    g.valor = r2(g.valor + valorAtendimento(db, a) + valorAdicionais(a)); g.qtd++;
  }
  return out;
}

/* ---------- pagamento dividido ---------- */
export const DIVIDIDO = "Dividido";

// Quanto entrou em cada forma. No dividido só a parte em dinheiro é guardada e o
// Pix é o resto: assim a soma continua fechando se o total mudar depois.
export function partesPagamento(pagamento, emDinheiro, total) {
  const t = r2(Number(total) || 0);
  if (pagamento !== DIVIDIDO) return { [pagamento || "Não informado"]: t };
  const d = r2(Math.min(t, Math.max(0, Number(emDinheiro) || 0)));
  return { Dinheiro: d, Pix: r2(t - d) };
}

export function rotuloPagamento(pagamento, emDinheiro, total) {
  if (pagamento !== DIVIDIDO) return pagamento || "";
  const p = partesPagamento(pagamento, emDinheiro, total);
  return `Dinheiro ${brl(p.Dinheiro)} + Pix ${brl(p.Pix)}`;
}

const somarPartes = (acc, partes) => { for (const [k, v] of Object.entries(partes)) acc[k] = r2((acc[k] || 0) + v); };

/* ---------- faturamento ---------- */
export function faturamentoMes(db, key) {
  return resumoPeriodo(db, ...limitesMes(key));
}

export function resumoPeriodo(db, inicio, fim) {
  const pac = db.pacotes.filter((p) => !p.cancelado && noPeriodo(p.dataCompra, inicio, fim));
  const ags = db.agendamentos.filter((a) => noPeriodo(a.data, inicio, fim));
  const feitos = ags.filter((a) => a.status === "concluido");
  const pacotes = soma(pac, (p) => p.valorPago);
  const atendidos = feitos.filter((a) => TIPOS_ATENDIMENTO.includes(a.tipo));
  // adicionais entram como serviço, qualquer que seja o tipo do principal
  const servicos = soma(feitos.filter((a) => a.tipo === "avulso"), (a) => a.valor) + soma(atendidos, valorAdicionais);
  const campanhas = soma(feitos.filter((a) => a.tipo === "campanha"), (a) => a.valor);
  const total = r2(pacotes + servicos + campanhas);
  const marcados = ags.filter((a) => a.status === "agendado" && TIPOS_ATENDIMENTO.includes(a.tipo));
  const previsto = soma(marcados.filter(pagaPrincipal), (a) => a.valor) + soma(marcados, valorAdicionais);
  const atendimentos = atendidos.length;
  const pagantes = feitos.filter(pagaNaHora);
  const faltas = ags.filter((a) => a.status === "faltou" && TIPOS_ATENDIMENTO.includes(a.tipo)).length;
  const porPagamento = {};
  [...PAGAMENTOS, "Não informado"].forEach((k) => { porPagamento[k] = 0; });
  pac.forEach((p) => somarPartes(porPagamento, partesPagamento(p.pagamento, p.emDinheiro, p.valorPago)));
  pagantes.forEach((a) => somarPartes(porPagamento, partesPagamento(a.pagamento, a.emDinheiro, pagoNaHora(a))));
  return {
    pacotes: r2(pacotes), servicos: r2(servicos), campanhas: r2(campanhas), total, previsto: r2(previsto), atendimentos, faltas,
    ticket: pagantes.length ? (servicos + campanhas) / pagantes.length : 0, qtdPacotes: pac.length, porPagamento,
  };
}

export function recebidoNoDia(db, data) {
  const feitos = db.agendamentos.filter((a) => a.data === data && a.status === "concluido" && pagaNaHora(a));
  const pac = db.pacotes.filter((p) => !p.cancelado && p.dataCompra === data);
  const porPagamento = {};
  feitos.forEach((a) => somarPartes(porPagamento, partesPagamento(a.pagamento, a.emDinheiro, pagoNaHora(a))));
  pac.forEach((p) => somarPartes(porPagamento, partesPagamento(p.pagamento, p.emDinheiro, p.valorPago)));
  return { total: r2(soma(feitos, pagoNaHora) + soma(pac, (p) => p.valorPago)), porPagamento };
}

/* ---------- meta ---------- */
const diaDeAtendimento = (db, data) => atendeNoDia(db, data) && !diaFechado(db, data);

// Meta de um período: a meta mensal dividida igualmente pelos dias de atendimento de cada mês
// (dia sem atendimento ou fechado não tem meta; semana que vira o mês usa a meta diária de cada mês)
export function metaPeriodo(db, inicio, fim) {
  const meta = Number(db.config.meta) || 0;
  if (!meta) return 0;
  const diasNoMes = new Map();
  let total = 0;
  for (let d = parse(inicio); ymd(d) <= fim; d = addDays(d, 1)) {
    const data = ymd(d);
    if (!diaDeAtendimento(db, data)) continue;
    const mes = data.slice(0, 7);
    if (!diasNoMes.has(mes)) {
      let n = 0;
      for (let x = inicioMes(d); x.getMonth() === d.getMonth(); x = addDays(x, 1)) if (diaDeAtendimento(db, ymd(x))) n++;
      diasNoMes.set(mes, n);
    }
    total += meta / diasNoMes.get(mes);
  }
  return r2(total);
}

/* ---------- avisos da tela de ajustes (viram um número no ícone de ajustes) ---------- */
export function avisosAjustes(db, hoje = hojeYmd()) {
  const avisos = [];
  if (!db.demo && db.clientes.length >= 3) {
    // data do backup no horário local (à noite, em UTC, já seria o dia seguinte)
    const quando = db.config.ultimoBackup ? new Date(db.config.ultimoBackup) : null;
    const dias = quando && !Number.isNaN(quando.getTime()) ? diffDias(hoje, ymd(quando)) : null;
    if (dias === null || dias >= 7) {
      avisos.push({ id: "backup", texto: dias === null ? "Você ainda não fez nenhum backup." : `Último backup há ${dias} dias.` });
    }
  }
  return avisos;
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

/* =====================================================================
   Clientes: cadastro, retorno (quem chamar), aniversários e indicações
   ===================================================================== */
import React, { useMemo, useState } from "react";
import { Cake, ChevronRight, Gift, MessageCircle, Package, Pencil, Phone, Search, Ticket, Trash2, UserPlus } from "lucide-react";
import {
  aniversarioValido, brl, dataLonga, ddmm, ddmmaa, diasAteAniversario, formatarTel, hojeYmd, iniciais, mascaraDDMM,
  primeiroNome, soma, uid, whats, plural,
} from "../util.js";
import { clienteDe, infoPacote, infoRetorno, servicoDe, TOM_STATUS, TIPOS_ATENDIMENTO } from "../regras.js";
import { BarraSaldo, buscaCliente, Campo, clienteParecido, ClientePicker, Sheet, Tag } from "../componentes.jsx";

export const msgRetorno = (db, c, r) =>
  `Olá, ${primeiroNome(c.nome)}! Tudo certo? Já faz ${r.semVisita} dias do seu último corte aqui na ${db.config.nome}. Bora dar aquele trato no visual? Me fala o melhor dia que eu separo um horário pra você.`;
export const msgAniversario = (db, c) =>
  `Feliz aniversário, ${primeiroNome(c.nome)}! 🎉 A ${db.config.nome} deseja um ótimo dia. Passa aqui pra ficar na régua pra comemorar!`;

const TOM_RETORNO = { "Chamar": "alerta", "Sumido": "erro", "Em dia": "ok", "Agendado": "azul", "Sem visitas": "neutro" };

export function Clientes({ db, update, notify, abrir }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [ordem, setOrdem] = useState("nome");
  const [editar, setEditar] = useState(null);
  const hoje = hojeYmd();

  const dados = useMemo(() => db.clientes.map((c) => {
    const r = infoRetorno(db, c, hoje);
    const pacs = db.pacotes.filter((p) => p.clienteId === c.id).map((p) => infoPacote(db, p, hoje)).filter((i) => i.status === "Ativo" || i.status === "Vence em breve");
    const aniv = diasAteAniversario(c.aniversario, hoje);
    return { c, r, saldo: pacs.reduce((t, i) => t + i.saldo, 0), temPacote: pacs.length > 0, aniv };
  }), [db, hoje]);

  const mesAtual = hoje.slice(5, 7);
  const filtros = {
    "Todos": () => true,
    "Chamar": (x) => x.r.situacao === "Chamar",
    "Sumidos": (x) => x.r.situacao === "Sumido",
    "Com pacote": (x) => x.temPacote,
    "Aniversário no mês": (x) => aniversarioValido(x.c.aniversario) && x.c.aniversario.slice(3) === mesAtual,
  };
  const lista = dados
    .filter(filtros[filtro])
    .filter((x) => buscaCliente(x.c, q))
    .sort((a, b) => {
      if (ordem === "ultimo") return (b.r.ultima || "").localeCompare(a.r.ultima || "");
      if (ordem === "atraso") return (b.r.atraso ?? -999) - (a.r.atraso ?? -999);
      if (filtro === "Aniversário no mês") return (a.aniv ?? 999) - (b.aniv ?? 999);
      return a.c.nome.localeCompare(b.c.nome, "pt-BR");
    });

  return (
    <div className="mf-wrap mf-stack" style={{ gap: 14 }}>
      <div className="mf-head">
        <div><h1>Clientes</h1><p className="sub">{plural(db.clientes.length, "cadastrado", "cadastrados")}</p></div>
        <button className="mf-btn" onClick={() => setEditar({})}><UserPlus size={17} />Novo cliente</button>
      </div>
      <div style={{ position: "relative" }}>
        <Search size={17} style={{ position: "absolute", left: 13, top: 14, color: "var(--cinza)" }} />
        <input className="mf-input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mf-chips">
        {Object.keys(filtros).map((f) => (
          <button key={f} className={"mf-chip" + (filtro === f ? " on" : "")} onClick={() => { setFiltro(f); if (f === "Chamar" || f === "Sumidos") setOrdem("atraso"); else if (ordem === "atraso") setOrdem("nome"); }}>
            {f} ({dados.filter(filtros[f]).length})
          </button>
        ))}
      </div>
      {(filtro === "Chamar" || filtro === "Sumidos") && (
        <p className="sub">Clientes que já passaram do tempo normal de voltar e não têm horário marcado. O tempo é calculado pela frequência de cada um (ou {db.config.retornoPadrao} dias para quem veio só uma vez).</p>
      )}
      <div className="mf-row mf-between">
        <small>{plural(lista.length, "cliente", "clientes")}</small>
        <label className="mf-row" style={{ fontSize: 13 }}>Ordenar
          <select className="mf-input" style={{ width: "auto", padding: "4px 8px", fontSize: 14 }} value={ordem} onChange={(e) => setOrdem(e.target.value)}>
            <option value="nome">Nome</option>
            <option value="ultimo">Último corte</option>
            <option value="atraso">Mais atrasados</option>
          </select>
        </label>
      </div>
      <section className="mf-panel" style={{ padding: "4px 14px" }}>
        {lista.length === 0 ? (
          <div className="mf-empty"><h3>{db.clientes.length ? "Ninguém por aqui" : "Cadastre o primeiro cliente"}</h3><p>{db.clientes.length ? "Tente outro filtro ou busca." : "Clientes também podem ser cadastrados na hora de agendar."}</p></div>
        ) : (
          <div className="mf-list">
            {lista.map(({ c, r, saldo, temPacote, aniv }) => {
              const chamar = r.situacao === "Chamar" || r.situacao === "Sumido";
              return (
                <div key={c.id} className="mf-item" style={{ cursor: "default" }}>
                  <button className="mf-row mf-grow" style={{ background: "none", border: 0, padding: 0, textAlign: "left", minWidth: 0 }} onClick={() => abrir.cliente(c.id)}>
                    <div className="mf-avatar">{iniciais(c.nome)}</div>
                    <div className="mf-grow">
                      <b className="mf-ellip" style={{ display: "block" }}>{c.nome}</b>
                      <small className="mf-ellip" style={{ display: "block" }}>
                        {r.ultima ? `último corte ${ddmm(r.ultima)}` : c.telefone || "Sem visitas"}
                        {r.perfil ? ` · ${r.perfil}` : ""}
                        {r.futuro ? ` · marcado ${ddmm(r.futuro.data)}` : ""}
                      </small>
                      <div className="mf-row mf-wrapr" style={{ gap: 4, marginTop: 3 }}>
                        {chamar && <Tag tom={TOM_RETORNO[r.situacao]}>{r.situacao === "Sumido" ? `sumido há ${r.semVisita}d` : `atrasado ${r.atraso}d`}</Tag>}
                        {temPacote && <Tag tom="azul"><Package size={12} />{saldo} no pacote</Tag>}
                        {aniv !== null && aniv <= 7 && <Tag tom="alerta"><Cake size={12} />{aniv === 0 ? "aniversário hoje" : `aniversário em ${aniv}d`}</Tag>}
                      </div>
                    </div>
                  </button>
                  {chamar && c.telefone
                    ? <a className="mf-btn sm alt" href={whats(c.telefone, msgRetorno(db, c, r), db.config.ddd)} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.nome} no WhatsApp`}><MessageCircle size={14} />Chamar</a>
                    : <ChevronRight size={18} color="#6B6B6B" />}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {editar && <ClienteForm db={db} update={update} notify={notify} cliente={editar} onClose={() => setEditar(null)} onAbrir={abrir.cliente} />}
    </div>
  );
}

export function ClienteForm({ db, update, notify, cliente, onClose, onAbrir }) {
  const [nome, setNome] = useState(cliente.nome || "");
  const [tel, setTel] = useState(cliente.telefone || "");
  const [obs, setObs] = useState(cliente.obs || "");
  const [aniv, setAniv] = useState(cliente.aniversario || "");
  const [indicadoPor, setIndicadoPor] = useState(cliente.indicadoPor || null);
  const parecido = clienteParecido(db, nome, tel, cliente.id);
  const anivOk = !aniv || aniversarioValido(aniv);
  const salvarC = () => {
    const dados = { nome: nome.trim(), telefone: formatarTel(tel), obs, aniversario: aniv, indicadoPor: indicadoPor || "" };
    update((d) => {
      const existente = cliente.id && d.clientes.find((c) => c.id === cliente.id);
      if (existente) Object.assign(existente, dados);
      else d.clientes.push({ id: uid(), ...dados, criadoEm: hojeYmd() });
      return d;
    });
    notify(cliente.id ? "Cliente atualizado" : "Cliente cadastrado");
    onClose();
  };
  return (
    <Sheet titulo={cliente.id ? "Editar cliente" : "Novo cliente"} onClose={onClose}>
      <div className="mf-stack">
        <Campo label="Nome"><input className="mf-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus={!cliente.id} /></Campo>
        <div className="mf-g-2-fixo">
          <Campo label="WhatsApp"><input className="mf-input" inputMode="tel" placeholder="(22) 99999-9999" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => setTel(formatarTel(tel))} /></Campo>
          <Campo label="Aniversário"><input className="mf-input" inputMode="numeric" placeholder="dd/mm" value={aniv} onChange={(e) => setAniv(mascaraDDMM(e.target.value))} /></Campo>
        </div>
        {!anivOk && <small style={{ color: "var(--poste-tx)" }}>Aniversário inválido. Use dia/mês, ex.: 07/03.</small>}
        {parecido && (
          <div className="mf-dupe">
            <span className="mf-grow">Parece que já existe: <b>{parecido.nome}</b> {parecido.telefone && `(${parecido.telefone})`}</span>
            {onAbrir && <button type="button" className="mf-btn sm alt" onClick={() => { onClose(); onAbrir(parecido.id); }}>Abrir ficha</button>}
          </div>
        )}
        <Campo label="Indicado por" dica="Quem indicou este cliente (para o plano Amigo para Amigo).">
          <ClientePicker db={db} update={update} valor={indicadoPor} onChange={setIndicadoPor} permitirNovo={false} ignorarId={cliente.id} placeholder="Buscar quem indicou (opcional)" />
        </Campo>
        <Campo label="Observações"><textarea className="mf-input" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Estilo de corte, máquina, preferências…" /></Campo>
        <button className="mf-btn full" disabled={!nome.trim() || !anivOk} onClick={salvarC}>{cliente.id ? "Salvar cliente" : "Cadastrar cliente"}</button>
      </div>
    </Sheet>
  );
}

export function ClienteDetalhe({ db, update, notify, ask, cliente, abrir, onClose }) {
  const [editar, setEditar] = useState(false);
  const [todos, setTodos] = useState(false);
  const cfg = db.config;
  const pacs = db.pacotes.filter((p) => p.clienteId === cliente.id).map((p) => ({ p, i: infoPacote(db, p) }));
  const ags = db.agendamentos.filter((a) => a.clienteId === cliente.id && TIPOS_ATENDIMENTO.includes(a.tipo)).sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  const gasto = soma(ags.filter((a) => a.status === "concluido"), (a) => a.valor) + soma(pacs.filter((x) => !x.p.cancelado), (x) => x.p.valorPago);
  const r = infoRetorno(db, cliente);
  const quemIndicou = cliente.indicadoPor && clienteDe(db, cliente.indicadoPor);
  const indicados = db.clientes.filter((c) => c.indicadoPor === cliente.id);
  const aniv = diasAteAniversario(cliente.aniversario);
  const chamar = r.situacao === "Chamar" || r.situacao === "Sumido";

  const excluir = () => {
    if (pacs.length || ags.length) { notify("Cliente com histórico não pode ser excluído"); return; }
    ask(`Excluir ${cliente.nome}?`, () => {
      update((d) => {
        d.clientes = d.clientes.filter((c) => c.id !== cliente.id).map((c) => (c.indicadoPor === cliente.id ? { ...c, indicadoPor: "" } : c));
        return d;
      }, true);
      notify("Cliente excluído", true);
      onClose();
    });
  };

  if (editar) return <ClienteForm db={db} update={update} notify={notify} cliente={cliente} onClose={() => setEditar(false)} />;

  return (
    <Sheet titulo={cliente.nome} sub={cliente.telefone || "Sem telefone"} onClose={onClose}>
      <div className="mf-stack">
        <div className="mf-row mf-wrapr">
          <button className="mf-btn latao sm" onClick={() => { onClose(); abrir.venda(cliente.id); }}><Ticket size={15} />Vender plano</button>
          {cliente.telefone && <a className="mf-btn sm alt" href={whats(cliente.telefone, `Olá, ${primeiroNome(cliente.nome)}!`, cfg.ddd)} target="_blank" rel="noreferrer"><Phone size={15} />WhatsApp</a>}
          <button className="mf-btn sm alt" onClick={() => setEditar(true)}><Pencil size={15} />Editar</button>
        </div>
        {cliente.obs && <p className="mf-msg">{cliente.obs}</p>}

        <div className="mf-panel mf-ledger">
          <div><span>Retorno</span><Tag tom={TOM_RETORNO[r.situacao]}>{r.situacao}</Tag></div>
          {r.ultima && <div><span>Último atendimento</span><span>{ddmmaa(r.ultima)} ({r.semVisita} dias)</span></div>}
          {r.perfil && <div><span>Frequência</span><span>{r.perfil} (~{r.intervaloReal} dias)</span></div>}
          {r.futuro ? <div><span>Próximo horário</span><span>{dataLonga(r.futuro.data)} às {r.futuro.hora}</span></div>
            : r.proxima && <div><span>Deveria voltar em</span><span>{ddmmaa(r.proxima)}</span></div>}
          <div><span>Total gasto</span><b>{brl(gasto)}</b></div>
          <div><span>Atendimentos concluídos</span><b>{r.visitas}</b></div>
          <div><span>Faltas</span><b style={{ color: r.faltas >= 2 ? "#C8372D" : undefined }}>{r.faltas}</b></div>
          {cliente.aniversario && <div><span>Aniversário</span><span>{cliente.aniversario}{aniv !== null && aniv <= 30 ? ` (${aniv === 0 ? "hoje!" : `em ${aniv} dias`})` : ""}</span></div>}
          {quemIndicou && <div><span>Indicado por</span><button className="mf-link" onClick={() => abrir.cliente(quemIndicou.id)}>{quemIndicou.nome}</button></div>}
          {indicados.length > 0 && <div><span>Indicou</span><span style={{ textAlign: "right" }}>{indicados.map((c) => c.nome).join(", ")}</span></div>}
        </div>

        {(chamar || (aniv !== null && aniv <= 7)) && cliente.telefone && (
          <div className="mf-row mf-wrapr">
            {chamar && <a className="mf-btn sm" href={whats(cliente.telefone, msgRetorno(db, cliente, r), cfg.ddd)} target="_blank" rel="noreferrer"><MessageCircle size={14} />Chamar de volta</a>}
            {aniv !== null && aniv <= 7 && <a className="mf-btn sm latao" href={whats(cliente.telefone, msgAniversario(db, cliente), cfg.ddd)} target="_blank" rel="noreferrer"><Gift size={14} />Mandar parabéns</a>}
          </div>
        )}

        <h3>Pacotes</h3>
        {pacs.length === 0 ? <small>Nenhum pacote comprado.</small> : pacs.map(({ p, i }) => (
          <button key={p.id} className="mf-panel" style={{ padding: 12, textAlign: "left" }} onClick={() => abrir.pacote(p.id)}>
            <div className="mf-row mf-between"><span><span className="mf-code">{p.codigo}</span> {p.planoNome}</span><Tag tom={TOM_STATUS[i.status]}>{i.status}</Tag></div>
            <BarraSaldo qtd={p.qtd} usados={i.usados} reservados={i.reservados} />
            <small>{i.usados} usado(s), {i.reservados} marcado(s), {i.saldo} disponível(is). Vence em {ddmmaa(i.vence)}.</small>
          </button>
        ))}
        <h3>Histórico</h3>
        {ags.length === 0 ? <small>Nenhum atendimento.</small> : (
          <div className="mf-list mf-panel" style={{ padding: "0 12px" }}>
            {(todos ? ags : ags.slice(0, 10)).map((a) => (
              <button key={a.id} className="mf-item" onClick={() => abrir.horario(a.data, a.hora)}>
                <div className="mf-grow"><b>{ddmmaa(a.data)} às {a.hora}</b><br /><small>{servicoDe(db, a.servicoId)?.nome}, {a.tipo === "pacote" ? "pacote" : a.tipo === "campanha" ? "campanha" : "preço normal"}{a.tipo !== "pacote" ? ` · ${brl(a.valor)}` : ""}</small></div>
                <Tag tom={a.status === "concluido" ? "ok" : a.status === "faltou" ? "erro" : "neutro"}>{a.status === "concluido" ? "Concluído" : a.status === "faltou" ? "Faltou" : "Agendado"}</Tag>
              </button>
            ))}
          </div>
        )}
        {ags.length > 10 && <button className="mf-link" onClick={() => setTodos(!todos)}>{todos ? "Mostrar menos" : `Ver todos os ${ags.length}`}</button>}
        <button className="mf-link perigo" onClick={excluir}><Trash2 size={14} style={{ verticalAlign: -2 }} /> Excluir cliente</button>
      </div>
    </Sheet>
  );
}

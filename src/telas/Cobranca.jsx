/* =====================================================================
   Pagar depois: lembrete de cobrança e cobrança pelo WhatsApp.
   O aviso só aparece com o app aberto (decisão do dono do projeto).
   ===================================================================== */
import React, { useState } from "react";
import { BellRing, Check, Clock, MessageCircle, Wallet } from "lucide-react";
import { addDays, brl, ddmm, hojeYmd, parse, r2, soma, whats, ymd } from "../util.js";
import { A_RECEBER, aReceber, clienteDe, cobrancasVencidas, lembreteRapido, msgCobranca, nomeServicos, valorACobrar } from "../regras.js";
import { Campo, FormaPagamento, Sheet } from "../componentes.jsx";

// "hoje às 20:00", "amanhã às 09:00" ou "30/09 às 18:30"
export function quandoLembrar(l, hoje = hojeYmd()) {
  if (!l) return "sem lembrete";
  const amanha = ymd(addDays(parse(hoje), 1));
  const dia = l.data === hoje ? "hoje" : l.data === amanha ? "amanhã" : ddmm(l.data);
  return `${dia} às ${l.hora}`;
}

const gravar = (update, id, patch) => update((d) => {
  const x = d.agendamentos.find((a) => a.id === id);
  if (x) Object.assign(x, patch);
  return d;
});

// Abre o WhatsApp do cliente com a mensagem de cobrança. Sem telefone, só avisa
// (curto na lista e na faixa, para não espremer o nome).
function BotaoCobrar({ db, a, rotulo, onCobrar, className = "mf-btn sm", curto }) {
  const c = clienteDe(db, a.clienteId);
  if (!c?.telefone) return <small className="mf-muted" style={curto ? { whiteSpace: "nowrap" } : undefined}>{curto ? "Sem WhatsApp" : "Cadastre o WhatsApp do cliente para cobrar por lá."}</small>;
  return (
    <a className={className} href={whats(c.telefone, msgCobranca(db, a), db.config.ddd)} target="_blank" rel="noreferrer" onClick={onCobrar}>
      <MessageCircle size={14} />{rotulo}
    </a>
  );
}

/* ---------- janela "Cobrar depois": escolhe quando lembrar ---------- */
export function CobrarDepoisSheet({ db, update, notify, ag, onClose }) {
  const c = clienteDe(db, ag.clienteId);
  const agora = new Date();
  const atalhos = [["1h", "Daqui a 1 hora"], ...(agora.getHours() < 19 ? [["noite", "Hoje às 20:00"]] : []), ["amanha", "Amanhã às 9:00"], ["escolher", "Escolher dia e hora"]];
  const [qual, setQual] = useState(ag.lembrete ? "escolher" : "amanha");
  const [data, setData] = useState(ag.lembrete?.data || lembreteRapido("amanha", agora).data);
  const [hora, setHora] = useState(ag.lembrete?.hora || "09:00");
  const lembrete = qual === "escolher" ? { data, hora } : lembreteRapido(qual, agora);
  const ok = !!(lembrete.data && lembrete.hora);
  // cobrar agora também deixa a receber: se o Pix não vier, o lembrete ainda avisa
  const salvar = (cobrouAgora) => {
    gravar(update, ag.id, { pagamento: A_RECEBER, emDinheiro: 0, lembrete, cobradoEm: cobrouAgora ? new Date().toISOString() : null });
    notify(`Lembrete de cobrança: ${quandoLembrar(lembrete)}`);
    onClose();
  };
  return (
    <Sheet titulo="Cobrar depois" sub={`${c?.nome || "Cliente"} · ${brl(valorACobrar(ag))}`} onClose={onClose}>
      <div className="mf-stack">
        <p className="sub">{nomeServicos(db, ag)} · atendimento de {ddmm(ag.data)}</p>
        <Campo label="Quando lembrar?">
          <div className="mf-chips quebra">
            {atalhos.map(([v, rotulo]) => (
              <button key={v} type="button" className={"mf-chip" + (qual === v ? " on" : "")} aria-pressed={qual === v} onClick={() => setQual(v)}>{rotulo}</button>
            ))}
          </div>
        </Campo>
        {qual === "escolher" && (
          <div className="mf-g-2-fixo">
            <Campo label="Dia"><input className="mf-input" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
            <Campo label="Hora"><input className="mf-input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
          </div>
        )}
        <small className="mf-muted"><Clock size={14} style={{ verticalAlign: -2 }} /> O aviso aparece no app {quandoLembrar(lembrete)}, com o botão de cobrar no WhatsApp.</small>
        <div className="mf-msg">{msgCobranca(db, ag)}</div>
        <BotaoCobrar db={db} a={ag} rotulo="Cobrar agora no WhatsApp" className="mf-btn alt full" onCobrar={() => salvar(true)} />
        <button className="mf-btn full" disabled={!ok} onClick={() => salvar(false)}><BellRing size={16} />Salvar lembrete</button>
      </div>
    </Sheet>
  );
}

/* ---------- recebi: escolhe a forma e fecha a cobrança ---------- */
export function RecebiSheet({ db, update, notify, ag, onClose }) {
  const c = clienteDe(db, ag.clienteId);
  const valor = valorACobrar(ag);
  const [pag, setPag] = useState({ pagamento: db.config.pagamentoPadrao || "Pix", emDinheiro: 0 });
  const confirmar = () => {
    gravar(update, ag.id, { pagamento: pag.pagamento, emDinheiro: pag.emDinheiro || 0, pagoEm: hojeYmd(), lembrete: null });
    notify(`Pagamento de ${c?.nome || "cliente"} recebido`);
    onClose();
  };
  return (
    <Sheet titulo="Recebi o pagamento" sub={`${c?.nome || "Cliente"} · ${brl(valor)}`} onClose={onClose}>
      <div className="mf-stack">
        <Campo label="Como pagou">
          <FormaPagamento pagamento={pag.pagamento} emDinheiro={pag.emDinheiro} total={valor} onChange={(p) => setPag((x) => ({ ...x, ...p }))} />
        </Campo>
        <button className="mf-btn full" onClick={confirmar}><Check size={16} />Confirmar recebimento</button>
      </div>
    </Sheet>
  );
}

/* ---------- lista no Painel ---------- */
export function ListaAReceber({ db, update, notify, agora = new Date() }) {
  const [editar, setEditar] = useState(null);
  const [receber, setReceber] = useState(null);
  const lista = aReceber(db);
  const vencidas = new Set(cobrancasVencidas(db, agora).map((a) => a.id));
  if (!lista.length) return null;
  return (
    <section className="mf-panel mf-stack" style={{ gap: 4 }} aria-label="A receber">
      <div className="mf-row mf-between">
        <h3><Wallet size={17} style={{ verticalAlign: -2 }} /> A receber ({lista.length})</h3>
        <b>{brl(r2(soma(lista, valorACobrar)))}</b>
      </div>
      {lista.map((a) => {
        const c = clienteDe(db, a.clienteId);
        return (
          <div key={a.id} className="mf-item" style={{ padding: "10px 0" }}>
            <button type="button" className="mf-grow" style={{ background: "none", border: 0, padding: 0, textAlign: "left", color: "inherit", minWidth: 0 }} onClick={() => setEditar(a)} aria-label={`Mudar o lembrete de ${c?.nome || "cliente"}`}>
              <b>{c?.nome || "Cliente"}</b> · {brl(valorACobrar(a))}<br />
              <small>{nomeServicos(db, a)} · {ddmm(a.data)} · </small>
              <small style={vencidas.has(a.id) ? { color: "var(--poste-tx)", fontWeight: 700 } : undefined}><Clock size={12} style={{ verticalAlign: -1 }} /> {quandoLembrar(a.lembrete)}</small>
            </button>
            <BotaoCobrar db={db} a={a} rotulo="Cobrar" curto onCobrar={() => gravar(update, a.id, { cobradoEm: new Date().toISOString() })} />
            <button type="button" className="mf-btn sm alt" onClick={() => setReceber(a)}>Recebi</button>
          </div>
        );
      })}
      {editar && <CobrarDepoisSheet db={db} update={update} notify={notify} ag={editar} onClose={() => setEditar(null)} />}
      {receber && <RecebiSheet db={db} update={update} notify={notify} ag={receber} onClose={() => setReceber(null)} />}
    </section>
  );
}

/* ---------- faixa no topo quando chega a hora ---------- */
export function AvisoCobranca({ db, update, notify, agora = new Date(), onVerLista }) {
  const [receber, setReceber] = useState(null);
  const vencidas = cobrancasVencidas(db, agora);
  const janela = receber && <RecebiSheet db={db} update={update} notify={notify} ag={receber} onClose={() => setReceber(null)} />;
  if (!vencidas.length) return janela || null;
  if (vencidas.length > 1) {
    return (
      <div className="mf-banner" role="status" style={{ marginBottom: 0 }}>
        <BellRing size={18} />
        <span className="mf-grow"><b>Hora de cobrar {vencidas.length} clientes</b> ({brl(r2(soma(vencidas, valorACobrar)))})</span>
        <button type="button" className="mf-btn sm" onClick={onVerLista}>Ver lista</button>
        {janela}
      </div>
    );
  }
  const a = vencidas[0];
  const c = clienteDe(db, a.clienteId);
  // a mesma hora que decidiu o aviso (ou o relógio, se estiver à frente): assim "cobrei" e
  // "adiar" nunca ficam antes do lembrete que acabou de vencer
  const ja = () => new Date(Math.max(Date.now(), agora.getTime()));
  const adiar = (qual) => {
    const lembrete = lembreteRapido(qual, ja());
    gravar(update, a.id, { lembrete, cobradoEm: null });
    notify(`Lembro de novo ${quandoLembrar(lembrete)}`);
  };
  return (
    <div className="mf-banner" role="status" style={{ marginBottom: 0 }}>
      <BellRing size={18} />
      <span className="mf-grow"><b>Hora de cobrar {c?.nome || "cliente"}</b>: {brl(valorACobrar(a))}</span>
      <div className="mf-row mf-wrapr" style={{ gap: 6 }}>
        <BotaoCobrar db={db} a={a} rotulo="WhatsApp" curto onCobrar={() => gravar(update, a.id, { cobradoEm: ja().toISOString() })} />
        <button type="button" className="mf-btn sm alt" onClick={() => setReceber(a)}>Recebi</button>
        <button type="button" className="mf-btn sm alt" onClick={() => adiar("1h")}>+1 hora</button>
        <button type="button" className="mf-btn sm alt" onClick={() => adiar("amanha")}>Amanhã</button>
      </div>
      {janela}
    </div>
  );
}

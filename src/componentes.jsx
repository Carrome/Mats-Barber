/* =====================================================================
   Componentes base reutilizados pelas telas
   ===================================================================== */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import { digitos, formatarTel, hojeYmd, norm, uid } from "./util.js";
import { clienteDe } from "./regras.js";

export function useLargo() {
  const q = "(min-width: 900px)";
  const [w, setW] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setW(m.matches);
    if (m.addEventListener) m.addEventListener("change", h); else m.addListener(h);
    return () => { if (m.removeEventListener) m.removeEventListener("change", h); else m.removeListener(h); };
  }, []);
  return w;
}

// Relógio que atualiza a cada minuto (horários "passados" mudam sozinhos)
export function useAgora(ms = 60000) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    const vis = () => document.visibilityState === "visible" && setAgora(new Date());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [ms]);
  return agora;
}

// Pilha de janelas abertas: Esc fecha só a de cima e a página de fundo não rola
const pilha = [];
export function Sheet({ titulo, sub, onClose, children }) {
  const fechar = useRef(onClose);
  fechar.current = onClose;
  const apertouFora = useRef(false);
  useEffect(() => {
    const eu = {};
    pilha.push(eu);
    document.body.classList.add("mf-travado");
    const h = (e) => {
      if (e.key === "Escape" && pilha[pilha.length - 1] === eu) fechar.current();
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      const i = pilha.indexOf(eu);
      if (i >= 0) pilha.splice(i, 1);
      if (!pilha.length) document.body.classList.remove("mf-travado");
    };
  }, []);
  return (
    <div className="mf-over"
      onPointerDown={(e) => { apertouFora.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (apertouFora.current && e.target === e.currentTarget) onClose(); }}>
      <div className="mf-sheet" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="mf-sheethead">
          <div><h2>{titulo}</h2>{sub && <p className="sub">{sub}</p>}</div>
          <button className="mf-iconbtn" onClick={onClose} aria-label="Fechar"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ label, children, dica }) {
  const simples = React.isValidElement(children) && (["input", "select", "textarea"].includes(children.type) || children.type === NumInput || children.type === TextoBlur);
  const extra = dica && <small style={{ fontWeight: 400 }}>{dica}</small>;
  if (simples) return <label className="mf-field">{label}{children}{extra}</label>;
  return <div className="mf-field" role="group" aria-label={label}><span>{label}</span>{children}{extra}</div>;
}

export function Seg({ opcoes, valor, onChange }) {
  return (
    <div className="mf-seg" role="radiogroup">
      {opcoes.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} className={valor === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export const Tag = ({ tom = "neutro", children }) => <span className={`mf-tag ${tom}`}>{children}</span>;

export function BarraSaldo({ qtd, usados, reservados }) {
  return (
    <div className="mf-saldo" aria-label={`${usados} usados, ${reservados} reservados de ${qtd}`}>
      {Array.from({ length: qtd }, (_, i) => <i key={i} className={i < usados ? "u" : i < usados + reservados ? "r" : ""} />)}
    </div>
  );
}

// Campo numérico que deixa apagar e digitar à vontade; só corrige limites ao sair do campo
export function NumInput({ value, onChange, min, max, inteiro, className = "mf-input", ...rest }) {
  const [txt, setTxt] = useState(value === null || value === undefined ? "" : String(value).replace(".", ","));
  const foco = useRef(false);
  useEffect(() => { if (!foco.current) setTxt(value === null || value === undefined ? "" : String(value).replace(".", ",")); }, [value]);
  const ler = (t) => { const n = parseFloat(String(t).replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const limitar = (n) => {
    let x = n;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    return inteiro ? Math.round(x) : x;
  };
  return (
    <input {...rest} className={className} type="text" inputMode={inteiro ? "numeric" : "decimal"} value={txt}
      onFocus={(e) => { foco.current = true; e.target.select?.(); }}
      onChange={(e) => {
        const t = e.target.value.replace(inteiro ? /[^\d]/g : /[^\d.,]/g, "");
        setTxt(t);
        const n = ler(t);
        if (n !== null && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(inteiro ? Math.round(n) : n);
      }}
      onBlur={() => {
        foco.current = false;
        const n = ler(txt);
        const v = limitar(n === null ? (Number(value) || min || 0) : n);
        setTxt(String(v).replace(".", ","));
        if (v !== value) onChange(v);
      }} />
  );
}

// Texto que só grava ao sair do campo (evita salvar a cada letra)
export function TextoBlur({ value, onCommit, multilinha, ...rest }) {
  const [t, setT] = useState(value || "");
  const foco = useRef(false);
  const ultimo = useRef({});
  ultimo.current = { t, value: value || "", onCommit };
  useEffect(() => { if (!foco.current) setT(value || ""); }, [value]);
  useEffect(() => () => { const u = ultimo.current; if (u.t !== u.value) u.onCommit(u.t); }, []);
  const props = {
    ...rest, value: t,
    onFocus: () => { foco.current = true; },
    onChange: (e) => setT(e.target.value),
    onBlur: () => { foco.current = false; if (t !== (value || "")) onCommit(t); },
  };
  return multilinha ? <textarea {...props} /> : <input {...props} />;
}

// Procura cliente parecido (mesmo telefone ou mesmo nome)
export function clienteParecido(db, nome, tel, ignorarId) {
  const d = digitos(tel).slice(-8);
  const n = norm(nome);
  return db.clientes.find((c) => c.id !== ignorarId && ((d.length === 8 && digitos(c.telefone).slice(-8) === d) || (n && norm(c.nome) === n))) || null;
}

export function buscaCliente(c, q) {
  if (!q) return true;
  const dq = digitos(q);
  return norm(c.nome).includes(norm(q)) || (dq.length >= 3 && digitos(c.telefone).includes(dq));
}

export function ClientePicker({ db, update, valor, onChange, permitirNovo = true, ignorarId, placeholder }) {
  const [q, setQ] = useState("");
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");
  const faltas = useMemo(() => {
    const m = {};
    db.agendamentos.forEach((a) => { if (a.status === "faltou" && a.clienteId) m[a.clienteId] = (m[a.clienteId] || 0) + 1; });
    return m;
  }, [db.agendamentos]);
  const sel = valor && clienteDe(db, valor);
  if (sel) {
    return (
      <div className="mf-picked">
        <div>
          <b>{sel.nome}</b>
          <small>{sel.telefone || "Sem telefone"}{faltas[sel.id] ? ` · ${faltas[sel.id]} falta(s)` : ""}</small>
        </div>
        <button type="button" className="mf-link" onClick={() => onChange(null)}>Trocar</button>
      </div>
    );
  }
  if (novo) {
    const parecido = clienteParecido(db, nome, tel);
    return (
      <div className="mf-stack mf-panel" style={{ padding: 12 }}>
        <Campo label="Nome do cliente"><input className="mf-input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></Campo>
        <Campo label="WhatsApp"><input className="mf-input" inputMode="tel" placeholder="(22) 99999-9999" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={() => setTel(formatarTel(tel))} /></Campo>
        {parecido && (
          <div className="mf-dupe">
            <span className="mf-grow">Já existe <b>{parecido.nome}</b> {parecido.telefone && `(${parecido.telefone})`}.</span>
            <button type="button" className="mf-btn sm alt" onClick={() => onChange(parecido.id)}>Usar este</button>
          </div>
        )}
        <div className="mf-row">
          <button type="button" className="mf-btn alt sm" onClick={() => setNovo(false)}>Voltar</button>
          <button type="button" className="mf-btn sm" disabled={!nome.trim()} onClick={() => {
            const id = uid();
            update((d) => { d.clientes.push({ id, nome: nome.trim(), telefone: formatarTel(tel), obs: "", aniversario: "", indicadoPor: "", criadoEm: hojeYmd() }); return d; });
            onChange(id);
          }}><UserPlus size={16} />Cadastrar cliente</button>
        </div>
      </div>
    );
  }
  const lista = db.clientes
    .filter((c) => c.id !== ignorarId && buscaCliente(c, q))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 8);
  return (
    <div className="mf-stack" style={{ gap: 8 }}>
      <div style={{ position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: 12, top: 14, color: "var(--cinza)" }} />
        <input className="mf-input" style={{ paddingLeft: 36 }} placeholder={placeholder || "Buscar cliente por nome ou telefone"} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mf-opts">
        {lista.map((c) => (
          <button type="button" key={c.id} className="mf-opt" onClick={() => onChange(c.id)}>
            <span><b>{c.nome}</b> <small>{c.telefone}</small></span>
            {faltas[c.id] >= 2 && <Tag tom="erro">{faltas[c.id]} faltas</Tag>}
          </button>
        ))}
        {lista.length === 0 && <small>Nenhum cliente encontrado.</small>}
      </div>
      {permitirNovo && <button type="button" className="mf-btn alt sm" onClick={() => { setNome(/\d{4}/.test(q) ? "" : q); setTel(/\d{4}/.test(q) ? q : ""); setNovo(true); }}><UserPlus size={16} />Novo cliente</button>}
    </div>
  );
}

/* =====================================================================
   Entrada do app. Usuário e senha; o endereço interno é montado por baixo.
   ===================================================================== */
import React, { useState } from "react";
import { CSS } from "../estilos.js";
import { Campo } from "../componentes.jsx";
import { entrar } from "../nuvem.js";

export function Login({ onEntrou }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (indo) return;
    setIndo(true);
    setErro("");
    const r = await entrar(usuario, senha);
    if (r.ok) onEntrou();
    else { setErro(r.erro); setIndo(false); }
  };

  return (
    <div className="mf">
      <style>{CSS}</style>
      <div className="mf-loading" style={{ flexDirection: "column", gap: 18 }}>
        <img className="mf-logo" src="icons/logo.png" alt="" />
        <span className="dsp" style={{ fontSize: 28 }}>Mats Flex</span>
        <form className="mf-stack" style={{ width: "min(320px, 86vw)", gap: 12 }} onSubmit={enviar}>
          <Campo label="Usuário">
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)}
              autoCapitalize="none" autoCorrect="off" autoComplete="username" />
          </Campo>
          <Campo label="Senha">
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password" />
          </Campo>
          {erro && <div className="mf-alerta" role="alert">{erro}</div>}
          <button className="mf-btn poste" type="submit" disabled={indo || !usuario || !senha}>
            {indo ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

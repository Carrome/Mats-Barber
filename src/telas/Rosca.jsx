/* Gráfico de rosca com total no centro e legenda com valor e % (a cor nunca carrega a informação sozinha) */
import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const pct = (v, total) => { const p = (v / total) * 100; return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`; };

export function Rosca({ titulo, fatias, cor, formatar, detalhe, lado }) {
  const total = fatias.reduce((t, f) => t + f.v, 0);
  return (
    <figure className={"mf-rosca" + (lado ? " lado" : "")}>
      <figcaption>{titulo}</figcaption>
      <div className="mf-rosca-graf">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={fatias} dataKey="v" nameKey="nome" innerRadius="64%" outerRadius="100%" startAngle={90} endAngle={-270}
              stroke="var(--papel)" strokeWidth={2} isAnimationActive={false}>
              {fatias.map((f) => <Cell key={f.id} fill={cor(f.id)} />)}
            </Pie>
            <Tooltip formatter={(v, nome) => [`${formatar(v)} (${pct(v, total)})`, nome]}
              contentStyle={{ background: "var(--papel)", border: "1px solid var(--linha)", borderRadius: 8, color: "var(--tinta)" }}
              itemStyle={{ color: "var(--tinta)" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="centro"><b>{formatar(total)}</b><small>total</small></div>
      </div>
      <ul className="mf-rosca-leg">
        {fatias.map((f) => (
          <li key={f.id}><i style={{ background: cor(f.id) }} /><span className="mf-grow mf-ellip">{f.nome}</span>{detalhe && <small className="det">{detalhe(f)}</small>}<b>{formatar(f.v)}</b><small>{pct(f.v, total)}</small></li>
        ))}
      </ul>
    </figure>
  );
}

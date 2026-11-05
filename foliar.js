/* Guia Análise Foliar: médias por talhão e padrão, de N foliar a Ni foliar */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const nf = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
  const txt = v => v === null || v === undefined ? "" : String(v);
  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  let dados = window.__dadosVNS || {cab:[], linhas:[]};
  let S = {cEst:-1, cCli:-1, cFaz:-1, cTal:-1, cPad:-1, attrs:[]};
  let modo = "ah";

  function estrutura(){
    const cab = dados.cab, achar = re => cab.findIndex(h => re.test(h));
    const bloco = p => {
      const re = new RegExp("^" + p + "\\s*-\\s*(.+?)\\s*-\\s*foliar\\s*$", "i");
      const nome = h => { const m = re.exec(h); return m ? m[1].trim() : null; };
      const ini = cab.findIndex(h => /^n$/i.test(nome(h) || ""));
      const fim = cab.findIndex((h,j) => j >= ini && /^ni$/i.test(nome(h) || ""));
      if (ini < 0 || fim < 0) return [];
      const out = [];
      for (let j = ini; j <= fim; j++){ const n = nome(cab[j]); if (n) out.push({nome:n, col:j}); }
      return out;
    };
    const ah = bloco("AH"), r = bloco("R");
    const mapR = new Map(r.map(x => [norm(x.nome), x.col]));
    const attrs = ah.map(x => ({nome:x.nome, AH:x.col, R: mapR.has(norm(x.nome)) ? mapR.get(norm(x.nome)) : -1}));
    const vistos = new Set(ah.map(x => norm(x.nome)));
    r.forEach(x => { if (!vistos.has(norm(x.nome))) attrs.push({nome:x.nome, AH:-1, R:x.col}); });
    return {cEst:achar(/estado/i), cCli:achar(/cliente/i), cFaz:achar(/fazenda/i), cTal:achar(/talh/i), cPad:achar(/padr/i), attrs};
  }

  /* Filtros em cascata: Estado, Cliente, Talhão, Padrão */
  const IDS = ["fo-estado","fo-cliente","fo-talhao","fo-padrao"];
  const colsF = () => [S.cEst, S.cCli, S.cTal, S.cPad];
  function filtradas(ate){
    const f = colsF().map((c,k) => [c, $(IDS[k]).value]).slice(0, ate);
    return dados.linhas.filter(l => f.every(([c,v]) => !v || c < 0 || txt(l.v[c]) === v));
  }
  function valores(col, linhas){
    if (col < 0) return [];
    const s = new Set(); linhas.forEach(l => { const k = txt(l.v[col]); if (k) s.add(k); });
    return [...s].sort((a,b) => a.localeCompare(b, "pt-BR", {numeric:true}));
  }
  function montarFiltros(){
    S = estrutura();
    colsF().forEach((c,k) => {
      const sel = $(IDS[k]), atual = sel.value, opts = valores(c, k === 0 ? dados.linhas : filtradas(k));
      sel.innerHTML = '<option value="">Todos</option>' + opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
      sel.value = opts.includes(atual) ? atual : "";
      sel.disabled = c < 0;
    });
  }
  IDS.forEach(id => $(id).addEventListener("change", () => { montarFiltros(); render(); }));

  function grupos(linhas){
    const g = new Map();
    for (const l of linhas){
      const k = [S.cCli, S.cTal, S.cPad].map(c => c >= 0 ? txt(l.v[c]) : "").join("|");
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(l);
    }
    return [...g.values()];
  }
  function media(linhas, col){
    const n = linhas.map(l => l.v[col]).filter(v => typeof v === "number" && isFinite(v));
    return n.length ? n.reduce((a,b) => a + b, 0) / n.length : null;
  }

  /* Níveis críticos foliares – soja, Safra 24/25 (Grower, 2025). "< x" = classe de baixo; o limite entra na classe de cima */
  const CORF = [
    {nome:"Baixo", bg:"#FF7C80", fg:"#1B2620"}, {nome:"Médio", bg:"#FFE699", fg:"#1B2620"},
    {nome:"Adequado", bg:"#70AD47", fg:"#1B2620"}, {nome:"Elevado", bg:"#4472C4", fg:"#1B2620"}
  ];
  const FAIXAS = [
    [/^n$/, [38.7,48.4,55.6]], [/^p$/, [2.4,3.6,4.5]], [/^k$/, [19.3,24.8,30.3]],
    [/^ca$/, [6.4,11.3,14.9]], [/^mg$/, [3.6,4,5.1]], [/^s$/, [2.2,3,3.7]],
    [/^b$/, [36.1,46.4,61.9]], [/^cu$/, [7.3,10.1,13.4]], [/^fe$/, [91.4,130.5,156.7]],
    [/^mn$/, [42.5,58.9,78.5]], [/^zn$/, [30.9,42.9,59.5]]
  ];
  /* Se o banco (tabela referencias, id "foliar") trouxer limites, eles substituem os embutidos */
  function tabelaRef(){
    const r = window.VNS_REF && window.VNS_REF.foliar;
    if (!Array.isArray(r) || !r.length) return FAIXAS;
    try { return r.map(x => [new RegExp(x.padrao, "i"), x.limites]); } catch(e){ return FAIXAS; }
  }
  function faixasDe(nome){ const n = norm(nome); const f = tabelaRef().find(([re]) => re.test(n)); return f ? {lim:f[1], cores:CORF} : null; }
  function classe(nome, v){
    const f = faixasDe(nome); if (!f) return null;
    let i = f.lim.findIndex(l => v < l); if (i < 0) i = f.lim.length;
    return f.cores[i];
  }

  /* ---------- Correlação de Pearson: nematoides × nutrientes foliares ---------- */
  let unid = "raiz", graficosCorr = [], ultimo = null;
  const f2 = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
  const f3 = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:3, maximumFractionDigits:3});
  const fmtP = p => p === null ? "–" : (p < 0.001 ? "< 0,001" : f3.format(p));

  function tituloNem(nome){
    const mc = /^(.*?)\s*-\s*Cisto\s+(vi[aá]vel|invi[aá]vel)$/i.exec(nome);
    let pre = "", e = nome;
    if (mc){ e = mc[1].trim(); pre = /^in/i.test(mc[2]) ? "Cistos inviáveis de " : "Cistos viáveis de "; }
    const cient = /^[A-Z][a-z]+(\s+(spp\.|[a-z]+))?$/.test(e) && !/^Ovos$/i.test(e);
    let t = esc(e);
    if (cient){ const spp = /\s+spp\.$/.test(e); t = `<em>${esc(e.replace(/\s+spp\.$/, ""))}</em>${spp ? " spp." : ""}`; }
    return {html: pre + t, texto: pre + e};
  }
  function nematoides(){
    const re = /^\s*(AH|R)\s*-\s*(.+?)\s*\(\s*(Ra[ií]z\s*\/\s*g|Solo\s*100\s*cc)\s*\)\s*$/i;
    const m = new Map();
    dados.cab.forEach((h,j) => {
      const x = re.exec(h); if (!x) return;
      const tipo = x[1].toUpperCase(), nome = x[2].trim(), u = /solo/i.test(x[3]) ? "solo" : "raiz";
      const k = norm(nome) + "|" + u;
      if (!m.has(k)) m.set(k, {nome, unid:u, AH:-1, R:-1});
      m.get(k)[tipo] = j;
    });
    return [...m.values()].map(v => ({...v, tit: tituloNem(v.nome)}));
  }
  function observacoes(nv, at, linhas){
    const tipos = modo === "ambas" ? ["AH","R"] : [modo === "ah" ? "AH" : "R"];
    const xs = [], ys = [];
    tipos.forEach(t => {
      if (nv[t] < 0 || at[t] < 0) return;
      linhas.forEach(l => {
        const x = l.v[nv[t]], y = l.v[at[t]];
        if (typeof x === "number" && isFinite(x) && typeof y === "number" && isFinite(y)){ xs.push(x); ys.push(y); }
      });
    });
    return [xs, ys];
  }
  function pearson(xs, ys){
    const n = xs.length; if (n < 3) return null;
    let mx = 0, my = 0; for (let i = 0; i < n; i++){ mx += xs[i]; my += ys[i]; } mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++){ const a = xs[i] - mx, b = ys[i] - my; sxx += a*a; syy += b*b; sxy += a*b; }
    if (sxx <= 1e-12 * Math.max(1, mx*mx) * n || syy <= 1e-12 * Math.max(1, my*my) * n) return null;
    return {r: Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))), n};
  }
  function lgamma(z){
    const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
    const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betacf(x, a, b){
    const FP = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++){
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  }
  function ibeta(x, a, b){
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(x, a, b) / a : 1 - bt * betacf(1 - x, b, a) / b;
  }
  function pValor(r, n){
    const df = n - 2; if (df < 1) return null; if (Math.abs(r) >= 1) return 0;
    const t2 = r * r * df / (1 - r * r);
    return ibeta(df / (df + t2), df / 2, 0.5);
  }

  function renderCorr(){
    if ($("painel-foliar").hidden) return;
    graficosCorr.forEach(g => g.destroy()); graficosCorr = [];
    const box = $("fcorr-cartoes"), nota = $("fcorr-nota"), leg = $("fcorr-leg");
    const msg = m => { box.innerHTML = `<div class="msg">${m}</div>`; nota.textContent = ""; leg.hidden = true; ultimo = null; };
    if (typeof Chart === "undefined") return msg("A biblioteca de gráficos não carregou. Verifique a conexão e recarregue a página.");
    if (!dados.linhas.length) return msg("Importe uma planilha na guia Dados para calcular as correlações.");
    const todos = nematoides(), nems = todos.filter(v => v.unid === unid);
    if (!nems.length) return msg(`Nenhuma coluna de nematoide ${unid === "raiz" ? "na raiz" : "no solo"} encontrada.`);
    const attrs = S.attrs;
    if (!attrs.length) return msg("Nenhuma coluna foliar encontrada.");
    const linhas = filtradas(4);
    if (!linhas.length) return msg("Nenhuma linha corresponde aos filtros escolhidos.");

    const cards = nems.map(nv => {
      const res = [], sem = [];
      attrs.forEach(at => {
        const [xs, ys] = observacoes(nv, at, linhas), c = pearson(xs, ys);
        if (c) res.push({nome:at.nome, r:c.r, n:c.n, p:pValor(c.r, c.n)}); else sem.push(at.nome);
      });
      res.sort((a,b) => b.r - a.r);
      return {nv, res, sem};
    });
    ultimo = {cards, attrs};
    const nomeModo = {ah:"área homogênea (AH × AH)", r:"reboleira (R × R)", ambas:"área homogênea e reboleira juntas"}[modo];
    const semRaiz = unid === "raiz" && todos.some(v => v.unid === "solo" && !todos.some(w => w.unid === "raiz" && norm(w.nome) === norm(v.nome)));
    nota.textContent = `Correlação ponto a ponto entre a contagem ${unid === "raiz" ? "na raiz" : "no solo"} e cada nutriente foliar, ${nomeModo}, respeitando os filtros acima.` + (semRaiz ? " Cistos não aparecem em Raiz porque só têm contagem no solo." : "");
    leg.hidden = false;

    const altura = Math.max(170, attrs.length * 23 + 46);
    box.innerHTML = cards.map((c,i) => {
      const corpo = c.res.length
        ? `<div class="area-corr" style="height:${altura}px"><canvas id="fc-${i}" role="img" aria-label="${esc(c.nv.tit.texto)}: correlação de Pearson com os nutrientes foliares"></canvas></div>`
        : `<div class="area-corr vazio-corr" style="height:${altura}px">Correlação não calculável: a contagem deste nematoide ou os atributos não variam nos pontos selecionados.</div>`;
      const rod = c.res.length && c.sem.length ? `<p class="fonte-ref">Sem variação nos pontos selecionados (não calculado): ${esc(c.sem.join(", "))}.</p>` : "";
      const n = c.res.length ? ` <span style="font-weight:400;font-size:13px;color:var(--muted)">(n = ${c.res[0].n})</span>` : "";
      const acoes = c.res.length ? `<div class="acoes exp"><button type="button" class="btn btn-mini" data-cimg="${i}">${ICO_IMG}Imagem</button><button type="button" class="btn btn-mini" data-cxls="${i}">${ICO_XLS}Excel</button></div>` : "";
      return `<article class="cartao"><div class="cartao-topo"><h2>${c.nv.tit.html}${n}</h2>${acoes}</div>${corpo}${rod}</article>`;
    }).join("");

    const cs = getComputedStyle(document.documentElement), cor = n => cs.getPropertyValue(n).trim();
    const cPos = cor("--bar-r"), cNeg = cor("--bar-ah"), cTexto = cor("--text"), cMuted = cor("--muted"), cLinha = cor("--line-2");
    const fonte = '"Barlow", system-ui, Arial, sans-serif';
    const semMov = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sig = x => x.p !== null && x.p < 0.05;
    /* Mesma largura da coluna de nomes em todos os gráficos; eixo X ajustado a cada gráfico */
    const mctx = document.createElement("canvas").getContext("2d");
    mctx.font = `11.5px ${fonte}`;
    const wY = Math.ceil(Math.max(...attrs.map(a => mctx.measureText(a.nome).width))) + 14;
    const wTxt = t => { mctx.font = `600 11px ${fonte}`; return mctx.measureText(t).width; };
    const rotuloR = x => f2.format(Math.abs(x.r) < 0.005 ? 0 : x.r) + (sig(x) ? "*" : "");
    const fTick = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:2});
    function passo(D){ const raw = D / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }
    function marcasX(ax){
      const st = passo(ax.max - ax.min), out = [];
      for (let k = Math.ceil(ax.min / st - 1e-9); k * st <= ax.max + 1e-9; k++) out.push({value: k * st});
      ax.ticks = out;
    }
    function limitesX(ax, res){
      const pos = res.filter(x => x.r >= 0), neg = res.filter(x => x.r < 0);
      const mx = pos.length ? Math.max(...pos.map(x => x.r)) : 0;
      const mn = neg.length ? Math.min(...neg.map(x => x.r)) : 0;
      const lp = pos.length ? Math.max(...pos.map(x => wTxt(rotuloR(x)))) + 8 : 0;
      const ln = neg.length ? Math.max(...neg.map(x => wTxt(rotuloR(x)))) + 8 : 0;
      const plotW = Math.max(60, ax.chart.width - wY - 6);
      let D = mx - mn; if (D <= 0) D = 0.1;
      const u = Math.max(1, (plotW - lp - ln) / D);
      ax.min = mn - ln / u; ax.max = mx + lp / u;
    }
    cards.forEach((c,i) => {
      if (!c.res.length) return;
      const res = c.res;
      const rotulos = { id:"rotulosR", afterDatasetsDraw(ch){
        const ctx = ch.ctx, meta = ch.getDatasetMeta(0); ctx.save();
        ctx.font = `600 11px ${fonte}`; ctx.fillStyle = cTexto; ctx.textBaseline = "middle";
        meta.data.forEach((b,j) => {
          const x = res[j], t = rotuloR(x);
          if (x.r >= 0){ ctx.textAlign = "left"; ctx.fillText(t, b.x + 4, b.y); } else { ctx.textAlign = "right"; ctx.fillText(t, b.x - 4, b.y); }
        });
        ctx.restore();
      }};
      graficosCorr.push(new Chart($(`fc-${i}`), {
        type:"bar",
        data:{labels: res.map(x => x.nome), datasets:[{
          data: res.map(x => x.r),
          backgroundColor: res.map(x => (x.r >= 0 ? cPos : cNeg) + (sig(x) ? "" : "59")),
          borderRadius:2, barPercentage:.82, categoryPercentage:.9, maxBarThickness:17
        }]},
        options:{
          indexAxis:"y", responsive:true, maintainAspectRatio:false,
          animation: semMov ? false : {duration:300},
          devicePixelRatio: Math.max(2, window.devicePixelRatio || 1),
          plugins:{legend:{display:false}, tooltip:{callbacks:{
            title: it => it[0].label,
            label: t => { const x = res[t.dataIndex]; return `r = ${f2.format(x.r)}   p = ${fmtP(x.p)}   n = ${x.n}`; }
          }}},
          scales:{
            x:{
               bounds:"data",
               afterDataLimits: ax => limitesX(ax, res),
               afterBuildTicks: marcasX,
               ticks:{color:cMuted, font:{family:fonte, size:11.5}, callback: v => fTick.format(Math.abs(v) < 1e-9 ? 0 : v)},
               grid:{color: ctx => ctx.tick && ctx.tick.value === 0 ? cMuted : cLinha, lineWidth: ctx => ctx.tick && ctx.tick.value === 0 ? 1.5 : 1},
               border:{display:false}},
            y:{grid:{display:false}, border:{display:false}, afterFit: s => { s.width = wY; }, ticks:{color:cTexto, autoSkip:false, font:{family:fonte, size:11.5}}}
          }
        },
        plugins:[rotulos]
      }));
    });
  }
  $("painel-foliar").querySelectorAll(".seletor button").forEach(b => b.addEventListener("click", () => {
    unid = b.dataset.unid;
    $("painel-foliar").querySelectorAll(".seletor button").forEach(x => x.setAttribute("aria-checked", x === b));
    renderCorr();
  }));
  new MutationObserver(() => { if (!$("painel-foliar").hidden) renderCorr(); }).observe($("painel-foliar"), {attributes:true, attributeFilter:["hidden"]});
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderCorr);
  new MutationObserver(renderCorr).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});

  function render(){ renderCorr(); return renderTabela(); }
  function renderTabela(){
    const tab = $("tab-fol"), nota = $("fol-nota"), vazio = $("fol-vazio");
    const aviso = m => { tab.innerHTML = ""; vazio.textContent = m; vazio.hidden = false; nota.textContent = ""; $("fol-leg").hidden = true; };
    if (!dados.linhas.length) return aviso("Importe uma planilha na guia Dados para montar a tabela.");
    if (!S.attrs.length) return aviso("Nenhuma coluna foliar encontrada. Os cabeçalhos devem seguir o padrão “AH-N-foliar” até “R-Ni-foliar”.");
    const linhas = filtradas(4);
    if (!linhas.length) return aviso("Nenhuma linha corresponde aos filtros escolhidos.");
    vazio.hidden = true;
    const G = grupos(linhas);
    const meta = [["Estado",S.cEst],["Cliente",S.cCli],["Fazenda",S.cFaz],["Talhão",S.cTal],["Padrão",S.cPad]].filter(([,c]) => c >= 0);
    const iTal = meta.findIndex(m => m[0] === "Talhão"), limFixa = iTal >= 0 ? iTal : meta.length - 1;
    const tipos = modo === "ambas" ? ["AH","R"] : [modo === "ah" ? "AH" : "R"];
    const dois = tipos.length === 2;
    const attrs = S.attrs.filter(a => tipos.some(t => a[t] >= 0));
    const rs = dois ? ' rowspan="2"' : "";
    const fx = k => k <= limFixa ? ` class="fixa${k === limFixa ? " ultfixa" : ""}" data-fixa="${k}"` : "";
    let h = "<thead><tr>";
    meta.forEach(([n],k) => h += `<th${fx(k)}${rs}>${n}</th>`);
    h += `<th class="n"${rs}>Pontos</th>`;
    attrs.forEach(a => h += dois ? `<th colspan="2" class="grp sep">${esc(a.nome)}</th>` : `<th class="n">${esc(a.nome)}</th>`);
    h += "</tr>";
    if (dois) h += '<tr class="sub">' + attrs.map(() => '<th class="sep">AH</th><th>R</th>').join("") + "</tr>";
    h += "</thead><tbody>";
    for (const g of G){
      const l0 = g[0];
      h += "<tr>";
      meta.forEach(([,c],k) => h += `<td${fx(k)}>${esc(txt(l0.v[c]))}</td>`);
      h += `<td class="n">${g.length}</td>`;
      attrs.forEach(a => tipos.forEach((t,ti) => {
        const v = a[t] >= 0 ? media(g, a[t]) : null;
        const cl = v === null ? null : classe(a.nome, v);
        h += `<td class="n${dois && ti === 0 ? " sep" : ""}"${cl ? ` style="background:${cl.bg};color:${cl.fg}" title="Classe: ${cl.nome}"` : ""}>${v === null ? "–" : nf.format(v)}</td>`;
      }));
      h += "</tr>";
    }
    tab.innerHTML = h + "</tbody>";
    $("fol-leg").hidden = !attrs.some(a => faixasDe(a.nome));
    const nomeModo = {ah:"área homogênea", r:"reboleira", ambas:"área homogênea (AH) e reboleira (R)"}[modo];
    nota.textContent = `Médias dos pontos de cada talhão e padrão, ${nomeModo}. ${linhas.length} pontos em ${G.length} ${G.length === 1 ? "grupo" : "grupos"}, ${attrs.length} nutrientes.`;
    ajustarFixas();
  }

  /* Colunas fixas à esquerda (Estado até Talhão) e segunda linha do cabeçalho */
  function ajustarFixas(){
    const tab = $("tab-fol"); if ($("painel-foliar").hidden) return;
    const ths = [...tab.querySelectorAll("thead tr:first-child th[data-fixa]")];
    let esq = 0;
    ths.forEach(th => {
      const k = th.dataset.fixa;
      tab.querySelectorAll(`[data-fixa="${k}"]`).forEach(el => el.style.left = esq + "px");
      esq += th.getBoundingClientRect().width;
    });
    const r1 = tab.querySelector("thead tr:first-child");
    tab.querySelectorAll("thead tr.sub th").forEach(th => th.style.top = (r1 ? r1.getBoundingClientRect().height : 0) + "px");
  }
  new MutationObserver(() => requestAnimationFrame(ajustarFixas)).observe($("painel-foliar"), {attributes:true, attributeFilter:["hidden"]});
  window.addEventListener("resize", ajustarFixas);

  $("painel-foliar").querySelectorAll(".modo button").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    $("painel-foliar").querySelectorAll(".modo button").forEach(x => x.setAttribute("aria-checked", x === b));
    render();
  }));

  /* ---------- Exportação: imagem (PNG) e Excel (.xlsx) ---------- */
  const ICO_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
  const ICO_XLS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>';
  const dlP = (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  function avisar(m, erro){
    const a = $("aviso"); a.textContent = m; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => a.hidden = true, 3500);
  }
  async function salvar(nome, blob){
    const dl = await dlP;
    if (dl){
      try{ await dl.save({filename:nome, data:blob}); }
      catch(e){
        if (e && e.code === "declined") return;
        if (e && e.code === "rate_limited") return avisar("Já há um arquivo aguardando confirmação. Tente de novo em instantes.", true);
        avisar("Não foi possível salvar o arquivo aqui.", true);
      }
      return;
    }
    if (window.claude) return avisar("Exportação indisponível nesta visualização.", true);
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const slug = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  const hoje = () => new Date().toISOString().slice(0,10);
  const NOMES_F = ["Estado","Cliente","Talhão","Padrão"];
  const textoFiltros = () => NOMES_F.map((n,k) => `${n}: ${$(IDS[k]).value || "Todos"}`).join(", ");
  const nomeAmostra = () => ({ah:"Área homogênea (AH)", r:"Reboleira (R)", ambas:"Área homogênea e reboleira (AH e R)"})[modo];
  const nomeUnid = () => unid === "raiz" ? "Raiz" : "Solo";
  const REFS = ["Referência Grower – Níveis críticos foliares, soja, Safra 24/25 (Grower, 2025). Co, Mo e Ni sem referência."];
  function abaXlsx(aoa){
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = (aoa[0] || []).map((h,j) => ({wch: Math.min(48, Math.max(10, ...aoa.map(r => String(r[j] ?? "").length + 2)))}));
    return ws;
  }
  function abaFiltros(){
    return [["Item","Valor"], ...NOMES_F.map((n,k) => [n, $(IDS[k]).value || "Todos"]),
      ["Amostra", nomeAmostra()], ["Contagem de nematoides (correlação)", nomeUnid()], ["Planilha de origem", $("nome-arquivo").textContent || ""], [],
      ["Médias: média dos pontos de cada talhão e padrão. AH = área homogênea; R = reboleira."],
      ["Correlação de Pearson ponto a ponto; p-valor pelo teste t com n − 2 graus de liberdade."],
      ...REFS.map(r => [r])];
  }
  function tabelaCorr(c){
    const rows = c.res.map(x => [x.nome, Math.round(x.r * 1e4) / 1e4, x.p === null ? null : Number(x.p.toPrecision(4)), x.n, x.p !== null && x.p < 0.05 ? "Sim" : "Não"]);
    c.sem.forEach(nm => rows.push([nm, null, null, null, "Sem variação"]));
    return [["Nutriente", "r", "p-valor", "n", "Significativo (p < 0,05)"], ...rows];
  }
  function tabelaMedias(){
    const linhas = filtradas(4); if (!linhas.length) return null;
    const G = grupos(linhas);
    const meta = [["Estado",S.cEst],["Cliente",S.cCli],["Fazenda",S.cFaz],["Talhão",S.cTal],["Padrão",S.cPad]].filter(([,c]) => c >= 0);
    const tipos = modo === "ambas" ? ["AH","R"] : [modo === "ah" ? "AH" : "R"];
    const attrs = S.attrs.filter(a => tipos.some(t => a[t] >= 0));
    const cab = meta.map(m => m[0]).concat("Nº de pontos");
    attrs.forEach(a => tipos.forEach(t => { cab.push(`${a.nome} - ${t}`); if (faixasDe(a.nome)) cab.push(`${a.nome} - ${t} - Classe`); }));
    const rows = G.map(g => {
      const l0 = g[0], r = meta.map(([,c]) => l0.v[c]); r.push(g.length);
      attrs.forEach(a => tipos.forEach(t => {
        const v = a[t] >= 0 ? media(g, a[t]) : null;
        r.push(v === null ? null : Math.round(v * 100) / 100);
        if (faixasDe(a.nome)){ const cl = v === null ? null : classe(a.nome, v); r.push(cl ? cl.nome : ""); }
      }));
      return r;
    });
    return [cab, ...rows];
  }
  async function excel(indices, comMedias){
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    const wb = XLSX.utils.book_new(), usados = new Set(["Médias","Filtros"]);
    if (comMedias){
      const m = tabelaMedias(); if (!m) return avisar("Nenhuma linha corresponde aos filtros.", true);
      XLSX.utils.book_append_sheet(wb, abaXlsx(m), "Médias");
    }
    if (ultimo) indices.forEach(i => {
      const c = ultimo.cards[i]; if (!c) return;
      const base = c.nv.tit.texto.replace(/[\[\]:*?\/\\]/g, "").slice(0, 31); let nome = base, n = 2;
      while (usados.has(nome)) nome = base.slice(0, 28) + " " + n++;
      usados.add(nome);
      XLSX.utils.book_append_sheet(wb, abaXlsx(tabelaCorr(c)), nome);
    });
    XLSX.utils.book_append_sheet(wb, abaXlsx(abaFiltros()), "Filtros");
    const buf = XLSX.write(wb, {bookType:"xlsx", type:"array"});
    const nome = comMedias ? `analise_foliar_${hoje()}.xlsx` : `analise_foliar_correlacao_${slug(ultimo.cards[indices[0]].nv.tit.texto)}_${unid}_${hoje()}.xlsx`;
    await salvar(nome, new Blob([buf]));
  }
  function partesHtml(html){
    const dec = t => { const d = document.createElement("textarea"); d.innerHTML = t; return d.value; };
    return html.split(/(<em>.*?<\/em>)/).filter(Boolean).map(p => /^<em>/.test(p) ? {t:dec(p.replace(/<\/?em>/g, "")), it:true} : {t:dec(p), it:false});
  }
  async function imagemCorr(i){
    if (!ultimo) return;
    const c = ultimo.cards[i], ch = Chart.getChart("fc-" + i); if (!c || !ch) return;
    const cs = getComputedStyle(document.documentElement), cor = n => cs.getPropertyValue(n).trim();
    const f = '"Barlow", system-ui, Arial, sans-serif', fT = '"Barlow Semi Condensed", "Barlow", Arial, sans-serif';
    const s = 2, pad = 28, cw = ch.canvas.clientWidth, chH = ch.canvas.clientHeight;
    const rod = c.sem.length ? `Sem variação nos pontos selecionados (não calculado): ${c.sem.join(", ")}.` : "";
    const W = Math.max(680, cw + pad * 2), H = pad + 28 + 12 + 18 * 3 + 12 + chH + (rod ? 30 : 6) + pad;
    const cv = document.createElement("canvas"); cv.width = W * s; cv.height = H * s;
    const ctx = cv.getContext("2d"); ctx.scale(s, s);
    ctx.fillStyle = cor("--surface"); ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    let y = pad;
    ctx.fillStyle = cor("--ouro"); ctx.fillRect(pad, y, 4, 28);
    let x = pad + 14; ctx.fillStyle = cor("--text");
    for (const p of partesHtml(c.nv.tit.html)){ ctx.font = `${p.it ? "italic " : ""}600 21px ${fT}`; ctx.fillText(p.t, x, y + 14); x += ctx.measureText(p.t).width; }
    if (c.res.length){ ctx.font = `400 13px ${f}`; ctx.fillStyle = cor("--muted"); ctx.fillText(`  (n = ${c.res[0].n})`, x, y + 15); }
    ctx.font = `500 13px ${f}`;
    let lx = W - pad;
    for (const [t, c2] of [["Negativa", cor("--bar-ah")], ["Positiva", cor("--bar-r")]]){
      lx -= ctx.measureText(t).width; ctx.fillStyle = cor("--text"); ctx.fillText(t, lx, y + 14);
      lx -= 20; ctx.fillStyle = c2; ctx.fillRect(lx, y + 7, 14, 14); lx -= 22;
    }
    y += 28 + 12;
    ctx.font = `400 12.5px ${f}`; ctx.fillStyle = cor("--muted");
    ctx.fillText(`${textoFiltros()}.`, pad, y + 6);
    y += 18;
    ctx.fillText(`Amostra: ${nomeAmostra()}. Contagem de nematoides: ${nomeUnid()}.`, pad, y + 6);
    y += 18;
    ctx.fillText("Correlação de Pearson ponto a ponto. Barras cheias e * = significativa (p < 0,05).", pad, y + 6);
    y += 18 + 12;
    ctx.drawImage(ch.canvas, pad, y, cw, chH);
    y += chH;
    if (rod){ ctx.font = `400 12px ${f}`; ctx.fillStyle = cor("--muted"); ctx.fillText(rod, pad, y + 20); }
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (blob) await salvar(`analise_foliar_correlacao_${slug(c.nv.tit.texto)}_${unid}_${hoje()}.png`, blob);
  }
  async function ocupado(btn, fn){ btn.classList.add("ocupado"); try{ await fn(); } finally { btn.classList.remove("ocupado"); } }
  $("fcorr-cartoes").addEventListener("click", e => {
    const b = e.target.closest("button[data-cimg],button[data-cxls]"); if (!b) return;
    if (b.dataset.cimg !== undefined) ocupado(b, () => imagemCorr(+b.dataset.cimg));
    else ocupado(b, () => excel([+b.dataset.cxls], false));
  });
  $("fx-todos").addEventListener("click", e => ocupado(e.currentTarget, () => excel(ultimo ? ultimo.cards.map((_,i) => i) : [], true)));

  document.addEventListener("dados-atualizados", e => { dados = e.detail; montarFiltros(); render(); });
  montarFiltros(); render();
  if (location.hash === "#foliar") $("guia-foliar").click();
})();

/* Guia Saúde do Solo – Embrapa: nossos pontos comparados com a Plataforma Saúde do Solo (Embrapa) */
(function(){
  const $ = id => document.getElementById(id);
  const P = $("painel-saude"); if (!P) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const txt = v => v === null || v === undefined ? "" : String(v);
  const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const norm = s => semAcento(s).replace(/\s+/g, " ").trim().toLowerCase();
  const soma = a => a.reduce((x,y) => x + y, 0);
  const f2 = new Intl.NumberFormat("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
  const f0 = new Intl.NumberFormat("pt-BR", {maximumFractionDigits:0});
  const pct = (n, t) => t ? f0.format(100 * n / t) + "%" : "–";
  let dados = window.__dadosVNS || {cab:[], linhas:[]};
  let modo = "ah", indMapa = "saude";

  /* ---------- Classes ---------- */
  const CORES = ["#F8696B","#F4B084","#FFE699","#A9D08E","#70AD47"];
  const CLASSES = ["Muito baixo","Baixo","Médio","Elevado","Muito elevado"];
  const SAUDE = ["Doente","Adoecendo","Intermediário","Recuperando","Saudável"];
  const LIM = [0.2, 0.4, 0.6, 0.8];
  const r2 = v => Math.round(v * 100) / 100;
  const r4 = v => Math.round(v * 10000) / 10000;
  /* Índices (0 a 1): classificação pelo valor arredondado em 2 casas; valor no limite fica na classe de baixo */
  const classe = v => { v = r2(v); let k = 0; while (k < 4 && v > LIM[k]) k++; return k; };
  /* Saúde do Solo (diagrama Embrapa Ciclagem × Armazenamento). Testa da pior para a melhor classe,
     então um ponto exatamente sobre uma linha fica na classe pior. */
  function saudeSolo(c, a){
    c = r2(c); a = r2(a); const d = r4(a - c), s = r4(c + a);
    if (s <= 0.8 && (Math.abs(d) <= 0.2 || Math.max(c, a) <= 0.4)) return 0;  /* Doente */
    if (d >= 0.2 && c <= 0.6 && a >= 0.4) return 1;                            /* Adoecendo */
    if (r4(Math.abs(c - 0.5) + Math.abs(a - 0.5)) <= 0.2) return 2;            /* Intermediário */
    if (-d >= 0.2 && a <= 0.6 && c >= 0.4) return 3;                           /* Recuperando */
    return 4;                                                                  /* Saudável */
  }
  const POLIG = [[[0,0],[.4,0],[.4,.2],[.5,.3],[.3,.5],[.2,.4],[0,.4]], [[0,.4],[.2,.4],[.3,.5],[.5,.7],[.6,.8],[.6,1],[0,1]],
    [[.3,.5],[.5,.7],[.7,.5],[.5,.3]], [[.4,0],[1,0],[1,.6],[.8,.6],[.7,.5],[.5,.3],[.4,.2]], [[.6,1],[1,1],[1,.6],[.8,.6],[.7,.5],[.5,.7],[.6,.8]]];
  /* Textura pela argila arredondada (agrupamento SiBCS simplificado, sem areia e silte); limite na classe de baixo */
  const TEXTURAS = ["Arenosa","Média","Argilosa","Muito argilosa"];
  const COR_TEX = {"Arenosa":"#EAD7A4","Média":"#C8A165","Argilosa":"#9C6B3E","Muito argilosa":"#5E3B22"};
  const REF_TEX = {"Arenosa":"Arenosa","Média":"Media","Argilosa":"Argilosa","Muito argilosa":"Muito Argilosa"};
  const textura = arg => { const a = Math.round(arg); return a < 15 ? "Arenosa" : a <= 35 ? "Média" : a <= 60 ? "Argilosa" : "Muito argilosa"; };

  /* ---------- Estrutura das colunas (pelos nomes) ---------- */
  const IND = {iqs:/^IQS\s*Fert\s*bio/i, cic:/^Ciclagem/i, arm:/^Armaz/i, sup:/^Suprimento/i, arg:/^Argila/i};
  const NOME_IND = {iqs:"IQS Fertbio", cic:"Ciclagem de nutrientes", arm:"Armazenamento de nutrientes", sup:"Suprimento de nutrientes"};
  let S = {};
  function estrutura(){
    const cab = dados.cab.map(String), achar = re => cab.findIndex(h => re.test(h)), acharN = n => cab.findIndex(h => norm(h) === n);
    const col = (am, re) => cab.findIndex(h => { const m = new RegExp("^" + am + "\\s*-\\s*(.+)$", "i").exec(h); return m && re.test(m[1].trim()); });
    const cols = {}; ["AH","R"].forEach(am => { cols[am.toLowerCase()] = {}; Object.entries(IND).forEach(([k,re]) => cols[am.toLowerCase()][k] = col(am, re)); });
    return {cEst:achar(/estado/i), cCli:achar(/cliente/i), cFaz:achar(/fazenda/i), cTal:achar(/talh/i), cPad:achar(/padr/i), cPto:achar(/^\s*ponto/i),
      cMun:acharN("municipio"), cLat:acharN("latitude"), cLon:acharN("longitude"), cols};
  }
  const temIndices = am => ["cic","arm"].every(k => S.cols[am][k] >= 0);

  /* ---------- Filtros em cascata ---------- */
  const IDS = ["sd-estado","sd-cliente","sd-talhao","sd-padrao"];
  const colsF = () => [S.cEst, S.cCli, S.cTal, S.cPad];
  function filtradas(ate){
    const f = colsF().map((c,k) => [c, $(IDS[k]).value]).slice(0, ate);
    return dados.linhas.filter(l => f.every(([c,v]) => !v || c < 0 || txt(l.v[c]) === v));
  }
  function valoresCol(col, linhas){
    if (col < 0) return [];
    const s = new Set(); linhas.forEach(l => { const k = txt(l.v[col]); if (k) s.add(k); });
    return [...s].sort((a,b) => a.localeCompare(b, "pt-BR", {numeric:true}));
  }
  function montarFiltros(){
    S = estrutura();
    colsF().forEach((c,k) => {
      const sel = $(IDS[k]), atual = sel.value, opts = valoresCol(c, k === 0 ? dados.linhas : filtradas(k));
      sel.innerHTML = '<option value="">Todos</option>' + opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
      sel.value = opts.includes(atual) ? atual : "";
      sel.disabled = c < 0;
    });
  }
  IDS.forEach(id => $(id).addEventListener("change", () => { montarFiltros(); render(); }));
  ["sd-recorte","sd-cultura","sd-textura"].forEach(id => $(id).addEventListener("change", render));
  P.querySelectorAll(".modo button").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    P.querySelectorAll(".modo button").forEach(x => x.setAttribute("aria-checked", x === b));
    render();
  }));

  /* ---------- Valores dos pontos ---------- */
  const num = v => { if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== ""){ const n = parseFloat(v.replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : (isFinite(+v) ? +v : null); } return null; };
  const numCoord = v => { if (typeof v === "number") return isFinite(v) ? v : null; if (typeof v === "string" && v.trim() !== ""){ const n = parseFloat(v.replace(",", ".")); return isFinite(n) ? n : null; } return null; };
  function ponto(l, am){
    const c = S.cols[am], o = {};
    Object.keys(IND).forEach(k => o[k] = c[k] >= 0 ? num(l.v[c[k]]) : null);
    o.saude = o.cic !== null && o.arm !== null ? saudeSolo(o.cic, o.arm) : null;
    return o;
  }
  const mediaDe = (vals, k) => { const n = vals.map(v => v[k]).filter(v => v !== null); return n.length ? soma(n) / n.length : null; };
  const amostras = () => (modo === "ambas" ? ["ah","r"] : [modo]).filter(temIndices);
  const NOME_AM = {ah:"Área homogênea", r:"Reboleira"};
  const PAL = ["#1F3D2B","#B8901C","#2F6E9E","#8E3B46","#5B4A8B","#3E7F6E"], PAL_R = ["#6E9C7E","#E3C766","#86B4D8","#C98A93","#A597CC","#8CC3B3"];
  let corPadrao = new Map();
  function series(linhas){
    const pads = S.cPad >= 0 ? valoresCol(S.cPad, linhas) : [""];
    const ams = amostras(), out = [];
    pads.forEach(pd => {
      if (!corPadrao.has(pd)) corPadrao.set(pd, corPadrao.size % PAL.length);
      const ls = S.cPad >= 0 ? linhas.filter(l => txt(l.v[S.cPad]) === pd) : linhas;
      ams.forEach(am => {
        const vals = ls.map(l => { const o = ponto(l, am); o.l = l; return o; });
        const rot = (pd || "Pontos") + (ams.length > 1 || modo === "r" ? " · " + am.toUpperCase() : "");
        out.push({pd, am, rot, vals, cor:(am === "r" ? PAL_R : PAL)[corPadrao.get(pd)]});
      });
    });
    return out;
  }

  /* ---------- Referência Embrapa ---------- */
  const UF_NOME = {"acre":"AC","alagoas":"AL","amapa":"AP","amazonas":"AM","bahia":"BA","ceara":"CE","distrito federal":"DF","espirito santo":"ES","goias":"GO","maranhao":"MA","mato grosso":"MT","mato grosso do sul":"MS","minas gerais":"MG","para":"PA","paraiba":"PB","parana":"PR","pernambuco":"PE","piaui":"PI","rio de janeiro":"RJ","rio grande do norte":"RN","rio grande do sul":"RS","rondonia":"RO","roraima":"RR","santa catarina":"SC","sao paulo":"SP","sergipe":"SE","tocantins":"TO"};
  const sigla = v => { const t = norm(v); return t.length === 2 ? t.toUpperCase() : (UF_NOME[t] || ""); };
  const refBase = () => { const r = window.VNS_REF && window.VNS_REF.embrapa_saude; return r && r.culturas ? r : window.VNS_SAUDE_REF; };
  let idxMun = null, idxMunDe = null;
  function chaveMun(uf, mun){
    const R = refBase(); if (!R || !R.culturas.soja || !R.culturas.soja.mun) return null;
    if (idxMunDe !== R){ idxMun = new Map(Object.keys(R.culturas.soja.mun).map(k => [norm(k), k])); idxMunDe = R; }
    return idxMun.get(norm(uf + "|" + mun)) || null;
  }
  const moda = arr => { const m = new Map(); arr.filter(Boolean).forEach(x => m.set(x, (m.get(x) || 0) + 1)); let best = "", n = 0; m.forEach((c,k) => { if (c > n){ n = c; best = k; } }); return {valor:best, distintos:m.size}; };
  const corta = (v, i) => v.slice(i * 5, i * 5 + 5);
  /* Escolhe a distribuição de referência conforme Recorte, Cultura e Textura */
  function referencia(linhas){
    const R = refBase(); if (!R) return null;
    const avisos = [], cult = $("sd-cultura").value, C = R.culturas[cult] || R.culturas.soja;
    const nomeCult = cult === "soja" ? "Soja" : "Todas as culturas";
    const ufM = moda(linhas.map(l => S.cEst >= 0 ? sigla(l.v[S.cEst]) : ""));
    const uf = ufM.valor;
    let texSel = $("sd-textura").value, texNome = "";
    if (texSel === "auto"){
      const args = []; linhas.forEach(l => ["ah","r"].forEach(am => { const c = S.cols[am].arg; const v = c >= 0 ? num(l.v[c]) : null; if (v !== null) args.push(v); }));
      if (args.length){ texNome = textura(soma(args) / args.length); texSel = REF_TEX[texNome]; }
      else { texSel = "todas"; avisos.push("Sem Argila (%) nos pontos: usando todas as texturas."); }
    }
    const nomeTex = t => t === "todas" ? "todas as texturas" : t === "Media" ? "Média" : t === "Muito Argilosa" ? "Muito argilosa" : t;
    let recorte = $("sd-recorte").value, vet = null, nome = "";
    if (recorte === "mun"){
      const munM = moda(linhas.map(l => S.cMun >= 0 ? txt(l.v[S.cMun]).trim() : ""));
      const k = munM.valor && uf ? chaveMun(uf, munM.valor) : null;
      if (cult !== "soja"){ avisos.push("Recorte por município só existe para Soja: usando o estado."); recorte = "uf"; }
      else if (!munM.valor){ avisos.push("Preencha a coluna Município na guia Dados para usar o recorte por município. Usando o estado."); recorte = "uf"; }
      else if (!k){ avisos.push(`Município “${munM.valor}${uf ? " – " + uf : ""}” sem amostras de soja na plataforma: usando o estado.`); recorte = "uf"; }
      else {
        vet = C.mun[k]; nome = `${k.split("|")[1]} – ${uf} · ${nomeCult} · todas as texturas`;
        if (munM.distintos > 1) avisos.push(`Pontos de ${munM.distintos} municípios: usando o mais frequente.`);
      }
    }
    if (recorte === "uf"){
      const E = uf && C.uf[uf];
      if (!uf || !E){ avisos.push(uf ? `Estado ${uf} sem amostras na plataforma: usando o Brasil.` : "Estado não identificado: usando o Brasil."); recorte = "br"; }
      else {
        let t = texSel; if (!E[t] || !soma(E[t])){ if (t !== "todas") avisos.push(`Sem amostras ${nomeTex(t).toLowerCase()} no estado: usando todas as texturas.`); t = "todas"; }
        vet = E[t]; nome = `${uf} · ${nomeCult} · ${nomeTex(t)}`;
        if (ufM.distintos > 1) avisos.push(`Pontos de ${ufM.distintos} estados: usando o mais frequente.`);
      }
    }
    if (recorte === "br"){
      let t = texSel; if (!C.br[t] || !soma(C.br[t])) t = "todas";
      vet = C.br[t]; nome = `Brasil · ${nomeCult} · ${nomeTex(t)}`;
    }
    const ref = {nome, cic:corta(vet,0), arm:corta(vet,1), sup:corta(vet,2), saude:corta(vet,3), consulta:R.consulta, texNome};
    if (soma(ref.saude) < 30) avisos.push(`Atenção: só ${soma(ref.saude)} amostras neste recorte; interprete com cautela ou escolha um recorte maior.`);
    ref.avisos = avisos;
    return ref;
  }
  /* Percentil aproximado: classes abaixo + interpolação dentro da classe (a plataforma só fornece contagens por classe) */
  function percentil(v, dist){
    const t = soma(dist); if (v === null || !t) return null;
    v = r2(v); const k = classe(v), ini = k === 0 ? 0 : LIM[k-1], fim = k === 4 ? 1 : LIM[k];
    return Math.round(100 * (soma(dist.slice(0, k)) + dist[k] * Math.min(1, Math.max(0, (v - ini) / (fim - ini)))) / t);
  }

  /* ---------- Desenho ---------- */
  const ICO_IMG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
  const ICO_XLS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>';
  const btnImg = (rot) => `<div class="acoes exp"><button type="button" class="btn btn-mini" data-sdimg title="Baixar como imagem (PNG)">${ICO_IMG}${rot === false ? "" : "Imagem"}</button></div>`;
  const chip = (k, nomes) => k === null ? "–" : `<span class="sd-chip" style="background:${CORES[k]}">${nomes[k]}</span>`;
  function barra(dist, rot, nomes){
    const t = soma(dist);
    return `<div class="sd-bl"><span class="sd-bl-rot">${esc(rot)}</span><div class="sd-bar">${t ? dist.map((n,i) => { const p = 100 * n / t; return p > 0 ? `<i style="width:${p}%;background:${CORES[i]}" title="${nomes[i]}: ${f0.format(p)}%">${p >= 9 ? f0.format(p) + "%" : ""}</i>` : ""; }).join("") : '<span class="sd-bar-vazia">sem dados</span>'}</div></div>`;
  }
  const contar = (vals, f) => { const d = [0,0,0,0,0]; vals.forEach(v => { const k = f(v); if (k !== null && k !== undefined) d[k]++; }); return d; };
  const comValor = (vals, k) => vals.filter(v => v[k] !== null);

  let ultimo = null;
  function render(){
    const vazio = $("sd-vazio"), cont = $("sd-conteudo");
    const msg = m => { vazio.textContent = m; vazio.hidden = false; cont.hidden = true; $("sd-ref-n").textContent = ""; $("sd-avisos").textContent = ""; ultimo = null; };
    if (!refBase()) return msg("A referência da Embrapa não carregou. Recarregue a página.");
    if (!dados.linhas.length) return msg("Importe uma planilha ou escolha uma base salva na guia Dados.");
    if (!temIndices("ah") && !temIndices("r")) return msg("Não encontrei as colunas de Ciclagem e Armazenamento de nutrientes (ex.: “AH-Ciclagem nutrientes” e “AH-Armaz Nutrientes”).");
    if (!amostras().length) return msg(`Não há colunas de ${modo === "r" ? "Reboleira (R-)" : "Área homogênea (AH-)"} para os índices.`);
    const linhas = filtradas(4);
    if (!linhas.length) return msg("Nenhuma linha corresponde aos filtros escolhidos.");
    vazio.hidden = true; cont.hidden = false;
    const ref = referencia(linhas), Ss = series(linhas);
    ultimo = {linhas, ref, Ss};
    $("sd-ref-n").innerHTML = `${esc(ref.nome)} · <b>${soma(ref.saude).toLocaleString("pt-BR")}</b> amostras`;
    $("sd-avisos").textContent = ref.avisos.join(" ");
    desenharCmp(); desenharDiagrama(); desenharPizzas(); desenharMapa(); desenharTabela();
    $("sd-fonte").textContent = `Fonte da referência: Embrapa – Plataforma Saúde do Solo (saudedosolo.embrapa.gov.br/plataforma-publica), modelo FertBio, consultada em ${new Date(ref.consulta + "T12:00").toLocaleDateString("pt-BR")}. Muitos municípios têm poucas amostras; quando o recorte tiver menos de 30, o aviso aparece acima.`;
  }

  /* 1. Cartões dos índices */
  function desenharCmp(){
    const {ref, Ss} = ultimo, rotCol = modo === "ambas" ? "Padrão · amostra" : "Padrão";
    $("sd-cmp").innerHTML = ["cic","arm","sup"].map(k => {
      const L = Ss.map(s => { const vs = comValor(s.vals, k), m = mediaDe(vs, k); return {s, m, n:vs.length, d:contar(vs, v => classe(v[k])), pc:percentil(m, ref[k])}; });
      return `<div class="cartao sd-card"><div class="cartao-topo"><h2>${NOME_IND[k]}</h2>${btnImg()}</div>
        <table class="sd-kp"><thead><tr><th>${rotCol}</th><th class="n">Média</th><th>Classe</th><th class="n">Percentil</th></tr></thead><tbody>
        ${L.map(l => `<tr><td>${esc(l.s.rot)}</td><td class="n"><b>${l.m === null ? "–" : f2.format(l.m)}</b></td><td>${l.m === null ? "–" : chip(classe(l.m), CLASSES)}</td><td class="n"><b>${l.pc === null ? "–" : l.pc + "º"}</b></td></tr>`).join("")}</tbody></table>
        ${L.map(l => barra(l.d, `${l.s.rot} (${l.n})`, CLASSES)).join("")}${barra(ref[k], "Embrapa", CLASSES)}</div>`;
    }).join("");
  }

  /* 1b. Diagrama Saúde do Solo */
  function desenharDiagrama(){
    const {ref, Ss} = ultimo, X = v => 40 + v * 340, Y = v => 360 - v * 340;
    const cs = getComputedStyle(document.documentElement), cTxt = cs.getPropertyValue("--text").trim() || "#1B2620", cMut = cs.getPropertyValue("--muted").trim() || "#5C6B61";
    let h = POLIG.map((pg,i) => `<polygon points="${pg.map(([c,a]) => X(c) + "," + Y(a)).join(" ")}" fill="${CORES[i]}" fill-opacity=".55" stroke="#fff" stroke-width="1.5"/>`).join("");
    for (let t = 0; t <= 10; t += 2){ const v = t / 10; h += `<text x="${X(v)}" y="376" font-size="10" text-anchor="middle" fill="${cMut}">${f2.format(v).slice(0,3)}</text><text x="34" y="${Y(v) + 3}" font-size="10" text-anchor="end" fill="${cMut}">${f2.format(v).slice(0,3)}</text>`; }
    h += `<text x="${X(.5)}" y="395" font-size="11.5" text-anchor="middle" fill="${cTxt}" font-weight="600">Índice de Ciclagem de Nutrientes</text>
      <text transform="translate(11 ${Y(.5)}) rotate(-90)" font-size="11.5" text-anchor="middle" fill="${cTxt}" font-weight="600">Índice de Armazenamento de Nutrientes</text>`;
    [["Doente",.17,.2],["Adoecendo",.25,.8],["Intermediário",.5,.5],["Recuperando",.75,.22],["Saudável",.8,.84]].forEach(([n,c,a]) => h += `<text x="${X(c)}" y="${Y(a)}" font-size="11" text-anchor="middle" fill="#1B2620" opacity=".75">${n}</text>`);
    const lim = v => Math.max(0, Math.min(1, v));
    const marca = (s, cx, cy, r, ds) => { const a = `class="sd-pt" ${ds} fill="${s.cor}" fill-opacity=".85" stroke="#fff" stroke-width=".8"`; return s.am === "r"
      ? `<path d="M${cx} ${cy - r * 1.2} L${cx + r * 1.1} ${cy + r * .8} L${cx - r * 1.1} ${cy + r * .8} Z" ${a}/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" ${a}/>`; };
    Ss.forEach((s,si) => s.vals.forEach((v,vi) => { if (v.saude !== null) h += marca(s, X(lim(v.cic)), Y(lim(v.arm)), 4.2, `data-s="${si}" data-v="${vi}"`); }));
    const L = Ss.map(s => { const vs = s.vals.filter(v => v.saude !== null), c = mediaDe(vs, "cic"), a = mediaDe(vs, "arm"); return {s, n:vs.length, c, a, k:c !== null && a !== null ? saudeSolo(c, a) : null, d:contar(vs, v => v.saude)}; });
    L.forEach((l,li) => { if (l.k !== null){ const x = X(lim(l.c)), y = Y(lim(l.a)); h += `<path class="sd-pt" data-m="${li}" d="M${x} ${y - 10} L${x + 10} ${y} L${x} ${y + 10} L${x - 10} ${y} Z" fill="${l.s.cor}" stroke="#fff" stroke-width="2"/>`; } });
    $("sd-diag").innerHTML = h;
    ultimo.diag = L;
    $("sd-diag-leg").innerHTML = Ss.map(s => `<span class="sw">${s.am === "r" ? `<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1 L11 10 L1 10 Z" fill="${s.cor}"/></svg>` : `<i style="background:${s.cor};border-radius:50%"></i>`}${esc(s.rot)}</span>`).join("") + "<span>◆ = média</span>";
    $("sd-diag-dir").innerHTML = `
      <table class="sd-kp"><thead><tr><th>${modo === "ambas" ? "Padrão · amostra" : "Padrão"}</th><th class="n">Ciclagem</th><th class="n">Armaz.</th><th>Classe da média</th></tr></thead><tbody>
      ${L.map(l => `<tr><td>${esc(l.s.rot)}</td><td class="n"><b>${l.c === null ? "–" : f2.format(l.c)}</b></td><td class="n"><b>${l.a === null ? "–" : f2.format(l.a)}</b></td><td>${chip(l.k, SAUDE)}</td></tr>`).join("")}</tbody></table>
      <p class="nota" style="margin:4px 0 6px">Distribuição dos pontos nas classes × amostras da Embrapa no recorte:</p>
      ${L.map(l => barra(l.d, `${l.s.rot} (${l.n})`, SAUDE)).join("")}${barra(ref.saude, "Embrapa", SAUDE)}
      <div class="leg-classes" style="margin-top:8px">${SAUDE.map((s,i) => `<span class="sw"><i style="background:${CORES[i]}"></i>${s}</span>`).join("")}</div>
      <p class="nota" style="margin-top:10px">Regra: cada ponto é posicionado pela sua Ciclagem e seu Armazenamento; a área onde cai define a classe. Ponto exatamente sobre uma linha fica na classe pior. O Suprimento não entra nessa classe.</p>`;
  }


  /* Dica ao passar o mouse nos pontos do diagrama (como nas outras guias) */
  const tip = document.createElement("div"); tip.className = "sd-tip"; tip.hidden = true;
  const diagSvg = $("sd-diag"), caixa = document.createElement("div"); caixa.className = "sd-diag-caixa";
  diagSvg.parentNode.insertBefore(caixa, diagSvg); caixa.appendChild(diagSvg); caixa.appendChild(tip);
  function textoDica(el){
    if (!ultimo) return "";
    const lin = (cor, t) => `<div class="sd-tip-l">${cor ? `<i style="background:${cor}"></i>` : ""}${t}</div>`;
    if (el.dataset.m !== undefined){
      const l = ultimo.diag && ultimo.diag[+el.dataset.m]; if (!l) return "";
      return `<b>Média – ${esc(l.s.rot)}</b>` + lin(l.s.cor, `${l.n} ${l.n === 1 ? "ponto" : "pontos"}`) +
        lin("", `Ciclagem: ${f2.format(l.c)}`) + lin("", `Armazenamento: ${f2.format(l.a)}`) + lin(CORES[l.k], `Saúde do Solo: ${SAUDE[l.k]}`);
    }
    const s = ultimo.Ss[+el.dataset.s], v = s && s.vals[+el.dataset.v]; if (!v) return "";
    const c = col => col >= 0 ? txt(v.l.v[col]) : "";
    const tit = [c(S.cTal) && `Talhão ${c(S.cTal)}`, c(S.cPto) && `Ponto ${c(S.cPto)}`].filter(Boolean).join(" · ") || "Ponto";
    return `<b>${esc(tit)}</b>` +
      [["Cliente",S.cCli],["Fazenda",S.cFaz],["Município",S.cMun]].filter(([,col]) => c(col)).map(([n,col]) => lin("", `${n}: ${esc(c(col))}`)).join("") +
      lin(s.cor, `${esc(c(S.cPad) || "Padrão")} · ${NOME_AM[s.am]}`) +
      lin("", `Ciclagem: ${f2.format(v.cic)}`) + lin("", `Armazenamento: ${f2.format(v.arm)}`) +
      (v.sup !== null ? lin("", `Suprimento: ${f2.format(v.sup)}`) : "") + (v.iqs !== null ? lin("", `IQS Fertbio: ${f2.format(v.iqs)}`) : "") +
      lin(CORES[v.saude], `Saúde do Solo: ${SAUDE[v.saude]}`);
  }
  function mostrarDica(e){
    const el = e.target.closest && e.target.closest(".sd-pt");
    if (!el){ tip.hidden = true; return; }
    const html = textoDica(el); if (!html){ tip.hidden = true; return; }
    tip.innerHTML = html; tip.hidden = false;
    const r = caixa.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    tip.style.left = Math.max(0, Math.min(x + 14, r.width - w)) + "px";
    tip.style.top = Math.max(0, y - hh - 12 < 0 ? y + 16 : y - hh - 12) + "px";
  }
  diagSvg.addEventListener("pointermove", mostrarDica);
  diagSvg.addEventListener("click", mostrarDica);
  diagSvg.addEventListener("pointerleave", () => { tip.hidden = true; });

  /* 2. Pizzas com os nossos pontos */
  function pizza(itens, tam){
    const t = soma(itens.map(x => x[1])); if (!t) return `<svg viewBox="0 0 120 120" style="width:${tam}px;height:${tam}px"><circle cx="60" cy="60" r="56" fill="none" stroke="#D9DED6" stroke-dasharray="4 3"/></svg>`;
    let ang = -Math.PI / 2, f = "";
    itens.forEach(([n,v,c]) => {
      if (!v) return; const a = 2 * Math.PI * v / t;
      if (a >= 2 * Math.PI - 1e-6){ f += `<circle cx="60" cy="60" r="56" fill="${c}"><title>${n}: 100%</title></circle>`; ang += a; return; }
      const p = q => `${(60 + 56 * Math.cos(q)).toFixed(2)} ${(60 + 56 * Math.sin(q)).toFixed(2)}`;
      f += `<path d="M60 60 L${p(ang)} A56 56 0 ${a > Math.PI ? 1 : 0} 1 ${p(ang + a)} Z" fill="${c}" stroke="#fff" stroke-width="1.5"><title>${n}: ${pct(v, t)}</title></path>`; ang += a;
    });
    return `<svg viewBox="0 0 120 120" style="width:${tam}px;height:${tam}px">${f}</svg>`;
  }
  function cartaoPizza(tit, nomes, cores, porSerie, Ss){
    const tam = Ss.length > 2 ? 78 : Ss.length === 2 ? 104 : 150, D = Ss.map(porSerie), varias = Ss.length > 1;
    const umPadrao = new Set(Ss.map(s => s.pd)).size === 1;
    const cab = varias ? Ss.map(s => `<th class="n">${umPadrao ? s.am.toUpperCase() : esc(s.pd) + (amostras().length > 1 ? "<br>" + s.am.toUpperCase() : "")}</th>`).join("") : "<th></th>";
    const linhas = nomes.map((n,i) => D.some(d => d[i]) ? `<tr><td><i style="background:${cores[i]}"></i>${n}</td>${D.map(d => `<td class="n"><b>${pct(d[i], soma(d))}</b></td>`).join("")}</tr>` : "").join("");
    return `<div class="cartao sd-card sd-pz"><div class="cartao-topo"><h2>${tit}</h2>${btnImg(false)}</div>
      <div class="sd-pz-lin">${Ss.map((s,j) => `<div class="sd-pz-col">${pizza(nomes.map((n,i) => [n, D[j][i], cores[i]]), tam)}${varias ? `<span>${esc(s.rot)}</span>` : ""}</div>`).join("")}</div>
      <table class="sd-pz-tab"><thead><tr><th></th>${cab}</tr></thead><tbody>${linhas || `<tr><td colspan="${Ss.length + 1}">Sem dados</td></tr>`}</tbody></table>
      <small>${Ss.map(s => soma(porSerie(s))).join(" / ")} pontos</small></div>`;
  }
  function desenharPizzas(){
    const {Ss} = ultimo;
    $("sd-pizzas").innerHTML =
      cartaoPizza("Saúde do Solo", SAUDE, CORES, s => contar(s.vals, v => v.saude), Ss) +
      cartaoPizza("Textura do solo", TEXTURAS, TEXTURAS.map(t => COR_TEX[t]), s => { const d = [0,0,0,0]; s.vals.forEach(v => { if (v.arg !== null) d[TEXTURAS.indexOf(textura(v.arg))]++; }); return d; }, Ss) +
      ["cic","arm","sup"].map(k => cartaoPizza(NOME_IND[k], CLASSES, CORES, s => contar(comValor(s.vals, k), v => classe(v[k])), Ss)).join("");
    const am = modo === "ambas" ? "Área homogênea e Reboleira lado a lado" : NOME_AM[modo];
    $("sd-pz-nota").textContent = `Pontos amostrais filtrados acima (${$("sd-padrao").value || "todos os padrões"}; ${am}). Cada ponto é classificado individualmente; Saúde do Solo pelo diagrama Ciclagem × Armazenamento; textura pela argila do ponto.`;
  }

  /* 3. Mapa (Leaflet, carregado só quando a guia é aberta) */
  let mapa = null, camada = null, carregandoMapa = null;
  function carregarLeaflet(){
    if (window.L) return Promise.resolve();
    if (carregandoMapa) return carregandoMapa;
    carregandoMapa = new Promise((ok, erro) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
      const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; js.onload = ok; js.onerror = () => { carregandoMapa = null; erro(); }; document.head.appendChild(js);
    });
    return carregandoMapa;
  }
  function desenharMapa(){
    P.querySelectorAll("#sd-mapa-ind button").forEach(b => b.setAttribute("aria-checked", b.dataset.i === indMapa));
    const nota = $("sd-mapa-nota"), box = $("sd-mapa"), {linhas} = ultimo;
    const ams = amostras(), nomes = indMapa === "saude" ? SAUDE : CLASSES;
    const pts = S.cLat >= 0 && S.cLon >= 0 ? linhas.map(l => ({l, lat:numCoord(l.v[S.cLat]), lon:numCoord(l.v[S.cLon])}))
      .filter(p => p.lat !== null && p.lon !== null && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && !(p.lat === 0 && p.lon === 0)) : [];
    const semCoord = linhas.length - pts.length;
    nota.innerHTML = (ams.length > 1 ? "<b>Ambas:</b> cada ponto é um círculo dividido – metade esquerda = Área homogênea, metade direita = Reboleira. " : "") +
      `Cor pela classe (${nomes[0]} → ${nomes[4]}). Clique no ponto para ver os valores.` + (semCoord ? ` ${semCoord} ${semCoord === 1 ? "ponto sem" : "pontos sem"} Latitude/Longitude ${semCoord === 1 ? "ficou" : "ficaram"} fora do mapa.` : "");
    if (!pts.length){ if (mapa){ mapa.remove(); mapa = null; } box.innerHTML = `<div class="sd-mapa-vazio">Sem coordenadas nos pontos filtrados. Preencha as colunas Latitude e Longitude na guia Dados (em graus decimais, ex.: -12,5512 e -55,7123).</div>`; return; }
    if (P.hidden) return;   /* desenha quando a guia ficar visível */
    carregarLeaflet().then(() => {
      if (!mapa){ box.innerHTML = "";
        mapa = L.map(box, {scrollWheelZoom:false});
        const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:19, crossOrigin:"anonymous", attribution:"Imagens © Esri"});
        const ruas = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, crossOrigin:"anonymous", attribution:"© OpenStreetMap"});
        sat.addTo(mapa); L.control.layers({"Satélite":sat, "Mapa":ruas}, null, {position:"topright"}).addTo(mapa);
      }
      if (camada) camada.remove();
      camada = L.featureGroup().addTo(mapa);
      const k = v => v === null ? null : indMapa === "saude" ? v.saude : (v[indMapa] === null ? null : classe(v[indMapa]));
      const cor = c => c === null ? "#BBBBBB" : CORES[c];
      pts.forEach(p => {
        const vs = ams.map(am => ponto(p.l, am)), ks = vs.map(k);
        const svg = ams.length > 1
          ? `<svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2 A8 8 0 0 0 10 18 Z" fill="${cor(ks[0])}"/><path d="M10 2 A8 8 0 0 1 10 18 Z" fill="${cor(ks[1])}"/><circle cx="10" cy="10" r="8" fill="none" stroke="#1F3D2B" stroke-width="1.5"/><line x1="10" y1="2" x2="10" y2="18" stroke="#1F3D2B" stroke-width="1"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="${cor(ks[0])}" stroke="#1F3D2B" stroke-width="1.5"/></svg>`;
        const ic = L.divIcon({html:svg, className:"sd-marca", iconSize:ams.length > 1 ? [20,20] : [18,18]});
        const id = [["Talhão",S.cTal],["Padrão",S.cPad],["Ponto",S.cPto],["Fazenda",S.cFaz]].filter(([,c]) => c >= 0).map(([n,c]) => `<b>${n}:</b> ${esc(txt(p.l.v[c]))}`).join("<br>");
        const val = ams.map((am,j) => { const v = vs[j]; return `<b>${NOME_AM[am]}</b><br>` + ["iqs","cic","arm","sup"].map(x => `${NOME_IND[x]}: ${v[x] === null ? "–" : f2.format(v[x])}`).join("<br>") + `<br>Saúde do Solo: ${v.saude === null ? "–" : SAUDE[v.saude]}`; }).join("<hr>");
        L.marker([p.lat, p.lon], {icon:ic}).bindPopup(`<div class="sd-pop">${id}<hr>${val}</div>`).addTo(camada);
      });
      mapa.invalidateSize();
      mapa.fitBounds(camada.getBounds().pad(0.25), {maxZoom:16});
    }).catch(() => { box.innerHTML = '<div class="sd-mapa-vazio">Não foi possível carregar o mapa. Verifique a conexão com a internet.</div>'; mapa = null; });
  }
  P.querySelectorAll("#sd-mapa-ind button").forEach(b => b.addEventListener("click", () => { indMapa = b.dataset.i; if (ultimo) desenharMapa(); }));
  new MutationObserver(() => { if (!P.hidden && ultimo){ if (mapa) setTimeout(() => { mapa.invalidateSize(); }, 50); desenharMapa(); } }).observe(P, {attributes:true, attributeFilter:["hidden"]});

  /* 4. Tabela por talhão e padrão */
  function grupos(linhas){
    const g = new Map();
    linhas.forEach(l => { const k = [S.cCli, S.cTal, S.cPad].map(c => c >= 0 ? txt(l.v[c]) : "").join("|"); if (!g.has(k)) g.set(k, []); g.get(k).push(l); });
    return [...g.values()];
  }
  const COLS_T = [["arg","Argila (%)"],["tex","Textura"],["iqs","IQS Fertbio"],["cic","Ciclagem"],["arm","Armazenamento"],["sup","Suprimento"],["saude","Saúde do Solo"],["pc_cic","Percentil Ciclagem"],["pc_arm","Percentil Armaz."],["pc_sup","Percentil Supr."]];
  function linhasTabela(){
    const {linhas, ref} = ultimo, ams = amostras();
    const meta = [["Estado",S.cEst],["Cliente",S.cCli],["Fazenda",S.cFaz],["Talhão",S.cTal],["Padrão",S.cPad],["Município",S.cMun]].filter(([,c]) => c >= 0);
    const rows = grupos(linhas).map(g => {
      const M = {};
      ams.forEach(am => {
        const vs = g.map(l => ponto(l, am)), m = {};
        ["iqs","cic","arm","sup","arg"].forEach(k => m[k] = mediaDe(vs, k));
        m.tex = m.arg === null ? null : textura(m.arg);
        m.saude = m.cic !== null && m.arm !== null ? saudeSolo(m.cic, m.arm) : null;
        ["cic","arm","sup"].forEach(k => m["pc_" + k] = percentil(m[k], ref[k]));
        M[am] = m;
      });
      return {meta:meta.map(([,c]) => txt(g[0].v[c])), n:g.length, M};
    });
    return {meta:meta.map(([n]) => n), rows, ams};
  }
  function desenharTabela(){
    const {meta, rows, ams} = linhasTabela(), dois = ams.length > 1, rs = dois ? ' rowspan="2"' : "";
    const iTal = meta.indexOf("Talhão"), limFixa = iTal >= 0 ? iTal : meta.length - 1;
    const fx = k => k <= limFixa ? ` class="fixa${k === limFixa ? " ultfixa" : ""}" data-fixa="${k}"` : "";
    let h = "<thead><tr>"; meta.forEach((n,k) => h += `<th${fx(k)}${rs}>${n}</th>`); h += `<th class="n"${rs}>Pontos</th>`;
    COLS_T.forEach(([k,n]) => h += dois ? `<th colspan="2" class="grp sep">${n}</th>` : `<th class="${k === "tex" || k === "saude" ? "" : "n "}sep">${n}</th>`);
    h += "</tr>"; if (dois) h += '<tr class="sub">' + COLS_T.map(() => '<th class="sep">AH</th><th>R</th>').join("") + "</tr>";
    h += "</thead><tbody>";
    rows.forEach(r => {
      h += "<tr>"; r.meta.forEach((v,k) => h += `<td${fx(k)}>${esc(v)}</td>`); h += `<td class="n">${r.n}</td>`;
      COLS_T.forEach(([k]) => ams.forEach((am,j) => {
        const v = r.M[am][k], sep = j === 0 ? " sep" : "";
        if (k === "arg") h += `<td class="n${sep}">${v === null ? "–" : f0.format(Math.round(v))}</td>`;
        else if (k === "tex") h += `<td class="${sep.trim()}">${v || "–"}</td>`;
        else if (k === "saude") h += `<td class="${sep.trim()}">${chip(v, SAUDE)}</td>`;
        else if (k.startsWith("pc_")) h += `<td class="n${sep}">${v === null ? "–" : `<span class="sd-pcbar" style="background:linear-gradient(90deg,#2C5540 ${v}%,#E8EBE5 ${v}%)"></span>${v}º`}</td>`;
        else h += v === null ? `<td class="n${sep}">–</td>` : `<td class="n${sep}" style="background:${CORES[classe(v)]};color:#1B2620" title="Classe: ${CLASSES[classe(v)]}">${f2.format(v)}</td>`;
      }));
      h += "</tr>";
    });
    $("sd-tab").innerHTML = h + "</tbody>";
    $("sd-tit-tab").textContent = `4. Médias por talhão e padrão (${dois ? "Área homogênea e Reboleira" : NOME_AM[ams[0]]})`;
  }

  /* ---------- Exportação ---------- */
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
  const slug = t => semAcento(t).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
  const hoje = () => new Date().toISOString().slice(0,10);
  const textoFiltros = () => ["Estado","Cliente","Talhão","Padrão"].map((n,k) => `${n}: ${$(IDS[k]).value || "Todos"}`).join(" · ") +
    ` · Amostra: ${modo === "ambas" ? "Área homogênea e Reboleira" : NOME_AM[modo]} · Referência Embrapa: ${ultimo ? ultimo.ref.nome : ""}`;
  let h2c = null;
  function carregarH2C(){
    if (window.html2canvas) return Promise.resolve();
    if (h2c) return h2c;
    h2c = new Promise((ok, erro) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; s.onload = ok; s.onerror = () => { h2c = null; erro(); }; document.head.appendChild(s); });
    return h2c;
  }
  function rodape(){
    const d = document.createElement("div"); d.className = "sd-img-rodape";
    d.innerHTML = `${esc(textoFiltros())}<br>Fonte da referência: Embrapa – Plataforma Saúde do Solo (consulta de ${ultimo ? new Date(ultimo.ref.consulta + "T12:00").toLocaleDateString("pt-BR") : ""}) · Resultados VNS – Grower Consultoria Agronômica · ${new Date().toLocaleDateString("pt-BR")}`;
    return d;
  }
  async function imagem(el, nome, larguraMin){
    try { await carregarH2C(); } catch(e){ return avisar("Não foi possível carregar o gerador de imagem. Verifique a conexão.", true); }
    const rod = rodape(); el.appendChild(rod);
    const larg = el.style.width; if (larguraMin && el.offsetWidth < larguraMin) el.style.width = larguraMin + "px";
    try {
      const fundo = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#FFFFFF";
      const cv = await html2canvas(el, {scale:2, backgroundColor:fundo, useCORS:true, logging:false, ignoreElements: x => x.classList && (x.classList.contains("exp") || x.classList.contains("sd-tip") || x.classList.contains("leaflet-control-container"))});
      const blob = await new Promise(r => cv.toBlob(r, "image/png"));
      if (blob) await salvar(nome, blob); else avisar("Não foi possível gerar a imagem.", true);
    } catch(e){ avisar("Não foi possível gerar a imagem" + (el.querySelector(".leaflet-container") ? " do mapa (o fundo bloqueou a cópia). Tente a camada “Mapa”." : "."), true); }
    finally { rod.remove(); el.style.width = larg; }
  }
  async function ocupado(btn, fn){ btn.classList.add("ocupado"); try{ await fn(); } finally { btn.classList.remove("ocupado"); } }
  P.addEventListener("click", e => {
    const b = e.target.closest("button[data-sdimg]"); if (!b || !ultimo) return;
    const card = b.closest(".cartao"); const tit = card.querySelector("h2").textContent;
    ocupado(b, () => imagem(card, `saude_do_solo_${slug(tit)}_${hoje()}.png`, card.classList.contains("sd-pz") ? 440 : 0));
  });
  $("sd-tab-img").addEventListener("click", e => {
    if (!ultimo) return;
    ocupado(e.currentTarget, async () => {
      const box = document.createElement("div"); box.className = "sd-img-tab cartao";
      box.innerHTML = `<h2>${esc($("sd-tit-tab").textContent.replace(/^4\.\s*/, ""))}</h2>`;
      const t = $("sd-tab").cloneNode(true); t.removeAttribute("id"); t.querySelectorAll(".fixa").forEach(x => { x.style.position = "static"; }); box.appendChild(t);
      box.insertAdjacentHTML("beforeend", '<p class="nota" style="margin-top:8px">Percentil = posição do valor entre as amostras da Embrapa do recorte (50 = mediana).</p>');
      document.body.appendChild(box);
      try { await imagem(box, `saude_do_solo_medias_talhao_padrao_${hoje()}.png`); } finally { box.remove(); }
    });
  });
  $("sd-tab-xls").addEventListener("click", e => {
    if (!ultimo) return;
    if (typeof XLSX === "undefined") return avisar("A biblioteca do Excel não carregou. Recarregue a página.", true);
    ocupado(e.currentTarget, async () => {
      const {meta, rows, ams} = linhasTabela(), suf = am => ams.length > 1 ? " " + am.toUpperCase() : "";
      const cab = [...meta, "Pontos"]; COLS_T.forEach(([,n]) => ams.forEach(am => cab.push(n.replace("Armaz.", "Armazenamento").replace("Supr.", "Suprimento") + suf(am))));
      const aoa = [cab, ...rows.map(r => { const row = [...r.meta, r.n];
        COLS_T.forEach(([k]) => ams.forEach(am => { const v = r.M[am][k];
          row.push(v === null ? null : k === "arg" ? Math.round(v) : k === "saude" ? SAUDE[v] : k === "tex" || k.startsWith("pc_") ? v : r2(v)); }));
        return row; })];
      const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = cab.map(c => ({wch: Math.max(9, String(c).length + 2)}));
      XLSX.utils.book_append_sheet(wb, ws, "Médias");
      const info = [["Resultados VNS – Saúde do Solo (Embrapa)"], [], ...textoFiltros().split(" · ").map(t => { const i = t.indexOf(": "); return [t.slice(0, i), t.slice(i + 2)]; }), [],
        ["Classes dos índices (0 a 1)", "até 0,20 Muito baixo; até 0,40 Baixo; até 0,60 Médio; até 0,80 Elevado; acima de 0,80 Muito elevado. Valor arredondado em 2 casas; o limite fica na classe de baixo."],
        ["Saúde do Solo", "Diagrama Embrapa Ciclagem × Armazenamento aplicado às médias; ponto sobre a linha fica na classe pior."],
        ["Textura", "Pela argila média (agrupamento SiBCS simplificado): < 15% Arenosa; até 35% Média; até 60% Argilosa; acima Muito argilosa."],
        ["Percentil", "Posição da média entre as amostras da Embrapa do recorte (aproximação pelas contagens por classe)."],
        ["Fonte da referência", `Embrapa – Plataforma Saúde do Solo (saudedosolo.embrapa.gov.br/plataforma-publica), consulta de ${new Date(ultimo.ref.consulta + "T12:00").toLocaleDateString("pt-BR")}`],
        ["Gerado em", new Date().toLocaleDateString("pt-BR")]];
      const wi = XLSX.utils.aoa_to_sheet(info); wi["!cols"] = [{wch:28}, {wch:110}];
      XLSX.utils.book_append_sheet(wb, wi, "Filtros e notas");
      await salvar(`saude_do_solo_medias_talhao_padrao_${hoje()}.xlsx`, new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]));
    });
  });

  document.addEventListener("dados-atualizados", e => { dados = e.detail; montarFiltros(); render(); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (ultimo) desenharDiagrama(); });
  new MutationObserver(() => { if (ultimo) desenharDiagrama(); }).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});
  montarFiltros(); render();
  if (location.hash === "#saude") $("guia-saude").click();
})();

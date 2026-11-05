(function(){
  const VAZIO = "\u0000vazio";
  const $ = id => document.getElementById(id);
  const st = { arquivo:"", abas:[], aba:"", cab:[], linhas:[], filtros:new Map(), ordem:null, ids:null,
              editadas:new Set(), novas:new Set(), excluidas:[], celEd:new Set(), sel:null };
  let proxUid = 1, podeEditar = true;
  const fmtNum = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:6});

  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const chave = v => (v === null || v === undefined || v === "") ? VAZIO : (v instanceof Date ? "d" + v.getTime() : (typeof v)[0] + String(v));
  function fmt(v){
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number") return fmtNum.format(v);
    if (v instanceof Date) return v.toLocaleDateString("pt-BR");
    if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
    return String(v);
  }
  function compara(a,b){
    const va = a === null || a === undefined || a === "", vb = b === null || b === undefined || b === "";
    if (va || vb) return va === vb ? 0 : (va ? 1 : -1);
    const na = typeof a === "number" || a instanceof Date, nb = typeof b === "number" || b instanceof Date;
    if (na && nb) return +a - +b;
    if (na !== nb) return na ? -1 : 1;
    return String(a).localeCompare(String(b), "pt-BR", {numeric:true, sensitivity:"base"});
  }

  function aviso(msg, erro){
    const a = $("aviso"); a.textContent = msg; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => a.hidden = true, 3200);
  }

  function carregarAbas(abas, nome, ids){
    st.arquivo = nome; st.abas = abas; st.ids = ids || null;
    const sel = $("sel-aba");
    sel.innerHTML = abas.map((a,i) => `<option value="${i}">${esc(a.name)}</option>`).join("");
    sel.hidden = abas.length < 2;
    usarAba(0);
  }
  function usarAba(i){
    const a = st.abas[i]; st.aba = a.name;
    const aoa = a.aoa;
    const larg = aoa.reduce((m,r) => Math.max(m, r.length), 0);
    st.cab = Array.from({length:larg}, (_,j) => {
      const h = aoa[0] ? aoa[0][j] : null;
      return (h === null || h === undefined || h === "") ? `Coluna ${j+1}` : fmt(h);
    });
    st.linhas = aoa.slice(1).map((r,k) => ({n:k+2, uid:proxUid++, dbId:(i === 0 && st.ids) ? st.ids[k] : null, v:Array.from({length:larg}, (_,j) => r[j] === undefined ? null : r[j])}));
    st.editadas = new Set(); st.novas = new Set(); st.excluidas = []; st.celEd = new Set(); st.sel = null;
    /* Colunas da Safra 26/27: aparecem vazias se a planilha ainda não as tiver */
    const normCab = t => String(t).replace(/\s+/g, " ").trim().toLowerCase();
    ["Produtividade Safra 26/27", "PMG 26/27"].forEach(nome => {
      if (!st.cab.some(h => normCab(h) === normCab(nome))){ st.cab.push(nome); st.linhas.forEach(l => l.v.push(null)); }
    });
    st.filtros = new Map(); st.ordem = null;
    $("nome-arquivo").textContent = st.arquivo;
    $("nome-arquivo").title = st.arquivo;
    $("info-arquivo").textContent = `Aba “${st.aba}”, ${st.linhas.length} linhas e ${larg} colunas` + (podeEditar ? ". Clique duas vezes numa célula para editar." : "");
    fecharMenu();
    desenhar();
    window.__dadosVNS = {cab:st.cab, linhas:st.linhas};
    document.dispatchEvent(new CustomEvent("dados-atualizados", {detail:window.__dadosVNS}));
    document.dispatchEvent(new CustomEvent("dados-editados"));
  }

  function visiveis(ignorar){
    const fs = [...st.filtros].filter(([c]) => c !== ignorar);
    let r = st.linhas.filter(l => fs.every(([c,s]) => s.has(chave(l.v[c]))));
    return r;
  }

  function desenhar(){
    const tab = $("tabela");
    const tem = st.cab.length > 0;
    $("vazio").hidden = tem;
    if (!tem){ tab.innerHTML = ""; $("contagem").textContent = ""; $("limpar").disabled = true; return; }
    let r = visiveis(-1);
    if (st.ordem){ const {col,dir} = st.ordem; r = r.slice().sort((a,b) => compara(a.v[col], b.v[col]) * (dir === "asc" ? 1 : -1)); }
    const icoF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v5l-4 2v-7z"/></svg>';
    const icoS = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d==="asc"?'<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>':'<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>'}</svg>`;
    let h = '<thead><tr><th class="num" scope="col"><span class="oculto">Linha</span></th>';
    st.cab.forEach((c,j) => {
      const on = st.filtros.has(j) || (st.ordem && st.ordem.col === j);
      const ico = st.filtros.has(j) ? icoF : (st.ordem && st.ordem.col === j ? icoS(st.ordem.dir) : icoF);
      h += `<th scope="col"><div class="th-in"><span class="th-txt">${esc(c)}</span><button class="filtro${on?" on":""}" data-col="${j}" aria-label="Filtrar ${esc(c)}">${ico}</button></div></th>`;
    });
    h += "</tr></thead><tbody>";
    const partes = [h];
    for (const l of r){
      const nova = st.novas.has(l.uid);
      let s = `<tr data-u="${l.uid}"${st.sel === l.uid ? ' class="sel"' : ""}><td class="num${nova ? " nova" : ""}" title="${podeEditar ? "Clique para selecionar a linha" : ""}">${nova ? "nova" : l.n}</td>`;
      l.v.forEach((v,j) => {
        const cls = (typeof v === "number" ? "n" : "") + (st.celEd.has(l.uid + ":" + j) ? " ed" : "");
        s += `<td data-c="${j}"${cls.trim() ? ` class="${cls.trim()}"` : ""}>${esc(fmt(v))}</td>`;
      });
      partes.push(s + "</tr>");
    }
    partes.push("</tbody>");
    tab.innerHTML = partes.join("");
    $("contagem").innerHTML = `Mostrando <strong>${r.length}</strong> de ${st.linhas.length} linhas`;
    $("limpar").disabled = st.filtros.size === 0 && !st.ordem;
    $("btn-del-linha").disabled = !st.sel || !st.linhas.some(l => l.uid === st.sel);
  }

  /* ---------- Edição das células ---------- */
  const paraTexto = v => v === null || v === undefined ? "" : (typeof v === "number" ? String(v).replace(".", ",") : (v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v)));
  function lerTexto(t){
    t = String(t).trim();
    if (t === "") return null;
    if (/^-?\d+(,\d+)?$/.test(t)) return parseFloat(t.replace(",", "."));
    if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t)) return parseFloat(t.replace(/\./g, "").replace(",", "."));
    if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
    return t;
  }
  const linhaPorUid = uid => st.linhas.find(l => l.uid === uid);
  function notificar(){
    desenhar();
    window.__dadosVNS = {cab:st.cab, linhas:st.linhas, edicao:true};
    document.dispatchEvent(new CustomEvent("dados-atualizados", {detail:window.__dadosVNS}));
    document.dispatchEvent(new CustomEvent("dados-editados"));
  }
  function editar(td){
    if (!podeEditar || !td || td.querySelector("input")) return;
    const uid = +td.parentElement.dataset.u, c = +td.dataset.c, l = linhaPorUid(uid); if (!l) return;
    const inp = document.createElement("input");
    inp.className = "cel-in"; inp.value = paraTexto(l.v[c]); inp.setAttribute("aria-label", "Editar " + st.cab[c]);
    td.classList.add("editando"); td.textContent = ""; td.appendChild(inp); inp.focus(); inp.select();
    let feito = false;
    const fim = (salvar, prox) => {
      if (feito) return; feito = true;
      if (salvar){
        const novo = lerTexto(inp.value), velho = l.v[c];
        const igual = (novo === null && (velho === null || velho === undefined || velho === "")) || (velho instanceof Date ? paraTexto(velho) === inp.value.trim() : novo === velho);
        if (!igual){
          l.v[c] = novo; st.celEd.add(uid + ":" + c);
          if (!st.novas.has(uid) && l.dbId) st.editadas.add(uid);
          notificar();
        } else desenhar();
      } else desenhar();
      if (prox !== undefined){
        const alvo = $("tabela").querySelector(`tr[data-u="${uid}"] td[data-c="${prox}"]`);
        if (alvo){ alvo.scrollIntoView({block:"nearest", inline:"nearest"}); editar(alvo); }
      }
    };
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); fim(true); }
      else if (e.key === "Escape"){ e.preventDefault(); fim(false); }
      else if (e.key === "Tab"){ e.preventDefault(); const p = c + (e.shiftKey ? -1 : 1); fim(true, p >= 0 && p < st.cab.length ? p : undefined); }
    });
    inp.addEventListener("blur", () => fim(true));
  }
  $("tabela").addEventListener("dblclick", e => { const td = e.target.closest("td[data-c]"); if (td) editar(td); });
  $("tabela").addEventListener("click", e => {
    const td = e.target.closest("td.num"); if (!td || !podeEditar) return;
    const uid = +td.parentElement.dataset.u; st.sel = st.sel === uid ? null : uid; desenhar();
  });
  /* Adicionar linha: copia Estado, Cliente, Fazenda, Talhão e Padrão da linha selecionada (se houver) */
  $("btn-add-linha").addEventListener("click", () => {
    if (!st.cab.length) return aviso("Carregue uma base antes de adicionar linhas.", true);
    const base = st.sel ? linhaPorUid(st.sel) : null;
    const v = st.cab.map(() => null);
    if (base) st.cab.forEach((h,j) => { if (/estado|cliente|fazenda|talh|padr/i.test(h)) v[j] = base.v[j]; });
    const l = {n:"nova", uid:proxUid++, dbId:null, v};
    st.linhas.push(l); st.novas.add(l.uid); st.sel = l.uid;
    st.filtros.clear(); st.ordem = null;
    notificar();
    const g = $("grade"); g.scrollTop = g.scrollHeight;
    const jPonto = st.cab.findIndex(h => /^\s*ponto/i.test(h)), jV = jPonto >= 0 ? jPonto : st.cab.findIndex((h,j) => v[j] === null);
    const td = $("tabela").querySelector(`tr[data-u="${l.uid}"] td[data-c="${Math.max(0, jV)}"]`);
    if (td){ td.scrollIntoView({block:"nearest", inline:"center"}); editar(td); }
  });
  $("btn-del-linha").addEventListener("click", () => {
    const l = st.sel ? linhaPorUid(st.sel) : null; if (!l) return;
    const desc = st.cab.map((h,j) => /cliente|talh|ponto|padr/i.test(h) && l.v[j] !== null ? fmt(l.v[j]) : null).filter(Boolean).join(" · ");
    if (!confirm(`Excluir a linha ${l.n}${desc ? " (" + desc + ")" : ""}?`)) return;
    st.linhas = st.linhas.filter(x => x !== l);
    if (l.dbId) st.excluidas.push(l.dbId);
    st.novas.delete(l.uid); st.editadas.delete(l.uid); st.sel = null;
    notificar();
  });

  /* Menu de filtro */
  let mCol = -1, mSel = null, mValores = [], mOrdem = null;
  function abrirMenu(col, btn){
    mCol = col;
    const base = visiveis(col);
    const cont = new Map();
    for (const l of base){ const v = l.v[col], k = chave(v); if (!cont.has(k)) cont.set(k, {k, v, n:0}); cont.get(k).n++; }
    mValores = [...cont.values()].sort((a,b) => compara(a.v,b.v));
    mSel = new Set(st.filtros.has(col) ? [...st.filtros.get(col)].filter(k => cont.has(k)) : mValores.map(x => x.k));
    mOrdem = st.ordem && st.ordem.col === col ? st.ordem.dir : null;
    $("menu-titulo").textContent = st.cab[col];
    $("menu-busca").value = "";
    document.querySelectorAll(".ordem button").forEach(b => b.classList.toggle("ativo", b.dataset.ordem === mOrdem));
    listar();
    const m = $("menu"); m.hidden = false;
    const rc = btn.getBoundingClientRect(), w = m.offsetWidth, hgt = m.offsetHeight;
    let left = Math.min(rc.right - w, window.innerWidth - w - 8); left = Math.max(8, left);
    let top = rc.bottom + 6; if (top + hgt > window.innerHeight - 8) top = Math.max(8, window.innerHeight - hgt - 8);
    m.style.left = left + "px"; m.style.top = top + "px";
    $("menu-busca").focus({preventScroll:true});
  }
  function filtrados(){
    const q = $("menu-busca").value.trim().toLowerCase();
    return mValores.filter(x => !q || (x.k === VAZIO ? "(vazias)" : fmt(x.v)).toLowerCase().includes(q));
  }
  function atualizarTodos(){
    const t = $("m-todos"); if (!t) return;
    const lst = filtrados();
    const todos = lst.every(x => mSel.has(x.k));
    t.checked = todos; t.indeterminate = !todos && lst.some(x => mSel.has(x.k));
  }
  function listar(){
    const q = $("menu-busca").value.trim().toLowerCase();
    const lst = filtrados();
    const todos = lst.length > 0 && lst.every(x => mSel.has(x.k));
    let h = `<label class="todos"><input type="checkbox" id="m-todos"${todos?" checked":""}> ${q ? "Selecionar resultados" : "Selecionar tudo"}</label>`;
    h += lst.map((x,i) => `<label><input type="checkbox" data-i="${mValores.indexOf(x)}"${mSel.has(x.k)?" checked":""}> <span>${x.k === VAZIO ? "(Vazias)" : esc(fmt(x.v))}</span><span class="qtd">${x.n}</span></label>`).join("");
    if (!lst.length) h = '<p style="padding:8px;color:var(--muted);margin:0">Nenhum valor encontrado.</p>';
    $("menu-lista").innerHTML = h;
    const t = $("m-todos");
    if (t){
      t.indeterminate = !todos && lst.some(x => mSel.has(x.k));
      t.onchange = () => { lst.forEach(x => t.checked ? mSel.add(x.k) : mSel.delete(x.k)); listar(); };
    }
  }
  $("menu-lista").addEventListener("change", e => {
    const i = e.target.dataset.i; if (i === undefined) return;
    const k = mValores[+i].k; e.target.checked ? mSel.add(k) : mSel.delete(k);
    atualizarTodos();
  });
  $("menu-busca").addEventListener("input", listar);
  $("menu-busca").addEventListener("keydown", e => { if (e.key === "Enter") aplicar(); });
  document.querySelectorAll(".ordem button").forEach(b => b.addEventListener("click", () => {
    mOrdem = mOrdem === b.dataset.ordem ? null : b.dataset.ordem;
    document.querySelectorAll(".ordem button").forEach(x => x.classList.toggle("ativo", x.dataset.ordem === mOrdem));
  }));
  function aplicar(){
    const q = $("menu-busca").value.trim().toLowerCase();
    let sel = mSel;
    if (q){ // com busca ativa, mantém só os itens visíveis marcados
      const vis = new Set(mValores.filter(x => (x.k === VAZIO ? "(vazias)" : fmt(x.v)).toLowerCase().includes(q)).map(x => x.k));
      sel = new Set([...mSel].filter(k => vis.has(k)));
    }
    if (sel.size === 0){ aviso("Marque ao menos um valor para aplicar o filtro.", true); return; }
    if (sel.size === mValores.length) st.filtros.delete(mCol); else st.filtros.set(mCol, sel);
    if (mOrdem) st.ordem = {col:mCol, dir:mOrdem}; else if (st.ordem && st.ordem.col === mCol) st.ordem = null;
    fecharMenu(); desenhar();
  }
  $("menu-aplicar").addEventListener("click", aplicar);
  $("menu-limpar").addEventListener("click", () => {
    st.filtros.delete(mCol); if (st.ordem && st.ordem.col === mCol) st.ordem = null;
    fecharMenu(); desenhar();
  });
  function fecharMenu(){ $("menu").hidden = true; mCol = -1; }
  $("tabela").addEventListener("click", e => {
    const b = e.target.closest(".filtro"); if (!b) return;
    e.stopPropagation();
    const c = +b.dataset.col;
    if (!$("menu").hidden && mCol === c){ fecharMenu(); return; }
    abrirMenu(c, b);
  });
  document.addEventListener("mousedown", e => { if (!$("menu").hidden && !e.target.closest("#menu") && !e.target.closest(".filtro")) fecharMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharMenu(); });
  $("grade").addEventListener("scroll", fecharMenu, {passive:true});
  window.addEventListener("resize", fecharMenu);

  $("limpar").addEventListener("click", () => { st.filtros.clear(); st.ordem = null; desenhar(); aviso("Filtros limpos."); });
  $("sel-aba").addEventListener("change", e => usarAba(+e.target.value));

  /* Exportação da tabela (linhas visíveis, na ordem da tela) */
  const dlDados = (window.claude && typeof window.claude.use === "function") ? window.claude.use("downloads").catch(() => null) : Promise.resolve(undefined);
  async function exportarDados(){
    if (typeof XLSX === "undefined"){ aviso("A biblioteca do Excel não carregou. Recarregue a página.", true); return; }
    if (!st.cab.length){ aviso("Nenhuma planilha carregada.", true); return; }
    let r = visiveis(-1);
    if (st.ordem){ const {col,dir} = st.ordem; r = r.slice().sort((a,b) => compara(a.v[col], b.v[col]) * (dir === "asc" ? 1 : -1)); }
    const ws = XLSX.utils.aoa_to_sheet([st.cab, ...r.map(l => l.v)], {cellDates:true});
    ws["!autofilter"] = {ref: XLSX.utils.encode_range({s:{r:0, c:0}, e:{r:Math.max(1, r.length), c:st.cab.length - 1}})};
    ws["!cols"] = st.cab.map(h => ({wch: Math.min(40, Math.max(10, String(h).length + 2))}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (st.aba || "Dados").replace(/[\[\]:*?\/\\]/g, "").slice(0, 31) || "Dados");
    const blob = new Blob([XLSX.write(wb, {bookType:"xlsx", type:"array"})]);
    const nome = (st.arquivo || "dados").replace(/\.[^.]+$/, "") + (st.filtros.size ? "_filtrado" : "") + ".xlsx";
    const dl = await dlDados;
    if (dl){
      try{ await dl.save({filename:nome, data:blob}); }
      catch(e){ if (e && e.code === "declined") return; aviso(e && e.code === "rate_limited" ? "Já há um arquivo aguardando confirmação. Tente de novo em instantes." : "Não foi possível salvar o arquivo aqui.", true); }
      return;
    }
    if (window.claude){ aviso("Exportação indisponível nesta visualização.", true); return; }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  $("exportar-dados").addEventListener("click", exportarDados);

  /* Importação */
  function importar(arq){
    if (!arq) return;
    if (typeof XLSX === "undefined"){ aviso("A biblioteca de leitura de planilhas não carregou. Verifique a conexão e recarregue a página.", true); return; }
    const rd = new FileReader();
    rd.onload = ev => {
      try{
        const wb = XLSX.read(new Uint8Array(ev.target.result), {type:"array", cellDates:true});
        const abas = wb.SheetNames.map(n => ({name:n, aoa:XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true, defval:null, blankrows:false})}))
          .filter(a => a.aoa.length);
        if (!abas.length){ aviso("A planilha está vazia.", true); return; }
        carregarAbas(abas, arq.name);
        aviso(`Planilha “${arq.name}” importada.`);
      }catch(err){ aviso("Não foi possível ler o arquivo. Use .xlsx, .xls, .ods ou .csv.", true); }
    };
    rd.onerror = () => aviso("Não foi possível ler o arquivo.", true);
    rd.readAsArrayBuffer(arq);
  }
  $("entrada").addEventListener("change", e => { importar(e.target.files[0]); e.target.value = ""; });
  const g = $("grade");
  ["dragenter","dragover"].forEach(t => g.addEventListener(t, e => { e.preventDefault(); g.classList.add("arrastando"); }));
  ["dragleave","drop"].forEach(t => g.addEventListener(t, e => { e.preventDefault(); if (t === "drop" || e.target === g) g.classList.remove("arrastando"); }));
  g.addEventListener("drop", e => importar(e.dataTransfer.files[0]));

  /* API para o app (bases salvas no Supabase) */
  window.vnsDados = {
    carregar: (abas, nome, ids) => carregarAbas(abas, nome, ids),
    atual: () => ({arquivo: st.arquivo, aba: st.aba, cab: st.cab.slice(), linhas: st.linhas}),
    permitirEdicao: v => { podeEditar = !!v; $("btn-add-linha").hidden = $("btn-del-linha").hidden = !podeEditar; desenhar(); },
    pendentes: () => ({editadas: st.editadas.size, novas: st.novas.size, excluidas: st.excluidas.length}),
    alteracoes: () => ({
      atualizar: st.linhas.filter(l => l.dbId && st.editadas.has(l.uid)).map(l => ({id: l.dbId, v: l.v})),
      inserir: st.linhas.filter(l => st.novas.has(l.uid)).map(l => ({v: l.v})),
      excluir: st.excluidas.slice()
    })
  };
  desenhar();
})();

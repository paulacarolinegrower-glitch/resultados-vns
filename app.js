/* Resultados VNS – app: login (Supabase Auth), perfis, bases salvas e referências */
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const cfg = window.VNS_CONFIG || {};
  const msgLogin = t => { $("login-msg").textContent = t; };
  function toast(m, erro, tempo){
    const a = $("aviso"); a.textContent = m; a.className = "aviso" + (erro ? " erro" : ""); a.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => a.hidden = true, tempo || 4000);
  }

  /* Instalação como aplicativo (PWA) */
  if ("serviceWorker" in navigator && location.protocol === "https:"){
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  const configurado = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/SEU-PROJETO|COLE_AQUI/.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY);
  if (!window.supabase) return msgLogin("Não foi possível carregar o Supabase. Verifique a conexão com a internet e recarregue.");
  if (!configurado) return msgLogin("Falta configurar o Supabase: preencha a URL e a chave pública em js/config.js.");

  /* Link de convite ou de nova senha: o tipo vem no endereço */
  const tipoLink = (/type=(invite|recovery)/.exec(location.hash + location.search) || [])[1] || null;
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  let perfil = null, bases = [], baseAtual = null, doBanco = false, carregandoBase = false, iniciado = false, pedirSenha = !!tipoLink;

  function mostrar(qual){
    $("login").hidden = false;
    $("login-form").hidden = qual !== "entrar";
    $("senha-form").hidden = qual !== "senha";
    msgLogin(qual === "senha" ? "Crie sua senha de acesso (mínimo de 8 caracteres)." : "");
  }
  function traduz(err){
    const m = (err && err.message) || String(err || "");
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme seu e-mail antes de entrar.";
    if (/rate limit|too many/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    if (/Password should be/i.test(m)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor. Verifique a internet.";
    return "Erro: " + m;
  }

  /* ---------- Login, nova senha e saída ---------- */
  $("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("login-entrar").disabled = true; msgLogin("Entrando…");
    const {error} = await sb.auth.signInWithPassword({email: $("login-email").value.trim(), password: $("login-senha").value});
    $("login-entrar").disabled = false;
    if (error) msgLogin(traduz(error));
  });
  $("login-esqueci").addEventListener("click", async () => {
    const email = $("login-email").value.trim();
    if (!email) return msgLogin("Digite seu e-mail acima para receber o link.");
    const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
    msgLogin(error ? traduz(error) : "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.");
  });
  $("senha-form").addEventListener("submit", async e => {
    e.preventDefault();
    const a = $("senha-nova").value, b = $("senha-repete").value;
    if (a !== b) return msgLogin("As duas senhas não são iguais.");
    $("senha-salvar").disabled = true;
    const {error} = await sb.auth.updateUser({password: a});
    $("senha-salvar").disabled = false;
    if (error) return msgLogin(traduz(error));
    pedirSenha = false;
    history.replaceState(null, "", location.pathname);
    const {data} = await sb.auth.getSession();
    iniciarSessao(data.session);
  });
  $("btn-sair").addEventListener("click", async () => { await sb.auth.signOut(); location.replace(location.pathname); });

  sb.auth.onAuthStateChange((evento, session) => {
    if (evento === "PASSWORD_RECOVERY"){ pedirSenha = true; setTimeout(() => mostrar("senha"), 0); return; }
    if (evento === "SIGNED_OUT"){ iniciado = false; setTimeout(() => mostrar("entrar"), 0); return; }
    if (evento === "INITIAL_SESSION" || evento === "SIGNED_IN") setTimeout(() => iniciarSessao(session), 0);
  });

  /* ---------- Sessão iniciada: perfil, referências e bases ---------- */
  async function iniciarSessao(session){
    if (!session) return mostrar("entrar");
    if (pedirSenha) return mostrar("senha");
    if (iniciado) return;
    iniciado = true;
    $("login").hidden = true;
    const {data} = await sb.from("perfis").select("nome,papel,cliente").eq("id", session.user.id).maybeSingle();
    perfil = data || {nome: session.user.email, papel: "cliente", cliente: null};
    document.body.dataset.papel = perfil.papel;
    $("usuario-nome").textContent = perfil.nome || session.user.email;
    $("usuario-papel").textContent = ({admin:"Administrador", equipe:"Equipe Grower", cliente:"Cliente " + (perfil.cliente || "")})[perfil.papel] || "";
    $("usuario").hidden = false;
    $("btn-importar").hidden = perfil.papel === "cliente";
    if (perfil.papel === "cliente" && !perfil.cliente){ toast("Seu acesso ainda não foi liberado. Fale com a Grower.", true, 8000); return; }
    await carregarReferencias();
    await listarBases(true);
  }
  async function carregarReferencias(){
    const {data, error} = await sb.from("referencias").select("id,dados");
    if (error || !data) return;
    const r = {}; data.forEach(x => { r[x.id] = x.dados; });
    window.VNS_REF = r;
  }

  /* ---------- Bases salvas ---------- */
  const rotuloBase = b => `${b.safra ? "Safra " + b.safra + " – " : ""}${b.arquivo || "Base"} (${new Date(b.criado_em).toLocaleDateString("pt-BR")})`;
  async function listarBases(abrirMaisRecente, selecionar){
    const {data, error} = await sb.from("importacoes").select("id,arquivo,aba,safra,criado_em").order("criado_em", {ascending:false});
    if (error){ toast("Não foi possível listar as bases salvas. " + traduz(error), true); return; }
    bases = data || [];
    const sel = $("sel-base");
    sel.innerHTML = bases.length ? bases.map(b => `<option value="${b.id}">${esc(rotuloBase(b))}</option>`).join("") : '<option value="">Nenhuma base salva</option>';
    sel.disabled = !bases.length;
    $("campo-base").hidden = false;
    if (selecionar) sel.value = String(selecionar);
    if (abrirMaisRecente && bases.length) await carregarBase(bases[0].id);
    else if (abrirMaisRecente) toast(perfil.papel === "cliente" ? "Ainda não há resultados disponíveis para você." : "Nenhuma base salva ainda. Importe uma planilha e clique em Salvar no banco.", false, 6000);
    atualizarBotoes();
  }
  async function carregarBase(id){
    const b = bases.find(x => String(x.id) === String(id)); if (!b) return;
    toast("Carregando dados…", false, 20000);
    const {data:imp, error:e1} = await sb.from("importacoes").select("cabecalho").eq("id", b.id).single();
    if (e1){ toast("Erro ao carregar a base. " + traduz(e1), true); return; }
    const linhas = [];
    for (let de = 0; ; de += 1000){
      const {data, error} = await sb.from("amostras").select("valores").eq("importacao_id", b.id).order("ordem").range(de, de + 999);
      if (error){ toast("Erro ao carregar as linhas. " + traduz(error), true); return; }
      data.forEach(x => linhas.push(x.valores));
      if (data.length < 1000) break;
    }
    carregandoBase = true;
    try { window.vnsDados.carregar([{name: b.aba || "Dados", aoa: [imp.cabecalho, ...linhas]}], b.arquivo || "Base salva"); }
    finally { carregandoBase = false; }
    baseAtual = b.id; doBanco = true;
    $("sel-base").value = String(b.id);
    toast(`Base carregada: ${linhas.length} ${linhas.length === 1 ? "linha" : "linhas"}.`);
    atualizarBotoes();
  }
  $("sel-base").addEventListener("change", e => { if (e.target.value) carregarBase(e.target.value); });

  /* Importação local (botão Importar planilha) = dados ainda não salvos */
  document.addEventListener("dados-atualizados", () => { if (!carregandoBase){ doBanco = false; atualizarBotoes(); } });
  function atualizarBotoes(){
    const p = perfil ? perfil.papel : "";
    const temDados = window.vnsDados && window.vnsDados.atual().cab.length > 0;
    $("btn-salvar").hidden = !(p === "admin" || p === "equipe") || doBanco || !temDados;
    $("btn-excluir").hidden = !(p === "admin" && doBanco && baseAtual);
  }

  /* ---------- Salvar no banco ---------- */
  $("btn-salvar").addEventListener("click", () => {
    const d = window.vnsDados.atual(); if (!d.cab.length) return;
    $("dlg-arquivo").textContent = d.arquivo;
    $("dlg-safra").value = "";
    $("dlg-salvar").showModal();
  });
  $("dlg-cancelar").addEventListener("click", () => $("dlg-salvar").close());
  $("dlg-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("dlg-confirmar").disabled = true;
    try { if (await salvarBase($("dlg-safra").value.trim())) $("dlg-salvar").close(); }
    finally { $("dlg-confirmar").disabled = false; }
  });
  async function salvarBase(safra){
    const d = window.vnsDados.atual();
    const col = re => d.cab.findIndex(h => re.test(String(h)));
    const c = {estado:col(/estado/i), cliente:col(/cliente/i), fazenda:col(/fazenda/i), talhao:col(/talh/i), ponto:col(/^\s*ponto/i), padrao:col(/padr/i)};
    const limpa = v => v instanceof Date ? v.toISOString() : (v === undefined || (typeof v === "number" && !isFinite(v)) ? null : v);
    const txt = (l, k) => { if (c[k] < 0) return null; const v = l.v[c[k]]; return v === null || v === undefined || v === "" ? null : String(v); };
    const linhas = d.linhas.map(l => ({estado:txt(l,"estado"), cliente:txt(l,"cliente"), fazenda:txt(l,"fazenda"), talhao:txt(l,"talhao"), ponto:txt(l,"ponto"), padrao:txt(l,"padrao"), valores:l.v.map(limpa)}));
    toast("Salvando no banco…", false, 30000);
    const {data:id, error} = await sb.rpc("salvar_importacao", {p_arquivo:d.arquivo, p_aba:d.aba, p_safra:safra, p_cabecalho:d.cab.map(String), p_linhas:linhas});
    if (error){ toast("Erro ao salvar. " + traduz(error), true, 8000); return false; }
    toast(`Base salva: ${linhas.length} linhas.`);
    doBanco = true; baseAtual = id;
    await listarBases(false, id);
    return true;
  }

  /* ---------- Excluir base (somente administrador) ---------- */
  $("btn-excluir").addEventListener("click", async () => {
    const b = bases.find(x => String(x.id) === String(baseAtual)); if (!b) return;
    if (!confirm(`Excluir do banco a base "${rotuloBase(b)}"? Essa ação não pode ser desfeita.`)) return;
    const {error} = await sb.from("importacoes").delete().eq("id", b.id);
    if (error){ toast("Erro ao excluir. " + traduz(error), true); return; }
    toast("Base excluída.");
    baseAtual = null; doBanco = false;
    await listarBases(true);
  });
})();

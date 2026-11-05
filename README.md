# Resultados VNS – Grower Consultoria Agronômica

Aplicativo web (instalável no computador e no celular) com as guias **Dados**, **Análise de nematoides**, **Análise Biológica**, **Análise Foliar** e **Análise de Grãos**.
O código fica no **GitHub** (publicado pelo GitHub Pages) e os dados e o login ficam no **Supabase**.

```
resultados-vns/
├── index.html              página do app
├── manifest.webmanifest    dados para instalar como aplicativo
├── sw.js                   funcionamento offline da interface
├── .nojekyll               necessário para o GitHub Pages
├── css/app.css
├── js/
│   ├── config.js           ← AQUI vão a URL e a chave pública do Supabase
│   ├── app.js              login, perfis, bases salvas, referências
│   ├── dados.js  nematoides.js  biologica.js  foliar.js  graos.js
├── icons/                  ícones do app
└── supabase/schema.sql     cria tabelas, regras de segurança e referências
```

> **Nenhum dado de cliente fica no código.** Os resultados ficam só no Supabase, protegidos por login e pelas regras de segurança (RLS).

---

## 1. Supabase (banco e login)

1. Acesse **supabase.com**, crie uma conta e um **New project** (anote a senha do banco). Região sugerida: **South America (São Paulo)**.
2. No menu do projeto, abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Deve aparecer "Success".
3. **Desligue o cadastro aberto** (só entra quem for convidado):
   *Authentication → Sign In / Providers* → desmarque **Allow new users to sign up** → Save.
4. **Endereço do app** (para os links de convite e de nova senha):
   *Authentication → URL Configuration* → em **Site URL** coloque o endereço do GitHub Pages (passo 2.4, ex.: `https://grower.github.io/resultados-vns/`) e adicione o mesmo em **Redirect URLs**.
5. **Copie as chaves**: *Project Settings → API* (ou *API Keys*):
   - **Project URL** → `SUPABASE_URL`
   - **anon public** (aba *Legacy API keys*, se houver; senão use a **publishable key**) → `SUPABASE_ANON_KEY`
   - **Nunca** use a chave `service_role` / `secret` no app.
6. Abra `js/config.js` e cole os dois valores.

> Os nomes dos menus do Supabase podem mudar um pouco com o tempo; os itens continuam nas áreas *Authentication* e *Project Settings*.

## 2. GitHub (código e publicação)

1. Crie uma conta em **github.com** (ou use a da Grower) e clique em **New repository** → nome `resultados-vns`.
   - **Público** funciona no plano gratuito (o código não contém dados).
   - **Privado** com GitHub Pages exige plano pago (Pro/Team).
2. No repositório: **Add file → Upload files**, arraste **todo o conteúdo** da pasta `resultados-vns` (incluindo `.nojekyll`; no Windows/Mac ele pode estar oculto — se não aparecer, crie pelo botão *Add file → Create new file* com o nome `.nojekyll` e conteúdo vazio) → **Commit changes**.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** e pasta **/ (root)** → Save.
4. Em 1 a 2 minutos o endereço aparece no topo da página de Pages (ex.: `https://SEU-USUARIO.github.io/resultados-vns/`). Volte ao passo 1.4 do Supabase e confira se é o mesmo endereço.

## 3. Usuários e permissões

**Convidar:** *Supabase → Authentication → Users → Add user → Send invitation* (e-mail da pessoa). Ela recebe um link, cria a senha e entra.
Todo usuário novo nasce como **cliente sem acesso**. Para liberar, use o *SQL Editor*:

```sql
-- Você como administrador (faça isso primeiro, depois de se convidar)
update public.perfis set papel = 'admin', nome = 'Paula'
where id = (select id from auth.users where email = 'SEU-EMAIL@grower...');

-- Alguém da equipe Grower (vê tudo e salva bases)
update public.perfis set papel = 'equipe', nome = 'Nome da pessoa'
where id = (select id from auth.users where email = 'pessoa@...');

-- Um cliente (vê só as próprias linhas; o nome deve ser IGUAL ao "Nome cliente" da planilha)
update public.perfis set papel = 'cliente', cliente = 'Carolino', nome = 'Carolino'
where id = (select id from auth.users where email = 'cliente@...');
```

| Papel | Vê | Importa e salva bases | Exclui bases |
|---|---|---|---|
| admin | tudo | sim | sim |
| equipe | tudo | sim | não |
| cliente | só as linhas do próprio cliente | não | não |

> O e-mail padrão do Supabase envia poucos e-mails por hora. Para uso com muitos convites, configure um SMTP próprio em *Authentication → Emails → SMTP Settings*.

## 4. Uso no dia a dia

1. Entre com e-mail e senha.
2. Guia **Dados** → **Importar planilha** → confira a tabela → **Salvar no banco** → informe a **Safra** (ex.: 25/26).
3. A base fica disponível para todos com acesso. Em **Base salva** escolha qual base abrir (a mais recente abre sozinha).
4. As guias de análise usam a base aberta. Filtros, cores, correlações e exportações funcionam como antes.
5. **Excluir base** (só administrador) apaga a base selecionada do banco.

## 5. Instalar como aplicativo

- **Computador (Chrome/Edge):** abra o endereço → ícone **Instalar** na barra de endereço (ou menu ⋮ → *Instalar Resultados VNS*).
- **Android (Chrome):** menu ⋮ → **Adicionar à tela inicial / Instalar app**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

A interface abre mesmo sem internet; para ver e salvar dados é preciso estar conectado.

## 6. Referências de cores

Os limites das cores das guias **Biológica** (Referência Grower solo + Embrapa índices) e **Foliar** (Níveis críticos Safra 24/25) ficam na tabela **referencias** do Supabase (*Table Editor → referencias*, coluna `dados`).
Cada item tem `padrao` (nome do atributo), `limites` (limite superior de cada classe) e, na biológica, `escala` (`solo`, `m` ou `indice`).
Ao alterar e salvar, as cores mudam na próxima vez que o app for aberto. Os textos das legendas e as faixas dos nematoides estão no código (`js/biologica.js`, `js/foliar.js`, `js/nematoides.js`).

## 7. Atualizar o app

Edite os arquivos no GitHub (ícone de lápis ou *Upload files*) e, a cada nova versão, **aumente o número em `VERSAO` no arquivo `sw.js`** (ex.: `vns-v1` → `vns-v2`) para os aplicativos instalados baixarem a versão nova.

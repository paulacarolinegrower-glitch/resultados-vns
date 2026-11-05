/*
  Configuração do Supabase
  Cole aqui os dados do seu projeto (Supabase > Project Settings > API):
    - Project URL      -> SUPABASE_URL
    - anon public key  -> SUPABASE_ANON_KEY
  A chave "anon" é pública por natureza: quem protege os dados são as regras de
  segurança (RLS) criadas pelo arquivo supabase/schema.sql.
  NUNCA coloque aqui a chave "service_role".
*/
window.VNS_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "COLE_AQUI_A_CHAVE_ANON_PUBLICA"
};

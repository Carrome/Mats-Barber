/* =====================================================================
   Endereço, chave e código de acesso ao banco.
   SUPABASE_URL e SUPABASE_KEY identificam o projeto, não a pessoa.
   CODIGO_SYNC é o que as funções do banco conferem antes de ler ou gravar
   (sql/02-sem-login.sql guarda só o resumo sha256 dele). Ele viaja no
   JavaScript público do site: decisão do dono enquanto o login estiver
   desligado. Para trocar, gerar outro e atualizar o resumo no SQL junto.
   A chave de serviço NUNCA entra aqui.
   ===================================================================== */
export const SUPABASE_URL = "https://sgirqynnahnhbbeeqlvf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_o3WZPQz_j1n0fuKYtTC_Hg_OdGJcY4C";
export const CODIGO_SYNC = "6f3597c3122adf0c7c91c834020cb0afd1cd947b708a3df0";

// O login exige formato de e-mail. O usuário digita só "mats"; este domínio
// completa o endereço. Não existe caixa de entrada do outro lado.
export const DOMINIO_LOGIN = "mats-barber.vercel.app";

/* =====================================================================
   Endereço e chave de acesso ao banco.
   Estes dois valores são públicos por natureza: eles identificam o
   projeto, não a pessoa. Quem decide o que pode ser lido ou gravado são
   as políticas do banco, que exigem sessão iniciada.
   A chave de serviço NUNCA entra aqui.
   ===================================================================== */
export const SUPABASE_URL = "https://sgirqynnahnhbbeeqlvf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_o3WZPQz_j1n0fuKYtTC_Hg_OdGJcY4C";

// O login exige formato de e-mail. O usuário digita só "mats"; este domínio
// completa o endereço. Não existe caixa de entrada do outro lado.
export const DOMINIO_LOGIN = "mats-barber.vercel.app";

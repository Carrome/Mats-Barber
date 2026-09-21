/* =====================================================================
   Acesso ao banco: sessão e leitura/gravação do retrato da barbearia
   ===================================================================== */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config.js";

export const cliente = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// arede.online · TESTE-SESSAO (22/11/2026, pedido da Amanda): abre uma sessão só para a CONTA DE TESTE (@jackie.disguise),
// para o teste diário do GitHub entrar no site como uma pessoa de verdade, sem passar pelo login (que tem o desafio contra robôs).
// Só responde com a chave secreta TESTE_CHAVE (criada pela Amanda no Supabase e no GitHub; ninguém mais vê).
// Nunca abre sessão para outra conta: a conta vem de privado.config (conta_teste), não de quem chama.
// Não manda e-mail: o link mágico é gerado e usado aqui mesmo. Sem custo.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const ADMIN = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function igual(a: string, b: string) {   // comparação em tempo constante
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);
  const chave = Deno.env.get("TESTE_CHAVE") || "";
  if (chave.length < 24) return json({ erro: chave ? "teste desligado: a chave tem menos de 24 caracteres" : "teste desligado: sem a chave TESTE_CHAVE" }, 503);
  if (!igual(req.headers.get("x-teste-chave") || "", chave)) return json({ erro: "sem permissão" }, 403);
  const { data: id, error: e1 } = await ADMIN.rpc("conta_teste_id");
  if (e1 || !id) return json({ erro: "conta de teste não definida" }, 500);
  const { data: u, error: e2 } = await ADMIN.auth.admin.getUserById(id as string);
  if (e2 || !u?.user?.email) return json({ erro: "conta de teste não encontrada" }, 500);
  const { data: l, error: e3 } = await ADMIN.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  const hash = l?.properties?.hashed_token;
  if (e3 || !hash) return json({ erro: "não foi possível gerar o acesso" }, 500);
  const r = await fetch(`${URL}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: hash }) });
  const s = await r.json().catch(() => null);
  if (!r.ok || !s?.access_token) return json({ erro: "não foi possível abrir a sessão" }, 500);
  // só o que o site precisa para entrar; o e-mail não sai daqui
  return json({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type,
    user: { id: s.user?.id, aud: s.user?.aud, role: s.user?.role, created_at: s.user?.created_at, email_confirmed_at: s.user?.email_confirmed_at, app_metadata: s.user?.app_metadata || {}, user_metadata: {} } });
});

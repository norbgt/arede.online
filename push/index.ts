// arede.online · PUSH-ENVIA (21/11/2026, Amanda): manda para o celular os avisos do sino que pedem ação.
// Quem chama: a rotina push-envia, a cada 2 minutos, só quando há aviso na fila, com a chave interna (x-coletor).
// Na primeira vez gera as chaves do servidor (a privada fica só no banco). Aparelho que não existe mais (404/410) sai da lista.
// Sem custo: o serviço de notificação dos navegadores é gratuito.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cifra, novasChaves, vapid } from "./cripto.ts";

const ADMIN = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
// só os serviços de notificação dos navegadores (a mesma lista do banco)
const SERVICO = /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

Deno.serve(async (req: Request) => {
  const chave = req.headers.get("x-coletor") || "";
  if (!chave) return json({ ok: false }, 401);
  let { data: L, error } = await ADMIN.rpc("push_lote", { p_chave: chave });
  if (error || !L) return json({ ok: false }, 401);
  if (!L.publica || !L.privada) {
    const ch = await novasChaves();
    await ADMIN.rpc("push_vapid_grava", { p_chave: chave, p_publica: ch.publica, p_privada: ch.privada });
    ({ data: L } = await ADMIN.rpc("push_lote", { p_chave: chave }));
    if (!L || !L.publica) return json({ ok: false, erro: "sem chaves" });
  }
  const enviados: number[] = [], mortos: string[] = [], erros: Record<string, string> = {};
  for (const it of (L.itens || []) as { id: number; texto: string; link: string; aparelhos: { endpoint: string; p256dh: string; auth: string }[] }[]) {
    const carga = JSON.stringify({ t: it.texto, l: it.link || "#notificacoes" });
    for (const a of it.aparelhos || []) {
      if (!SERVICO.test(a.endpoint)) { mortos.push(a.endpoint); continue; }
      try {
        const r = await fetch(a.endpoint, { method: "POST", signal: AbortSignal.timeout(15000),
          headers: { Authorization: await vapid(a.endpoint, L.publica, L.privada), TTL: "86400", Urgency: "normal",
            "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" },
          body: await cifra(a.p256dh, a.auth, carga) });
        if (r.status === 404 || r.status === 410) mortos.push(a.endpoint);
        else if (!r.ok) erros[String(it.id)] = `serviço ${r.status}`;
        await r.body?.cancel();
      } catch (_e) { erros[String(it.id)] = "o serviço não respondeu"; }
    }
    enviados.push(it.id);
  }
  if (enviados.length || mortos.length) await ADMIN.rpc("push_resultado", { p_chave: chave, p_enviados: enviados, p_mortos: mortos, p_erros: erros });
  return json({ ok: true, enviados: enviados.length, mortos: mortos.length, erros: Object.keys(erros).length });
});

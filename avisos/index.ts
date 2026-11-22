// arede.online · AVISOS-ENVIA (19/11/2026): manda os e-mails que estão na fila (privado.avisos).
// Quem chama: a rotina rotinas-vigia, a cada 15 minutos, só quando há aviso na fila, e o resumo semanal, só com a chave interna (x-coletor).
// Antes, os avisos só saíam quando alguém decidia algo na Moderação; agora saem sozinhos, inclusive o aviso de rotina parada.
// 21/11: endereços de arede.online viram link no e-mail (o resumo da semana leva um link por notícia). Nenhum outro endereço vira link.
// Os e-mails de quem recebe nunca passam pelo navegador. Segredo usado: BREVO_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const REMETENTE = { name: "arede.online", email: "contato@arede.online" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const liga = (s: string) => s.replace(/https:\/\/arede\.online(\/[A-Za-z0-9_\-./#@=]*)?/g, (u) => `<a href="${u}" style="color:#3B4BD9">${u.length > 60 ? "Abrir na rede.online" : u}</a>`);
const html = (t: string) => `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#fff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#141615">
${esc(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${liga(p).replace(/\n/g, "<br>")}</p>`).join("")}
<p style="margin:18px 0 0;color:#565C58;font-size:13px">— arede.online · <a href="https://arede.online" style="color:#565C58">arede.online</a> · responda este e-mail para falar com a gente</p></body></html>`;

Deno.serve(async (req: Request) => {
  const chave = req.headers.get("x-coletor") || "";
  if (!chave) return json({ ok: false }, 401);
  const { data: lista, error } = await ADMIN.rpc("avisos_fila", { p_chave: chave, p_limite: 20 });
  if (error || !Array.isArray(lista)) return json({ ok: false }, 401);
  const brevo = Deno.env.get("BREVO_API_KEY");
  let enviados = 0;
  for (const a of lista as { id: number; para: string; assunto: string; texto: string }[]) {
    if (!brevo) { await ADMIN.rpc("aviso_resultado", { p_id: a.id, p_ok: false, p_erro: "sem a chave do Brevo" }); continue; }
    try {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
        headers: { "api-key": brevo, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: REMETENTE, replyTo: REMETENTE, to: [{ email: a.para }], subject: a.assunto,
          textContent: a.texto + "\n\n— arede.online", htmlContent: html(a.texto) }) });
      const j = await r.json().catch(() => ({}));
      await ADMIN.rpc("aviso_resultado", { p_id: a.id, p_ok: r.ok, p_erro: r.ok ? null : `Brevo ${r.status}: ${String((j as any).message || (j as any).code || "recusou")}` });
      if (r.ok) enviados++;
    } catch (_e) {
      await ADMIN.rpc("aviso_resultado", { p_id: a.id, p_ok: false, p_erro: "o Brevo não respondeu" });
    }
  }
  return json({ ok: true, enviados, na_fila: lista.length });
});

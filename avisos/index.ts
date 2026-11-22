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
const liga = (s: string) => s.replace(/https:\/\/arede\.online(\/[A-Za-z0-9_\-./#@=]*)?/g, (u) => `<a href="${u}" style="color:#2A3FD4">${u.length > 60 ? "Abrir na rede.online" : u}</a>`);
// 22/11 (Amanda): o mesmo desenho dos e-mails de cadastro e senha: marca em cima, cartão branco e rodapé curto.
const F = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif";
const html = (t: string) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#F2F3EF;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3EF"><tr><td align="center" style="padding:40px 16px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 20px;${F};font-size:24px;font-weight:700;letter-spacing:-0.7px;color:#141615"><a href="https://arede.online" style="color:#141615;text-decoration:none">arede<span style="color:#8D9BFF">.</span><span style="font-weight:500">online</span></a></td></tr>
<tr><td style="background:#FFFFFF;border-radius:20px;padding:32px;${F};font-size:16px;line-height:1.55;color:#3C413E">
${esc(t).split(/\n{2,}/).map((p, i) => `<p style="margin:${i ? "14px" : "0"} 0 0">${liga(p).replace(/\n/g, "<br>")}</p>`).join("")}
</td></tr>
<tr><td align="center" style="padding:22px 12px 0;${F};font-size:12px;line-height:1.6;color:#8A908B">Responda este e-mail para falar com a gente. Nunca pedimos sua senha por e-mail.<br><br>
<a href="https://arede.online" style="color:#141615;font-weight:600;text-decoration:none">a rede.online</a> · <a href="mailto:contato@arede.online" style="color:#8A908B">contato@arede.online</a></td></tr>
</table></td></tr></table></body></html>`;

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
          textContent: a.texto + "\n\n— a rede.online · contato@arede.online", htmlContent: html(a.texto) }) });
      const j = await r.json().catch(() => ({}));
      await ADMIN.rpc("aviso_resultado", { p_id: a.id, p_ok: r.ok, p_erro: r.ok ? null : `Brevo ${r.status}: ${String((j as any).message || (j as any).code || "recusou")}` });
      if (r.ok) enviados++;
    } catch (_e) {
      await ADMIN.rpc("aviso_resultado", { p_id: a.id, p_ok: false, p_erro: "o Brevo não respondeu" });
    }
  }
  return json({ ok: true, enviados, na_fila: lista.length });
});

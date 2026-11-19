"""Testes do site, sem conta (19/11/2026).

Abre o site num navegador de verdade, no celular e no computador (claro e escuro), e percorre o que um visitante usa:
feed, notícia aberta, selo, "Como funciona a nota", Contestar (sem enviar), páginas principais e busca.
Procura erro de código, rolagem lateral e e-mail que não seja o de contato no código. Não cria nada e não envia nada.

Uso: python3 testes/site.py https://arede.online          (site no ar)
     python3 testes/site.py http://localhost:8080          (cópia local, com dados reais)
     python3 testes/site.py http://localhost:8080 --offline (sem rede: usa as cópias embutidas)
"""
import asyncio, json, sys, os
from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "https://arede.online"
OFFLINE = "--offline" in sys.argv
ROTAS = ["#inicio", "#buscar", "#canais", "#em-alta", "#manifesto", "#termos", "#privacidade"]
# Só estes e-mails podem aparecer no código público. Qualquer outro faz o teste falhar (sem citar nenhum e-mail aqui).
EMAILS_OK = {"contato@arede.online", "voce@teste.arede.online"}
OUT = os.environ.get("TESTES_SAIDA", "testes-saida")
os.makedirs(OUT, exist_ok=True)
certos, falhas = [], []

def confere(cond, nome, det=""):
    (certos if cond else falhas).append(nome if cond else f"{nome}: {det}")
    print(("ok   " if cond else "FALHA") + " " + nome + ("" if cond else f" ({det})"), flush=True)

async def abre_contexto(b, w, escuro):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 900}, color_scheme="dark" if escuro else "light", locale="pt-BR")
    pg = await ctx.new_page(); erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    if OFFLINE:
        await pg.route("**/*", lambda r: r.continue_() if ("localhost" in r.request.url or "127.0.0.1" in r.request.url) else r.abort())
    return ctx, pg, erros

async def sem_rolagem_lateral(pg):
    return await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

async def fecha_folha(pg):
    if await pg.locator("#layer .sheet").count():
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    if await pg.locator("#layer .sheet").count():
        b = pg.locator("#layer .sheet [data-act=close]").first
        if await b.count(): await b.click(); await pg.wait_for_timeout(300)

async def entra(pg):
    await pg.goto(BASE + "/#inicio", wait_until="domcontentloaded", timeout=45000)
    for _ in range(3):   # primeira visita: escolha de língua, se aparecer
        c = pg.locator("#layer button", has_text="Continuar")
        if await c.count():
            pt = pg.locator("#layer button", has_text="Português")
            if await pt.count(): await pt.first.click()
            await c.first.click(); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(600)
    await pg.wait_for_selector('[data-act="open"], [data-act="topen"]', timeout=45000)

async def roda(b, w, escuro):
    nome = f"{w}px {'escuro' if escuro else 'claro'}"
    ctx, pg, erros = await abre_contexto(b, w, escuro)
    try:
        await entra(pg); await pg.wait_for_timeout(1500)
        n = await pg.locator('[data-act="open"], [data-act="topen"]').count()
        confere(n >= 3, f"{nome} · feed com conteúdo", f"{n} cartões")
        confere(await sem_rolagem_lateral(pg), f"{nome} · feed sem rolagem lateral")
        await pg.screenshot(path=f"{OUT}/feed-{w}-{int(escuro)}.png")

        # notícia aberta com selo
        achou = False
        for i in range(min(n, 8)):
            await pg.goto(BASE + "/#inicio"); await pg.wait_for_selector('[data-act="open"], [data-act="topen"]', timeout=30000); await pg.wait_for_timeout(400)
            await pg.locator('[data-act="open"], [data-act="topen"]').nth(i).click(); await pg.wait_for_timeout(1200)
            if await pg.locator(".pinseal .sealbox").count(): achou = True; break
        confere(achou, f"{nome} · notícia aberta mostra o selo")
        if achou:
            sb = pg.locator(".pinseal .sealbox").first
            await sb.locator("summary").click(); await pg.wait_for_timeout(400)
            confere(await sb.evaluate("e => e.open"), f"{nome} · selo abre")
            i_ = sb.locator('[data-act="notacomo"]')
            if await i_.count():
                await i_.click(); await pg.wait_for_timeout(500)
                confere(await pg.locator('#layer .sheet[aria-label="Como funciona a nota"]').count() == 1, f"{nome} · (i) abre o resumo da nota")
                await fecha_folha(pg)
                confere(await pg.locator("#layer .sheet").count() == 0, f"{nome} · resumo fecha")
            else:
                confere(False, f"{nome} · (i) no selo", "botão não encontrado")
            ct = sb.locator('[data-act="contestar"], [data-act="contest"]')
            if await ct.count():
                await ct.first.click(); await pg.wait_for_timeout(600)
                confere(await pg.locator("#layer .sheet").count() == 1, f"{nome} · Contestar abre (sem enviar)")
                await fecha_folha(pg)
            confere(await sem_rolagem_lateral(pg), f"{nome} · notícia aberta sem rolagem lateral")
            await pg.screenshot(path=f"{OUT}/noticia-{w}-{int(escuro)}.png")

        # páginas principais
        for r in ROTAS:
            await pg.goto(BASE + "/" + r); await pg.wait_for_timeout(1500)
            txt = await pg.evaluate("document.body.innerText.length")
            confere(txt > 200, f"{nome} · {r} abre", f"{txt} letras")
            confere(await sem_rolagem_lateral(pg), f"{nome} · {r} sem rolagem lateral")

        # busca
        await pg.goto(BASE + "/#buscar"); await pg.wait_for_timeout(1200)
        q = pg.locator("#q")
        if await q.count():
            await q.fill("saúde"); await q.press("Enter"); await pg.wait_for_timeout(2000)
            confere(await pg.evaluate("document.body.innerText.length") > 200, f"{nome} · busca responde")
        else:
            confere(False, f"{nome} · campo de busca", "não encontrado")

        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
        try: await pg.screenshot(path=f"{OUT}/erro-{w}-{int(escuro)}.png")
        except Exception: pass
    finally:
        await ctx.close()

async def privado(b):
    ctx, pg, _ = await abre_contexto(b, 1280, False)
    try:
        await pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=45000)
        partes = await pg.evaluate("""async () => { const u = [location.href, ...[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e => e.src || e.href)].filter(x => x.startsWith(location.origin));
          const t = []; for (const x of u) { try { t.push(await (await fetch(x)).text()); } catch (e) {} } return t.join('\\n'); }""")
        import re
        achados = sorted({e.lower() for e in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", partes)} - EMAILS_OK)
        confere(len(partes) > 10000 and not achados, "código público só com o e-mail de contato", f"{len(achados)} e-mail(s) a mais" if achados else "não leu o código")
    finally:
        await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await privado(b)
        for w, escuro in ((390, False), (390, True), (1280, False)):
            await roda(b, w, escuro)
        await b.close()
    json.dump({"base": BASE, "certos": len(certos), "falhas": falhas}, open(f"{OUT}/resultado.json", "w"), ensure_ascii=False, indent=1)
    print(f"\n{len(certos)} certos, {len(falhas)} falhas")
    sys.exit(1 if falhas else 0)

asyncio.run(main())

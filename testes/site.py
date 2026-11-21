"""Testes do site, por grupos (20/11/2026).

Abre o site num navegador de verdade e confere o que um visitante (e o modo de teste, que simula uma conta) usa.
Não cria nada e não envia nada: nenhum formulário é enviado, nenhuma denúncia, nenhum comentário.

Grupos:
  sempre        roda em toda publicação: segurança (e-mail e painel), feed, card abre com selo, sem erro, sem rolagem lateral
  card          card aberto: selo, (i) da nota, Contestar, Ajustar do card, Denunciar na barra
  ajustar       folha Ajustar: 4 abas, Selecionar tudo, Limpar, Ver N conteúdos
  fontes        Ajustar › Fontes › Países e línguas
  conta         Sua conta (modo de teste): Algoritmo com 4 cartões, Editar abre Temas, Dados com histórico
  filtros       filtro salvo continua depois de recarregar (modo de teste)
  anuncio       card de anúncio e vitrine aberta
  desinfo       aviso de baixa confiança: Ver conteúdos abre a lista
  abas          Canais, Rádio, Cultura, Oficiais
  eventos       aba Para participar: cartões inteiros
  comunidades   lista e página de comunidade (Regras); sem etiqueta Página
  emalta        Em alta com o gráfico
  config        Configurações › Seu feed
  primeiro      primeiro acesso: idioma e país
  publicar      formulário de publicar abre (sem enviar)
  rodape        rodapé da marca: contato e versão
  busca         busca responde
  institucional Manifesto, Termos, Privacidade
  layout        repete sempre + card no celular escuro e no computador
  tudo          todos os grupos (antes de cada #DISPARAR SYNC)

Uso: python3 testes/site.py URL [--offline] [--grupos sempre,card,...]
"""
import asyncio, json, sys, os, re
from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "https://arede.online"
OFFLINE = "--offline" in sys.argv
GRUPOS_TODOS = ["sempre", "card", "ajustar", "fontes", "conta", "filtros", "anuncio", "desinfo", "abas", "eventos", "comunidades",
                "emalta", "config", "primeiro", "publicar", "rodape", "busca", "institucional", "layout"]
_g = next((a.split("=", 1)[1] if "=" in a else (sys.argv[sys.argv.index(a) + 1] if sys.argv.index(a) + 1 < len(sys.argv) else "")) for a in sys.argv if a.startswith("--grupos")) if any(a.startswith("--grupos") for a in sys.argv) else "sempre"
GRUPOS = GRUPOS_TODOS if _g == "tudo" else ["sempre"] + [x for x in _g.split(",") if x and x != "sempre"]
for x in GRUPOS:
    if x not in GRUPOS_TODOS: sys.exit(f"grupo desconhecido: {x}")
# Só estes e-mails podem aparecer no código público. Qualquer outro faz o teste falhar (sem citar nenhum e-mail aqui).
EMAILS_OK = {"contato@arede.online", "voce@teste.arede.online"}
OUT = os.environ.get("TESTES_SAIDA", "testes-saida")
os.makedirs(OUT, exist_ok=True)
certos, falhas, avisos = [], [], []

def confere(cond, nome, det=""):
    (certos if cond else falhas).append(nome if cond else f"{nome}: {det}")
    print(("ok   " if cond else "FALHA") + " " + nome + ("" if cond else f" ({det})"), flush=True)

def avisa(nome, det):
    avisos.append(f"{nome}: {det}"); print(f"AVISO {nome} ({det})", flush=True)

async def abre_contexto(b, w=390, escuro=False):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 900}, color_scheme="dark" if escuro else "light", locale="pt-BR")
    pg = await ctx.new_page(); erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    if OFFLINE:
        await pg.route("**/*", lambda r: r.continue_() if ("localhost" in r.request.url or "127.0.0.1" in r.request.url) else r.abort())
    return ctx, pg, erros

async def sem_rolagem_lateral(pg):
    return await pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

async def clica(pg, sel, espera=500):
    ok = await pg.evaluate("s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }", sel)
    await pg.wait_for_timeout(espera); return ok

async def folha(pg, rotulo=None):
    sel = f'#layer .sheet[aria-label="{rotulo}"]' if rotulo else "#layer .sheet"
    return await pg.locator(sel).count() > 0

async def fecha_folha(pg):
    for _ in range(2):
        if await pg.locator("#layer .sheet").count():
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
    if await pg.locator("#layer .sheet").count():
        await clica(pg, "#layer .sheet [data-act=close]", 300)

async def entra(pg, teste=False, rota="#inicio"):
    await pg.goto(BASE + "/" + ("?teste=1" if teste else "") + rota, wait_until="domcontentloaded", timeout=45000)
    for _ in range(3):   # primeira visita: escolha de língua, se aparecer
        c = pg.locator("#layer button", has_text="Continuar")
        if await c.count():
            pt = pg.locator("#layer button", has_text="Português")
            if await pt.count(): await pt.first.click()
            await c.first.click(); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(500)
    if rota == "#inicio":
        await pg.wait_for_selector('[data-act="open"], [data-act="topen"]', timeout=45000)

async def abre_card_com_selo(pg, teste=False, contestar=False):
    n = await pg.locator('[data-act="open"], [data-act="topen"]').count(); achou = False
    for i in range(min(n, 12)):
        await entra(pg, teste); await pg.wait_for_timeout(300)
        await pg.locator('[data-act="open"], [data-act="topen"]').nth(i).click(); await pg.wait_for_timeout(1100)
        if await pg.locator(".pinseal .sealbox").count():
            achou = True
            if not contestar or await pg.locator('.pinseal [data-act="contestar"], .pinseal [data-act="contest"]').count(): return True
    return achou

# ---------- grupos ----------

async def g_seguranca(b):
    ctx, pg, _ = await abre_contexto(b, 1280)
    try:
        await pg.goto(BASE + "/", wait_until="domcontentloaded", timeout=45000)
        partes = await pg.evaluate("""async () => { const u = [location.href, ...[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e => e.src || e.href)].filter(x => x.startsWith(location.origin));
          const t = []; for (const x of u) { try { t.push(await (await fetch(x)).text()); } catch (e) {} } return t.join('\\n'); }""")
        achados = sorted({e.lower() for e in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", partes)} - EMAILS_OK)
        confere(len(partes) > 10000 and not achados, "sempre · código público só com o e-mail de contato", f"{len(achados)} e-mail(s) a mais" if achados else "não leu o código")
        painel = re.findall(r"painel\.arede\.online|arede-backoffice|workers\.dev", partes.replace('class="setting painel" href="https://painel.arede.online/"', "").replace("<small>painel.arede.online</small>", ""))
        confere(not painel, "sempre · painel só no link da administração", f"{len(painel)} referência(s) fora dele")
        if not OFFLINE:   # no ar: o endereço do painel tem que pedir login (Cloudflare Access), nunca mostrar o painel
            r = await pg.request.get("https://painel.arede.online/", max_redirects=0, fail_on_status_code=False)
            confere(r.status in (302, 303, 401, 403), "sempre · painel pede login", f"respondeu {r.status}")
    finally:
        await ctx.close()

async def g_sempre(b, w=390, escuro=False, rotulo="sempre"):
    nome = f"{rotulo} · {w}px {'escuro' if escuro else 'claro'}"
    ctx, pg, erros = await abre_contexto(b, w, escuro)
    try:
        await entra(pg); await pg.wait_for_timeout(1200)
        n = await pg.locator('[data-act="open"], [data-act="topen"]').count()
        confere(n >= 3, f"{nome} · feed com conteúdo", f"{n} cartões")
        confere(await sem_rolagem_lateral(pg), f"{nome} · feed sem rolagem lateral")
        await pg.screenshot(path=f"{OUT}/feed-{w}-{int(escuro)}.png")
        confere(await abre_card_com_selo(pg), f"{nome} · card abre com o selo")
        confere(await sem_rolagem_lateral(pg), f"{nome} · card aberto sem rolagem lateral")
        for r in ["#buscar", "#em-alta", "#conta"]:
            await pg.goto(BASE + "/" + r); await pg.wait_for_timeout(900); await fecha_folha(pg)
            if not await sem_rolagem_lateral(pg): confere(False, f"{nome} · {r} sem rolagem lateral"); break
        else: confere(True, f"{nome} · páginas principais sem rolagem lateral")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_card(b, w=390, escuro=False, rotulo="card"):
    nome = f"{rotulo} · {w}px {'escuro' if escuro else 'claro'}"
    ctx, pg, erros = await abre_contexto(b, w, escuro)
    try:
        await entra(pg); await pg.wait_for_timeout(800)
        if not await abre_card_com_selo(pg, contestar=True): return confere(False, f"{nome} · card com selo", "nenhum card com selo")
        sb = pg.locator(".pinseal .sealbox").first
        await sb.locator("summary").click(); await pg.wait_for_timeout(400)
        confere(await sb.evaluate("e => e.open"), f"{nome} · selo abre")
        if await clica(pg, '.pinseal [data-act="notacomo"]'):
            confere(await folha(pg, "Como funciona a nota"), f"{nome} · (i) abre o resumo da nota")
            await fecha_folha(pg); confere(not await folha(pg), f"{nome} · resumo fecha")
        else: confere(False, f"{nome} · (i) no selo", "botão não encontrado")
        if await clica(pg, '.pinseal [data-act="contestar"], .pinseal [data-act="contest"]', 700):
            confere(await folha(pg), f"{nome} · Contestar abre (sem enviar)"); await fecha_folha(pg)
        else: avisa(f"{nome} · Contestar", "nenhuma notícia com Contestar nos primeiros 12 cards")
        confere(await pg.locator('.pinbar [data-act="report"]').count() == 1, f"{nome} · Denunciar na barra de cima")
        confere(await pg.locator('.pintags .wline, .pintags .wic').count() == 0, f"{nome} · sem a linha do motivo")
        if await pg.locator(".pintags details.wajuste").count():
            await clica(pg, ".pintags details.wajuste summary", 300)
            confere(await pg.locator(".pintags .watal .wopc").count() >= 1, f"{nome} · Ajustar do card abre com opções")
        else: avisa(f"{nome} · Ajustar do card", "este card não tem opções (algoritmo desligado ou sem tema)")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_ajustar(b):
    nome = "ajustar"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg); await clica(pg, '[data-act="adjust"]', 600)
        confere(await folha(pg, "Ajustar"), f"{nome} · folha abre")
        abas = await pg.locator('#layer .ajaba').all_inner_texts()
        confere(abas == ["Filtrar", "Temas", "Algoritmo", "Fontes"], f"{nome} · 4 abas na ordem", str(abas))
        txt = await pg.locator('#layer [data-act="ajaplica"]').inner_text()
        confere(bool(re.match(r"Ver \d+ conte", txt)), f"{nome} · botão Ver N conteúdos", txt)
        await clica(pg, '#layer [data-act="fchip"][data-g="conf"][data-v="75"]', 400)
        confere(await pg.locator('#layer [data-act="fclear"]:not([disabled])').count() == 1, f"{nome} · Limpar liga com filtro")
        await clica(pg, '#layer [data-act="fclear"]', 400)
        await clica(pg, '#layer [data-act="ajtab"][data-v="temas"]', 400)
        await clica(pg, '#layer [data-act="ttodos"]', 400)
        tot = await pg.locator('#layer [data-act="ttoggle"]').count(); on = await pg.locator('#layer [data-act="ttoggle"][aria-pressed="true"]').count()
        confere(tot > 0 and on == tot, f"{nome} · Selecionar tudo marca todos", f"{on} de {tot}")
        confere((await pg.locator('#layer [data-act="ttodos"]').inner_text()).strip() == "Desmarcar tudo", f"{nome} · vira Desmarcar tudo")
        await clica(pg, '#layer [data-act="ajtab"][data-v="algoritmo"]', 400)
        confere(await pg.locator('#layer .ajalg [data-act="ajalgo"]').count() == 1, f"{nome} · aba Algoritmo com o liga/desliga")
        confere(await pg.locator('#layer .ajresumo').count() == 0, f"{nome} · sem o resumo Como está seu feed")
        await clica(pg, '#layer [data-act="ajtab"][data-v="fontes"]', 400)
        confere(await pg.locator('#layer [data-act="origens"]').count() == 1, f"{nome} · aba Fontes com Países e línguas")
        confere(await sem_rolagem_lateral(pg), f"{nome} · sem rolagem lateral")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_fontes(b):
    nome = "fontes"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg); await clica(pg, '[data-act="adjust"]', 600)
        await clica(pg, '#layer [data-act="ajtab"][data-v="fontes"]', 400)
        await clica(pg, '#layer [data-act="origens"]', 700)
        confere(await pg.locator("#layer .sheet select").count() >= 1, f"{nome} · Países e línguas abre com a escolha de país")
        confere(await pg.locator("#layer .sheet .aclist button").count() >= 2, f"{nome} · idiomas em etiquetas")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_conta(b):
    nome = "conta (teste)"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg, teste=True); await pg.goto(BASE + "/?teste=1#conta"); await pg.wait_for_timeout(1200); await fecha_folha(pg)
        abas = [x.strip() for x in await pg.locator('[data-act="contaaba"]').all_inner_texts()]
        confere(all(a in abas for a in ["Perfil", "Algoritmo", "Dados"]), f"{nome} · abas Perfil, Algoritmo e Dados", str(abas))
        await clica(pg, '[data-act="contaaba"][data-a="algoritmo"]', 700)
        tits = await pg.locator(".apanel .acard h3").all_inner_texts()
        confere(tits == ["Do que é feito o seu feed", "Confiabilidade", "O que ele aprendeu", "Seus temas"], f"{nome} · Algoritmo com 4 cartões na ordem", str(tits))
        confere(await pg.locator(".apanel .acard:first-child .arow").count() <= 5, f"{nome} · só os 5 maiores temas")
        await clica(pg, '[data-act="ajtemas"]', 700)
        confere(await pg.locator('#layer .ajaba[aria-selected="true"]').inner_text() == "Temas", f"{nome} · Editar abre o Ajustar em Temas")
        await fecha_folha(pg)
        await clica(pg, '[data-act="contaaba"][data-a="dados"]', 700)
        confere(await pg.locator('[aria-label="Histórico"]').count() == 1, f"{nome} · Dados com o histórico")
        confere(await sem_rolagem_lateral(pg), f"{nome} · sem rolagem lateral")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_filtros(b):
    nome = "filtros (teste)"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg, teste=True); await clica(pg, '[data-act="adjust"]', 600)
        await clica(pg, '#layer [data-act="fchip"][data-g="conf"][data-v="75"]', 400)
        await clica(pg, '#layer [data-act="ajaplica"]', 300)
        await pg.reload(); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await clica(pg, '[data-act="adjust"]', 600)
        confere(await pg.locator('#layer [data-act="fchip"][data-g="conf"][data-v="75"][aria-pressed="true"]').count() == 1, f"{nome} · filtro continua depois de recarregar")
        await clica(pg, '#layer [data-act="fclear"]', 300); await clica(pg, '#layer [data-act="ajaplica"]', 500)
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_anuncio(b):
    nome = "anuncio"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg)
        for _ in range(8):
            if await pg.locator('.adcard').count(): break
            await pg.mouse.wheel(0, 2500); await pg.wait_for_timeout(500)
        n = await pg.locator('.adcard').count()
        confere(n >= 1, f"{nome} · card de anúncio no feed", "nenhum no feed")
        if await pg.locator('.adcard [data-act="adopen"]').count():
            await clica(pg, '.adcard [data-act="adopen"]', 700)
            confere(await folha(pg), f"{nome} · vitrine do anúncio abre")
            confere(await sem_rolagem_lateral(pg), f"{nome} · vitrine sem rolagem lateral")
        elif n: avisa(f"{nome} · vitrine", "só há o espaço 'Anuncie aqui' no feed agora")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_desinfo(b):
    nome = "desinfo"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg); await clica(pg, '[data-act="adjust"]', 600); await clica(pg, '#layer [data-act="ajtab"][data-v="algoritmo"]', 400)
        if await pg.locator('#layer [data-act="baixaver"]').count():
            await clica(pg, '#layer [data-act="baixaver"]', 800)
            confere(await pg.locator("#layer .sheet").count() >= 1 and await pg.evaluate("document.querySelector('#layer .sheet').innerText.length > 40"), f"{nome} · Ver conteúdos abre a lista")
        else: avisa(nome, "nenhum conteúdo de baixa confiança no feed agora; nada a abrir")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_abas(b):
    nome = "abas"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg)
        for k, rot in [("videos", "Canais"), ("radio", "Rádio"), ("arte", "Cultura"), ("documentos", "Oficiais")]:
            await clica(pg, f'[data-act="ftab"][data-tab="{k}"]', 1500)
            t = await pg.evaluate("document.querySelector('main') ? document.querySelector('main').innerText.length : 0")
            confere(t > 200, f"{nome} · {rot} abre com conteúdo", f"{t} letras")
            confere(await sem_rolagem_lateral(pg), f"{nome} · {rot} sem rolagem lateral")
        await clica(pg, '[data-act="ftab"][data-tab="tudo"]', 500)
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_rota(b, grupo, rota, extra=None, teste=False):
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg, teste); await pg.goto(BASE + "/" + ("?teste=1" if teste else "") + rota); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        t = await pg.evaluate("document.querySelector('main') ? document.querySelector('main').innerText.length : document.body.innerText.length")
        confere(t > 150, f"{grupo} · {rota} abre", f"{t} letras")
        confere(await sem_rolagem_lateral(pg), f"{grupo} · {rota} sem rolagem lateral")
        if extra: await extra(pg)
        confere(not erros, f"{grupo} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{grupo} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def x_eventos(pg):
    cortado = await pg.evaluate("""[...document.querySelectorAll('main .card, main .tcard')].filter(c => c.scrollWidth > c.clientWidth + 2).length""")
    confere(cortado == 0, "eventos · cartões sem texto cortado", f"{cortado} cortado(s)")

async def x_comunidades(pg):
    confere(await pg.locator(".pgtag").count() == 0, "comunidades · sem a etiqueta Página")
    if await clica(pg, 'main [data-act="openorg"]', 1500):
        if await clica(pg, '[data-act="orgaba"][data-a="regras"], [data-act="orgaba"][data-v="regras"]', 700):
            confere(await pg.evaluate("document.querySelector('main').innerText.length > 100"), "comunidades · aba Regras abre")
        else: avisa("comunidades · Regras", "a primeira comunidade não tem a aba Regras")

async def x_emalta(pg):
    confere(await pg.locator("main svg, main canvas, main .emvol, main .abars").count() >= 1, "emalta · gráfico aparece")

async def x_config(pg):
    confere(await pg.locator("main h2", has_text="Seu feed").count() == 1, "config · seção Seu feed")

async def x_publicar(pg):
    await clica(pg, '[data-act="create"]', 800)
    confere(await folha(pg), "publicar · formulário abre (sem enviar)")
    await fecha_folha(pg)

async def x_rodape(pg):
    await clica(pg, '[data-act="sobre"]', 700)
    txt = await pg.evaluate("(document.querySelector('.marcape') || {}).innerText || ''")
    confere("contato@arede.online" in txt, "rodape · contato no rodapé")
    confere(bool(re.search(r"versão\s*\S+", txt)), "rodape · versão no rodapé")

async def g_primeiro(b):
    nome = "primeiro"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await pg.goto(BASE + "/#inicio", wait_until="domcontentloaded", timeout=45000); await pg.wait_for_timeout(1500)
        c = pg.locator("#layer button", has_text="Continuar")
        confere(await c.count() >= 1, f"{nome} · escolha de idioma e país aparece")
        confere(await pg.locator("#layer select").count() >= 1, f"{nome} · escolha de país")
        if await c.count():
            await c.first.click(); await pg.wait_for_timeout(800)
            confere(await pg.locator("#layer button", has_text="Continuar").count() == 0, f"{nome} · Continuar fecha")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_busca(b):
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg); await pg.goto(BASE + "/#buscar"); await pg.wait_for_timeout(1200)
        q = pg.locator("#q")
        if await q.count():
            await q.fill("saúde"); await q.press("Enter"); await pg.wait_for_timeout(2000)
            confere(await pg.evaluate("document.body.innerText.length") > 200, "busca · responde")
        else: confere(False, "busca · campo de busca", "não encontrado")
        confere(not erros, "busca · sem erro de código", "; ".join(erros[:3]))
    finally:
        await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await g_seguranca(b); await g_sempre(b)
        G = set(GRUPOS)
        if "card" in G: await g_card(b)
        if "ajustar" in G: await g_ajustar(b)
        if "fontes" in G: await g_fontes(b)
        if "conta" in G: await g_conta(b)
        if "filtros" in G: await g_filtros(b)
        if "anuncio" in G: await g_anuncio(b)
        if "desinfo" in G: await g_desinfo(b)
        if "abas" in G: await g_abas(b)
        if "eventos" in G: await g_rota(b, "eventos", "#participar", x_eventos)
        if "comunidades" in G: await g_rota(b, "comunidades", "#organizacoes", x_comunidades)
        if "emalta" in G: await g_rota(b, "emalta", "#em-alta", x_emalta)
        if "config" in G: await g_rota(b, "config", "#config", x_config, teste=True)
        if "primeiro" in G: await g_primeiro(b)
        if "publicar" in G: await g_rota(b, "publicar", "#inicio", x_publicar, teste=True)
        if "rodape" in G: await g_rota(b, "rodape", "#inicio", x_rodape)
        if "busca" in G: await g_busca(b)
        if "institucional" in G:
            for r in ["#manifesto", "#termos", "#privacidade"]: await g_rota(b, "institucional", r)
        if "layout" in G:
            for w, escuro in ((390, True), (1280, False)):
                await g_sempre(b, w, escuro, "layout"); await g_card(b, w, escuro, "layout")
        await b.close()
    json.dump({"base": BASE, "grupos": GRUPOS, "certos": len(certos), "falhas": falhas, "avisos": avisos}, open(f"{OUT}/resultado.json", "w"), ensure_ascii=False, indent=1)
    print(f"\nGrupos: {', '.join(GRUPOS)}\n{len(certos)} certos, {len(falhas)} falhas, {len(avisos)} avisos")
    sys.exit(1 if falhas else 0)

asyncio.run(main())

"""Testes do site, por grupos (20/11/2026).

Abre o site num navegador de verdade e confere o que um visitante (e o modo de teste, que simula uma conta) usa.
Não cria nada e não envia nada: nenhum formulário é enviado, nenhuma denúncia, nenhum comentário.

Grupos:
  sempre        roda em toda publicação: segurança (e-mail e painel), feed, card abre com selo, sem erro, sem rolagem lateral
  voltar        o Voltar do aparelho fecha a folha aberta (25/11)
  card          card aberto: selo, (i) da nota, Contestar, Ajustar do card, Denunciar na barra
  ajustar       folha Ajustar: 4 abas, Selecionar tudo, Limpar, Ver N conteúdos
  fontes        Ajustar › Fontes › Países e línguas
  conta         Sua conta (modo de teste): Algoritmo com 4 cartões, Editar abre Temas, Dados com histórico
  filtros       filtro salvo continua depois de recarregar (modo de teste)
  anuncio       card de anúncio e vitrine aberta
  desinfo       aviso de baixa confiança: Ver conteúdos abre a lista
  abas          Canais, Rádio, Cultura, Transparência
  eventos       aba Para participar: cartões inteiros
  comunidades   lista e página de comunidade (Regras); sem etiqueta Página
  emalta        Em alta com o gráfico
  config        Configurações › Seu feed
  primeiro      primeiro acesso: idioma e país
  boasvindas    boas-vindas de quem chega sem conta: 5 passos até 31/12 (o último, dos convites), depois idioma; por link direto, a faixa
  publicar      formulário de publicar abre (sem enviar)
  rodape        rodapé da marca: contato e versão
  busca         busca responde
  institucional Manifesto, Termos, Privacidade, Como funciona (11 regras)
  instalavel    site instalável: manifesto, ícones e trabalhador no ar; Notificações com o resumo por e-mail (só com o "sim" da pessoa) e sem avisos no celular enquanto estiver desligado
  redes         redes conectadas: prévia antes de conectar e xadrez com tabuleiro (com --offline, modo de teste)
  resumo        resumo da semana e do mês, faixa de quem volta e Em alta por período (com --offline, modo de teste)
  marco         regras de conduta, bloquear pessoa, completar cadastro (Google) e o login novo (com --offline, modo de teste)
  csat          pesquisa de satisfação: aparece uma vez e só volta depois de 7 dias (relógio adiantado)
  logado        conta de teste logada de verdade (só com TESTE_CHAVE; só lê, sem fotos da tela)
  acoes         padrão de ações e o que entrou em 26/11: botões de 40 px e sem "0", comentário com Apoio e ⋯, card de texto sem sobrepor,
                pastas com cartões (sem mosaico), Canais e Rádio com busca e filtros, seção Discussões, pedido de localização
  mapa          mapa de Museus, Eventos, Páginas e Comunidades: estrutura no celular e no computador, Lista/Mapa, leitor do mapa do próprio site
  atividades    Cultura › Atividades no modo real: Brasil | Mundo (Mundo em lista por cidade, sem Mapa, com busca), cartões de exemplo
                com a etiqueta exemplo enquanto não há conteúdo real (Atividades e Organizações), folha da atividade (27/11)
  layout        repete sempre + card no celular escuro e no computador
  tudo          todos os grupos (antes de cada #DISPARAR SYNC)

Uso: python3 testes/site.py URL [--offline] [--grupos sempre,card,...]
"""
import asyncio, json, sys, os, re
from playwright.async_api import async_playwright

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "https://arede.online"
OFFLINE = "--offline" in sys.argv
GRUPOS_TODOS = ["voltar", "logado", "seguir", "redes", "resumo", "marco", "sempre", "card", "ajustar", "fontes", "conta", "filtros", "anuncio", "desinfo", "abas", "eventos", "comunidades",
                "emalta", "config", "primeiro", "boasvindas", "publicar", "rodape", "busca", "institucional", "instalavel", "csat", "acoes", "layout", "mapa", "atividades"]
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

async def abre_contexto(b, w=390, escuro=False, locale="pt-BR"):
    ctx = await b.new_context(viewport={"width": w, "height": 844 if w < 600 else 900}, color_scheme="dark" if escuro else "light", locale=locale)
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
        await pg.locator('[data-act="open"], [data-act="topen"]').nth(i).evaluate("e => e.click()"); await pg.wait_for_timeout(1100)   # 23/11: clique direto (o topo fixo cobria o card ao rolar)
        if await pg.locator(".pinseal .sealbox").count():
            achou = True
            if not contestar or await pg.locator('.pinseal [data-act="contestar"], .pinseal [data-act="contest"]').count(): return True
    return achou

# ---------- grupos ----------

async def g_voltar(b):
    """25/11 (revisão): o Voltar do aparelho fecha a folha aberta e não deixa folha por cima de outra tela."""
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg, teste=True, rota="#perfil"); await pg.wait_for_timeout(1200)
        ed = pg.locator('#main [data-act]').filter(has_text="Editar").first
        if not await ed.count(): return avisa("voltar", "sem botão Editar no perfil")
        antes = await pg.evaluate("location.pathname")
        await ed.evaluate("e => e.click()"); await pg.wait_for_timeout(600)
        confere(await folha(pg), "voltar · a folha abre")
        await pg.go_back(); await pg.wait_for_timeout(800)
        confere(not await folha(pg) and await pg.evaluate("location.pathname") == antes and not await pg.evaluate("document.body.classList.contains('locked')"), "voltar · o Voltar fecha a folha e fica na mesma tela")
        await ed.evaluate("e => e.click()"); await pg.wait_for_timeout(600); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(600)
        await pg.go_back(); await pg.wait_for_timeout(900)
        confere(await pg.evaluate("location.pathname") != antes, "voltar · depois de fechar a folha, o Voltar troca de tela de primeira")
        confere(not erros, "voltar · sem erro de código", "; ".join(erros[:2]))
    finally: await ctx.close()

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
        confere(await pg.locator('#layer #origordem').count() == 1 and await pg.locator('#layer [data-act="sugfonte"]').count() == 1, f"{nome} · Fontes tem Perto de você e Sugerir uma fonte")
        await clica(pg, '#layer [data-act="origens"]', 700)
        confere(await pg.locator('#layer #origordem').count() == 0 and await pg.locator('#layer [data-act="sugfonte"]').count() == 0, f"{nome} · Países e línguas só com idiomas e país")
        confere(await pg.locator("#layer .sheet select").count() >= 1, f"{nome} · Países e línguas abre com a escolha de país")
        confere(await pg.locator("#layer .sheet .aclist button").count() >= 2, f"{nome} · idiomas em etiquetas")
        # 24/11: convite para sugerir fontes, uma vez só, depois do convite dos temas leves
        await pg.evaluate("()=>{ localStorage.setItem('arede-levesConvite', '1'); localStorage.removeItem('arede-fontesConvite'); }")
        await pg.goto(BASE + "/#inicio"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        tem = await pg.locator("#fontesconv").count()
        txt = (await pg.locator("#fontesconv").inner_text()) if tem else ""
        confere(tem == 1 and "Sugira fontes confiáveis" in txt, f"{nome} · convite para sugerir fontes aparece", txt[:80])
        if tem: await pg.locator('#fontesconv [data-act="fontesconvfecha"]').evaluate("e => e.click()"); await pg.wait_for_timeout(300)
        await pg.goto(BASE + "/#inicio"); await pg.wait_for_timeout(1200)
        confere(await pg.locator("#fontesconv").count() == 0, f"{nome} · convite some depois de fechar")
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
        # 21/11: o formulário de quem anuncia é uma parte sob demanda: só baixa ao abrir Anunciar
        partes = []; pg.on("request", lambda r: partes.append(r.url) if "/parte-" in r.url else None)
        await pg.goto(BASE + "/#anunciar"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        confere("Anuncie aqui" in await pg.evaluate("document.querySelector('main').innerText"), f"{nome} · Anunciar abre o formulário")
        await pg.fill("#adnome", "Teste"); await pg.wait_for_timeout(300)
        confere("Teste" in await pg.evaluate("document.querySelector('main').innerText"), f"{nome} · prévia do anúncio acompanha o texto")
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
        for k, rot in [("videos", "Canais"), ("radio", "Rádio"), ("arte", "Cultura"), ("documentos", "Transparência")]:
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

async def g_mapa(b):
    """27/11: mapa (Museus, Eventos, Páginas, Comunidades). Só abre telas. Confere a estrutura nos dois tamanhos, o botão Mapa nas abas,
    Lista/Mapa no celular e que o leitor do mapa (MapLibre, servido pelo próprio site) carrega. O desenho vem do OpenFreeMap (sem internet, o mapa abre só com o fundo e os pontos)."""
    nome = "mapa"
    for w in (390, 1280):
        ctx, pg, erros = await abre_contexto(b, w)
        try:
            await entra(pg, teste=True); await pg.wait_for_timeout(800); await fecha_folha(pg)
            await pg.evaluate("location.hash = '#organizacoes/cultura'"); await pg.wait_for_timeout(1500)
            confere(await pg.locator('#evsec .partchips .mpchip[data-act="mapabox"][data-t="eventos"]').count() == 1, f"{nome} · {w} · botão Mapa em Eventos, primeiro da fila",
                    "faltou")
            confere(await pg.locator('#evsec .mpbox').count() == 1, f"{nome} · {w} · Atividades abre no mapa", "abriu nos cartões")
            confere(await pg.locator('#evsec #evq').count() == 1, f"{nome} · {w} · Atividades tem busca", "faltou")
            await clica(pg, '#evsec [data-act="mapabox"]', 800)
            confere(await pg.locator('#evsec .mpbox').count() == 0 and await pg.locator('#evsec .partgrid, #evsec .empty').count() >= 1, f"{nome} · {w} · Mapa de novo mostra os cartões", "")
            await clica(pg, '#evsec [data-act="mapabox"]', 2500)
            cx = await pg.evaluate("(() => { const m = document.querySelector('#evsec .mpbox'); return {caixa: !!m, rota: location.pathname, alt: m ? m.getBoundingClientRect().height : 0, lateral: document.documentElement.scrollWidth <= innerWidth + 1}; })()")
            confere(cx["caixa"] and "mapa-" not in cx["rota"] and cx["alt"] >= 300 and cx["lateral"], f"{nome} · {w} · mapa de Eventos abre dentro da caixa, sem trocar de página", str(cx))
            await clica(pg, '#evsec [data-act="mapabox"]', 600)
            for aba, mt in (("paginas", "paginas"), ("orgs", "grupos")):
                await clica(pg, f'.tab[data-t="{aba}"]', 1200)
                ordem = await pg.evaluate("[...document.querySelectorAll('.qf > *')].slice(0, 2).map(b => (b.dataset.act || '') + ':' + b.textContent.trim())")
                confere(len(ordem) == 2 and "Tod" in ordem[0] and ordem[1] == "mapabox:Mapa", f"{nome} · {w} · {aba}: primeiro Todos, depois Mapa", str(ordem))
                await clica(pg, '.qf [data-act="mapabox"]', 2500)
                confere(await pg.locator('.container > .mpbox').count() == 1 and "mapa-" not in await pg.evaluate("location.pathname"), f"{nome} · {w} · {aba}: mapa no lugar da lista, sem trocar de página", "")
            await clica(pg, '.tab[data-t="cultura"]', 1500)
            confere(await pg.locator('#evsec .mpbox').count() >= 0, f"{nome} · {w} · volta para Eventos",
                    "faltou")
            await pg.evaluate("location.hash = '#mapa-museus'"); await pg.wait_for_timeout(4000)
            r = await pg.evaluate("""(() => ({mpv: !!document.querySelector('#mpv'), fil: document.querySelectorAll('#mpfil .chip').length, busca: !!document.querySelector('#mpq'),
              zoom: document.querySelectorAll('.mpzoom button').length, perto: !!document.querySelector('.mpperto[aria-label]'), cred: (document.querySelector('.mpcred') || {}).href || '',
              lib: !!window.maplibregl, canvas: !!document.querySelector('#mpgl canvas'), alt: document.querySelector('#mpcorpo') ? document.querySelector('#mpcorpo').getBoundingClientRect().height : 0,
              lateral: document.documentElement.scrollWidth <= innerWidth + 1, alterna: getComputedStyle(document.querySelector('#mpalterna')).display}))()""")
            confere(r["mpv"] and r["fil"] >= 2 and r["busca"] and r["zoom"] == 2 and r["perto"], f"{nome} · {w} · filtros, busca, zoom e perto de você", str(r))
            confere("openstreetmap.org/copyright" in r["cred"], f"{nome} · {w} · crédito do OpenStreetMap com link", r["cred"])
            confere(r["lib"] and r["canvas"], f"{nome} · {w} · leitor do mapa carrega do próprio site", str(r))
            confere(r["alt"] >= 380 and r["lateral"], f"{nome} · {w} · mapa com altura e sem rolagem lateral", str(r))
            if w == 390:
                confere(r["alterna"] != "none", f"{nome} · celular · botão Lista/Mapa", r["alterna"])
                await clica(pg, "#mpalterna", 500)
                m = await pg.evaluate("document.querySelector('#mpv').dataset.modo + '|' + getComputedStyle(document.querySelector('#mplista')).display")
                confere(m.startswith("lista|") and not m.endswith("none"), f"{nome} · celular · Lista mostra a lista", m)
            else:
                d = await pg.evaluate("getComputedStyle(document.querySelector('#mplista')).display + '|' + getComputedStyle(document.querySelector('#mpmapa')).display + '|' + getComputedStyle(document.querySelector('#mpalterna')).display")
                confere(d.split("|")[0] != "none" and d.split("|")[1] != "none" and d.split("|")[2] == "none", f"{nome} · computador · lista e mapa lado a lado", d)
            await pg.evaluate("location.hash = '#mapa-cultura'"); await pg.wait_for_timeout(1500)
            confere(await pg.locator('#mpv[data-t="cultura"] .mpleg span').count() == 2, f"{nome} · {w} · mapa de Eventos e cultura com museus e eventos", "")
            await pg.evaluate("location.hash = '#mapa-grupos'"); await pg.wait_for_timeout(1500)
            confere(await pg.locator('#mpv[data-t="grupos"]').count() == 1, f"{nome} · {w} · mapa de Comunidades abre", "")
            confere(not erros, f"{nome} · {w} · sem erro de JavaScript", "; ".join(erros[:3]))
        finally:
            await ctx.close()

async def g_acoes(b):
    """26/11: um padrão de ações no site todo e o que entrou no mesmo dia. Só lê e abre telas; o único envio é um comentário no modo de teste (simulado)."""
    nome = "acoes"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg, teste=True); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        # botões do card: 40 px, e o tipo do card de texto não fica embaixo deles
        med = await pg.evaluate("""(() => { const b = [...document.querySelectorAll('#feed .cdacts .cact')]; if (!b.length) return null; const r = b[0].getBoundingClientRect();
          let sobre = 0; document.querySelectorAll('#feed .facewrap').forEach(w => { const a = w.querySelector(':scope > .cdacts'), k = w.querySelector('.thead .fkind, .thead .tseal'); if (!a || !k || w.querySelector('img,video')) return;
            const x = a.getBoundingClientRect(); w.querySelectorAll('.thead > *').forEach(e => { const y = e.getBoundingClientRect(); if (y.width && y.right > x.left + 2 && y.top < x.bottom - 2 && y.bottom > x.top + 2) sobre++; }); });
          return {w: Math.round(r.width), h: Math.round(r.height), sobre, mosaico: document.querySelectorAll('#feed .tile').length}; })()""")
        if med:
            confere(med["w"] >= 34 and med["h"] >= 40, f"{nome} · Repostar, Salvar e Curtir do card com 34 × 40 px (28/11: três ações numa linha)", f"{med['w']}x{med['h']}")
            confere(med["sobre"] == 0, f"{nome} · no card de texto nada fica embaixo de Salvar e Curtir", f"{med['sobre']} sobreposição(ões)")
            confere(med["mosaico"] == 0, f"{nome} · feed sem o mosaico aposentado", f"{med['mosaico']} blocos")
        else: confere(False, f"{nome} · Salvar e Curtir no card", "não achei os botões")
        # card aberto: curtir sem "0"
        await clica(pg, '#feed [data-act="open"]', 1200)
        cnt = await pg.evaluate("[...document.querySelectorAll('.pinbar [data-act=\"like\"] .cnt')].map(e => e.textContent.trim())")
        confere("0" not in cnt, f"{nome} · card aberto sem o número 0 no coração", str(cnt))
        await fecha_folha(pg); await pg.keyboard.press("Escape")
        # pastas: os mesmos cartões do Início, sem mosaico
        await pg.goto(BASE + "/?teste=1#perfil"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await clica(pg, '[data-act="ptab"][data-tab="salvos"]', 900)
        if await clica(pg, '#pbody [data-act="openfolder"][data-f]:not([data-f=""]):not([data-f^="aovivo"])', 1200):
            t = await pg.evaluate("[document.querySelectorAll('#pfeed .tile').length, document.querySelectorAll('#pfeed [data-act=\"open\"]').length]")
            confere(t[0] == 0 and t[1] >= 1, f"{nome} · pasta mostra cartões, sem mosaico", f"{t[0]} blocos, {t[1]} cartões")
        else: avisa(f"{nome} · pasta", "nenhuma pasta para abrir no modo de teste")
        # Canais e Rádio: busca, filtros e lista
        await pg.goto(BASE + "/?teste=1#inicio"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await clica(pg, '[data-act="ftab"][data-tab="videos"]', 1800)
        c = await pg.evaluate("[!!document.querySelector('#aovivo #lvq'), (document.querySelector('#aovivo .cnfil .rdf') || {}).textContent || '', document.querySelectorAll('#aovivo .cnrow').length]")
        confere(c[0] and "No ar agora" in c[1], f"{nome} · Canais com busca e No ar agora primeiro", f"busca {c[0]}, 1º filtro {c[1][:20]!r}")
        await clica(pg, '#aovivo [data-act="vivofil"][data-f="todos"]', 500)
        n0 = await pg.locator("#aovivo .cnrow").count()
        confere(n0 >= 3, f"{nome} · Canais › Todos lista os canais", f"{n0} canais")
        await pg.locator("#lvq").fill("senado"); await pg.wait_for_timeout(400)
        n1 = await pg.locator("#aovivo .cnrow").count()
        confere(1 <= n1 < n0, f"{nome} · busca de canal filtra a lista", f"{n0} → {n1}")
        await pg.locator("#lvq").fill(""); await pg.wait_for_timeout(300)
        confere(await sem_rolagem_lateral(pg), f"{nome} · Canais sem rolagem lateral")
        await clica(pg, '[data-act="ftab"][data-tab="radio"]', 1500)
        r = await pg.evaluate("[!!document.querySelector('#radio #rdq'), document.querySelectorAll('#radio .cnrow').length]")
        confere(r[0] and r[1] >= 1, f"{nome} · Rádio com busca e lista", f"busca {r[0]}, {r[1]} rádios")
        confere(await sem_rolagem_lateral(pg), f"{nome} · Rádio sem rolagem lateral")
        # comentário: Apoio embaixo e ⋯ no topo, com as ações à vista (o erro de 26/11 jogava tudo para o canto)
        jim = "00000000-0000-4000-8000-000000000002"
        await pg.goto(BASE + "/?teste=1#org-u-" + jim); await pg.wait_for_timeout(2200); await fecha_folha(pg)
        await clica(pg, '[data-act="open"]', 1800)
        if await pg.locator(".cnovo .ctxt").count():
            await pg.locator(".cnovo .ctxt").first.fill("Comentário de teste das ações"); await pg.locator(".cnovo .ctxt").first.dispatch_event("input"); await clica(pg, ".cnovo .cbt", 1600)
            if await pg.locator('[data-act="regrasok"]').count(): await clica(pg, '[data-act="regrasok"]', 2000)
            k = await pg.evaluate("""(() => { const c = [...document.querySelectorAll('.com')].pop(); if (!c) return null; const a = c.querySelector('.cacts');
              return {apoio: !!c.querySelector('.cacts [data-act="comutil"]'), menu: !!c.querySelector('.comh .dmenu'), pos: a ? getComputedStyle(a).position : '', util: c.innerText.includes('Útil')}; })()""")
            if k:
                confere(k["apoio"] and k["menu"], f"{nome} · comentário com Apoio embaixo e ⋯ no topo", str(k))
                confere(k["pos"] == "static", f"{nome} · ações do comentário no lugar (não no canto)", k["pos"])
                confere(not k["util"], f"{nome} · comentário diz Apoio, não Útil")
            else: confere(False, f"{nome} · comentário publicado", "não apareceu")
        else: avisa(f"{nome} · comentário", "sem campo de comentário no modo de teste")
        # seção Discussões e pedido de localização: só quando há dados
        await pg.goto(BASE + "/?teste=1#organizacoes"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        if await pg.locator("#discsec .dsc").count():
            await clica(pg, "#discsec .dsc", 900)
            confere(await pg.locator("#layer .ddet").count() == 1, f"{nome} · cartão da discussão abre o detalhe")
            await fecha_folha(pg)
        else: avisa(f"{nome} · seção Discussões", "sem discussões no modo de teste")
        await pg.goto(BASE + "/?teste=1#inicio"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        if await pg.locator("#locconv").count():
            await clica(pg, '#locconv [data-act="locpede"]', 600)
            confere(await pg.locator('#layer [data-act="localescreve"]').count() == 1, f"{nome} · Permitir abre a folha com Escrever a cidade")
            await fecha_folha(pg)
        else: avisa(f"{nome} · pedido de localização", "a conta de teste já tem cidade")
        confere(not erros, f"{nome} · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, f"{nome} · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

# 27/11 (Amanda, item 3): atividades, Mundo e cartões de exemplo. Só lê: não marca Vou, não cria, não denuncia.
async def g_atividades(b):
    ctx, pg, erros = await abre_contexto(b)
    real = "" if "arede.online" in BASE else "?real=1"
    try:
        await pg.goto(BASE + "/" + real + "#inicio", wait_until="domcontentloaded", timeout=45000); await pg.wait_for_timeout(1200)
        c = pg.locator("#layer button", has_text="Continuar")
        if await c.count(): await c.first.click(); await pg.wait_for_timeout(400)
        await fecha_folha(pg)
        await pg.evaluate("location.hash = '#organizacoes/cultura'"); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""() => { const s = document.querySelector('#evsec'); if (!s) return null;
          return {h: (s.querySelector('h2') || {}).innerText || '', br: !!s.querySelector('[data-act=evonde][data-v=br]'), mundo: !!s.querySelector('[data-act=evonde][data-v=mundo]'),
            mapa: !!s.querySelector('[data-act=mapabox][data-t=eventos]'), ex: s.querySelectorAll('.extag').length}; }""")
        confere(bool(r) and r["h"] == "Atividades", "atividades · seção Atividades em Cultura", str(r))
        if not r: return
        confere(r["br"] and r["mundo"], "atividades · chips Brasil e Mundo", str(r))
        confere(r["mapa"], "atividades · Brasil tem o botão Mapa")
        if OFFLINE: confere(r["ex"] >= 1, "atividades · sem conteúdo real, aparece cartão com a etiqueta exemplo", f"{r['ex']} etiquetas")
        # 28/11 (Amanda): Brasil e Mundo no mesmo padrão; mapa continua mapa, cartões continuam cartões
        await clica(pg, '#evsec [data-act="evonde"][data-v="mundo"]', 1500)
        m = await pg.evaluate("""() => { const s = document.querySelector('#evsec');
          return {sub: (s.querySelector('.dsech p') || {}).innerText || '', mapa: !!s.querySelector('[data-act=mapabox][data-t=mundo]'), busca: !!s.querySelector('#evq'),
            caixa: !!s.querySelector('.mpbox'), cid: !!s.querySelector('[data-act=evcid]'), setas: !!s.querySelector('.dsarr')}; }""")
        confere("fora do Brasil" in m["sub"] and m["mapa"] and m["busca"] and m["setas"], "atividades · Mundo com a mesma faixa de Brasil (Mapa, busca, setas)", str(m))
        confere(m["caixa"], "atividades · de Brasil no mapa para Mundo: continua no mapa", str(m))
        await clica(pg, '#evsec [data-act="mapabox"][data-t="mundo"]', 1200)   # Mundo em cartões
        for _ in range(8):
            t = await pg.evaluate("(document.querySelector('#evsec .evmundo') || {}).innerText || ''")
            if "Carregando" not in t: break
            await pg.wait_for_timeout(1000)
        confere(await pg.locator("#evsec .evmundo").count() == 1 and await pg.locator("#evsec .mpbox").count() == 0, "atividades · Mundo em cartões", t[:80])
        await clica(pg, '#evsec [data-act="evonde"][data-v="br"]', 1000)
        confere(await pg.locator("#evsec .mpbox").count() == 0 and await pg.locator('#evsec [data-act="mapabox"][data-t="eventos"]').count() == 1, "atividades · de Mundo em cartões para Brasil: continua em cartões")
        await clica(pg, '#evsec [data-act="mapabox"][data-t="eventos"]', 1200); await clica(pg, '#evsec [data-act="mapabox"][data-t="eventos"]', 1200)   # mapa e volta
        if await pg.locator('#evsec [data-act="mapabox"][data-t="eventos"][aria-pressed="true"]').count():
            await clica(pg, '#evsec [data-act="mapabox"][data-t="eventos"]', 1200)
        if await clica(pg, "#evsec .atpcard", 1000):
            f = await pg.evaluate("""() => { const s = document.querySelector('#layer .sheet'); if (!s) return null; const ex = !!s.querySelector('.extag');
              return {ex, vou: !!s.querySelector('[data-act=atpvou]'), den: !!s.querySelector('[data-act=atpden]'), nota: s.innerText.includes('Atividade de exemplo'), quem: !!s.querySelector('a.setting')}; }""")
            confere(bool(f) and f["quem"], "atividades · folha da atividade abre com quem organiza", str(f))
            if f: confere((f["ex"] and f["nota"] and not f["vou"] and not f["den"]) or (not f["ex"] and f["vou"] and f["den"]),
                          "atividades · exemplo sem Vou nem Denunciar; real com Vou e Denunciar", str(f))
            await fecha_folha(pg)
        else: avisa("atividades · folha", "nenhuma atividade de página na lista agora")
        await pg.evaluate("location.hash = '#organizacoes'"); await pg.wait_for_timeout(2000)
        o = await pg.evaluate("() => ({vila: document.querySelector('main').innerText.includes('Vila Aurora'), ex: document.querySelectorAll('main .extag').length})")
        if OFFLINE: confere(o["vila"] and o["ex"] >= 1, "atividades · Organizações: organização de exemplo com a etiqueta", str(o))
        elif o["vila"]: confere(o["ex"] >= 1, "atividades · Organizações: exemplo sempre com a etiqueta", str(o))
        confere(await sem_rolagem_lateral(pg), "atividades · sem rolagem lateral")
        confere(not erros, "atividades · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "atividades · roteiro completo", str(e)[:200])
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

# 22/11 (Amanda): Transparência virou parte do Como funciona (11 regras, sem a faixa de números); #transparencia leva para lá
async def x_funciona(pg):
    await pg.wait_for_function("(location.hash === '#funciona' || location.pathname === '/funciona') && document.querySelector('.env .erow')", timeout=8000)   # 23/11: endereço limpo
    n = await pg.locator(".env .erow").count()
    confere(n == 11, "institucional · Como funciona com 11 regras", f"{n} regras")
    t = await pg.evaluate("document.querySelector('.env').innerText")
    confere("Selo de confiança" in t and "não estão à venda" in t and "pontos por notícia" not in t and "Em números" not in t, "institucional · Como funciona com as regras novas, sem números nem conta do histórico", t[:120])

# 22/11 (Amanda): marco "Evoluir o produto na web". Aceite das regras antes do 1º comentário e bloqueio completo (só no modo de teste)
async def g_seguir(b):
    """22/11: seguir entre pessoas é pedido e aceite; topo com pílula, Compartilhar e ⋯; pastas editáveis e apagáveis."""
    ctx, pg, erros = await abre_contexto(b)
    jim, c3 = "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"
    pil = '.phd .pfacoes .btn:first-child'
    try:
        await entra(pg, teste=True); await pg.goto(BASE + "/?teste=1#org-u-" + c3); await pg.wait_for_timeout(2200); await fecha_folha(pg)
        confere((await pg.locator(pil).first.inner_text()).strip() == "Seguir", "seguir · pessoa mostra a pílula Seguir")
        confere(await pg.locator('.phacoes > [data-act="topomais"] + .topfixo').count() == 1 and await pg.locator('.phacoes .topacao.pil').count() == 0, "seguir · topo: só o ⋯ e, na ponta, o sino")
        confere(await pg.locator('.phd .pfacoes [data-act="msgcom"] + .pfshare[data-act="share"]').count() == 1, "seguir · Seguir, Mensagem e Compartilhar numa linha só, abaixo do nome")
        confere(await pg.locator('#topconta a').count() == 1, "seguir · mensagens e notificações num ícone só")
        await clica(pg, pil, 1500)
        confere((await pg.locator(pil).first.inner_text()).strip() == "Pedido enviado", "seguir · tocar em Seguir envia o pedido")
        await clica(pg, pil, 1500)
        confere((await pg.locator(pil).first.inner_text()).strip() == "Seguir", "seguir · tocar de novo cancela o pedido")
        await pg.goto(BASE + "/?teste=1&v=2#org-u-" + jim); await pg.wait_for_timeout(2200); await fecha_folha(pg)
        confere(await pg.locator('.segped [data-act="segaceita"]').count() == 1 and await pg.locator('.segped [data-act="segrecusa"]').count() == 1, "seguir · quem pediu aparece com Aceitar e Recusar")   # 25/11: faixa no perfil
        await clica(pg, '.phacoes [data-act="topomais"]', 700)
        confere(await pg.locator('#layer [data-act="topolink"]').count() == 1 and await pg.locator('#layer [data-act="segrecusa"]').count() == 1 and await pg.locator('#layer [data-act="bloqpede"]').count() == 1, "seguir · ⋯ tem Copiar link, Recusar e Bloquear")
        await fecha_folha(pg)
        await clica(pg, '.segped [data-act="segaceita"]', 1500)
        confere((await pg.locator(pil).first.inner_text()).strip() == "Seguindo", "seguir · aceitar cria o vínculo dos dois lados")
        await clica(pg, pil, 700); await clica(pg, '#layer [data-act="segdesfaz"]', 1500)
        confere((await pg.locator(pil).first.inner_text()).strip() == "Seguir", "seguir · deixar de seguir desfaz o vínculo")
        await pg.goto(BASE + "/?teste=1#alta"); await pg.wait_for_timeout(1500)
        confere(await pg.locator('[data-act="altarec"]').count() == 0, "seguir · Em alta sem Atualizar")
        # pastas: ⋯ no card abre editar; renomear e apagar ficam guardados
        await pg.goto(BASE + "/?teste=1#perfil"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await pg.evaluate("()=>{ const t = [...document.querySelectorAll('.tab')].find(x=>/Pastas|Salvos/.test(x.innerText)); t && t.click(); }"); await pg.wait_for_timeout(700)
        confere(await pg.locator('.bmais[data-f="salvos"]').count() == 0, "pastas · Salvos não tem ⋯")
        await clica(pg, '.bmais[data-f="ideias"]', 700)
        confere(await folha(pg, "Editar pasta"), "pastas · ⋯ no card abre Editar pasta")
        await pg.fill("#pastanome", "Ideias do bairro"); await clica(pg, '#layer [data-act="pastasalva"]', 800)
        await pg.goto(BASE + "/?teste=1&v=3#perfil"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await pg.evaluate("()=>{ const t = [...document.querySelectorAll('.tab')].find(x=>/Pastas|Salvos/.test(x.innerText)); t && t.click(); }"); await pg.wait_for_timeout(700)
        confere(await pg.evaluate("document.body.innerText.includes('Ideias do bairro')"), "pastas · nome novo continua depois de recarregar")
        await clica(pg, '.bmais[data-f="ideias"]', 700); await clica(pg, '#layer [data-act="pastaapaga"]', 400); await clica(pg, '#layer [data-act="pastaapaga"]', 900)
        await pg.goto(BASE + "/?teste=1&v=4#perfil"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await pg.evaluate("()=>{ const t = [...document.querySelectorAll('.tab')].find(x=>/Pastas|Salvos/.test(x.innerText)); t && t.click(); }"); await pg.wait_for_timeout(700)
        confere(await pg.locator('.bmais[data-f="ideias"]').count() == 0 and await pg.locator('.bmais[data-f="leituras"]').count() == 1, "pastas · pasta apagada não volta depois de recarregar")
        await clica(pg, '[data-act="lixpastas"]', 700); await clica(pg, '#layer [data-act="lixvolta"]', 900)
        confere(await pg.locator('.bmais[data-f="ideias"]').count() == 1, "pastas · apagada pode ser recuperada (15 dias)")
        # 22/11: Publicar à mão no seu perfil; no site de verdade o perfil novo nasce sem exemplos
        await pg.goto(BASE + "/?teste=1&v=5#perfil"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        # 28/11 (Amanda): o botão sempre se chama Criar; o convite, só Convidar
        rot = await pg.evaluate("(()=>{ const t=s=>{ const e=document.querySelector(s); return e ? e.innerText.replace(/\\s+/g,' ').trim() : ''; }; return [t('.pfacoes [data-act=create]'), t('.pfacoes [data-act=convidar]')]; })()")
        confere(rot == ["Criar", "Convidar"], "perfil · botões se chamam Criar e Convidar", str(rot))
        await clica(pg, '.pfacoes [data-act="create"]', 800)
        confere(await folha(pg, "Criar"), "perfil · botão Criar abre Criar")
        ctx2 = await b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR"); pg2 = await ctx2.new_page()
        await pg2.route("**/*", lambda r: r.continue_() if ("localhost" in r.request.url) else r.abort())
        await pg2.goto(BASE + "/?real=1#perfil"); await pg2.wait_for_timeout(2500)
        await pg2.evaluate("()=>{ const t = [...document.querySelectorAll('.tab')].find(x=>/Pastas|Salvos/.test(x.innerText)); t && t.click(); }"); await pg2.wait_for_timeout(600)
        txt = await pg2.evaluate("document.body.innerText + JSON.stringify(localStorage)")
        confere("Ideias para o bairro" not in txt and "Leituras da assembleia" not in txt and "hortas-leste" not in txt and "13-0" not in txt, "perfil · no site de verdade não há pastas, curtidas nem organizações de exemplo")
        await ctx2.close()
        # 22/11: encontrar pessoas na Busca pelo nome, sem o link
        await pg.goto(BASE + "/?teste=1&v=6#explorar"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await pg.fill("#q", "jim"); await pg.wait_for_timeout(1500)
        confere(await pg.locator('#expessoas a[href="#org-u-00000000-0000-4000-8000-000000000002"]').count() == 1, "busca · encontra a pessoa pelo nome")
        await pg.click('#expessoas a.rowitem'); await pg.wait_for_timeout(1500)
        confere("org-u-00000000-0000-4000-8000-000000000002" in pg.url or "/@maria_teste" in pg.url, "busca · tocar abre o perfil da pessoa")
        # 22/11: aba Conexões no seu perfil: pedidos, pessoas, páginas e quem vê
        await pg.goto(BASE + "/?teste=1&v=7#perfil"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        await clica(pg, '[data-act="ptab"][data-tab="conexoes"]', 1500)
        confere(await pg.locator('#conxbody [data-act="conxvis"]').count() == 3, "conexões · escolha de quem vê (3 opções)")
        await clica(pg, '#conxbody [data-act="conxvis"][data-v="cadastrados"]', 900)
        confere(await pg.locator('#conxbody [data-act="conxvis"][data-v="cadastrados"][aria-checked="true"]').count() == 1, "conexões · escolha fica marcada")
        confere(await pg.locator('[data-act="ptab"][data-tab="conexoes"] .tvis').count() == 0, "conexões · aba sem cadeado quando aberta")
        # 22/11: quem não tem @ recebe uma sugestão tirada do nome e confirma
        await pg.evaluate("()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); const p = db.t.perfis.find(x=>x.id === '00000000-0000-4000-8000-000000000001'); p.usuario = null; localStorage.setItem('arede-teste-db', JSON.stringify(db)); }")
        await pg.goto(BASE + "/?teste=1&v=8#perfil"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await clica(pg, '.pfcheck [data-act="usuariopede"]', 1200)
        confere(await pg.evaluate("(document.querySelector('#usupede')||{}).value") == "amanda.teste", "@ · sugestão tirada do nome", await pg.evaluate("(document.querySelector('#usupede')||{}).value"))
        await clica(pg, '#layer [data-act="usuariosalva"]', 1200)
        confere(await pg.locator('.pfcheck [data-act="usuariopede"]').count() == 0, "@ · depois de salvar, sai do Complete seu perfil")
        # 22/11: publicação autoral simples: sem título, sem tema e sem escolher o tipo
        await pg.goto(BASE + "/?teste=1&v=9#perfil"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        await clica(pg, '.pfacoes [data-act="create"]', 800); await clica(pg, '#layer [data-act="ctypereal"][data-k="texto"]', 900)
        await pg.check('#layer input[name="rorig"][value="autoral"]'); await pg.wait_for_timeout(200)
        confere(await pg.evaluate("document.querySelector('#rtema').value") == "", "autoral · tema fica em Sem tema")
        await pg.fill("#rtxt", "Minha cachorra dormindo no sofá. Uma fofura."); await clica(pg, '#layer [data-act="publicarreal"]', 1500)
        if await pg.locator('#layer [data-act="regrasok"]').count(): await clica(pg, '#layer [data-act="regrasok"]', 1500)
        if await pg.locator('#layer [data-act="publicarreal"]').count(): await clica(pg, '#layer [data-act="publicarreal"]', 1800)
        ult = await pg.evaluate("(()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); const l = db.t.publicacoes; const p = l[l.length - 1]; return [p.titulo, p.tema, (p.extra||{}).autoral].join('|'); })()")
        confere(ult == "Minha cachorra dormindo no sofá.|Outros|cronica", "autoral · publica sem título nem tema, com o título tirado do texto", ult)
        # 22/11: Strava pelo quadro oficial, que só carrega ao tocar
        await pg.goto(BASE + "/?teste=1&v=10#perfil"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        await pg.evaluate("document.querySelector('[data-act=redes]') && document.querySelector('[data-act=redes]').click()"); await pg.wait_for_timeout(700)
        await clica(pg, '#layer [data-act="redeconectar"][data-r="strava"]', 700)
        await pg.fill("#redeuser", "https://www.strava.com/activities/1234567890"); await clica(pg, '#layer [data-act="redeenviar"]', 900)
        await pg.goto(BASE + "/?teste=1&v=11#perfil"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        await clica(pg, '[data-act="ptab"][data-tab="redes"]', 900)
        confere(await pg.locator('.stravabox [data-act="stravacarrega"]').count() == 1 and await pg.locator('.stravabox iframe').count() == 0, "strava · quadro não carrega sozinho")
        await clica(pg, '.stravabox [data-act="stravacarrega"]', 500)
        confere(await pg.evaluate("(document.querySelector('.stravabox iframe')||{}).src || ''") == "https://strava-embeds.com/activity/1234567890", "strava · ao tocar, abre o quadro oficial do Strava")
        # 22/11: mensagens entre pessoas (pedido) e atendimento da página com respostas prontas
        await pg.goto(BASE + "/?teste=1&v=12#inicio"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        confere(await pg.locator('#topconta a[href="#notificacoes"] .ncount').count() == 1, "mensagens · o sino conta a conversa nova da página")
        await pg.goto(BASE + "/?teste=1&v=12b#notificacoes"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        confere(await pg.locator('.nfil a[href="#mensagens"] .rdn').count() == 1, "mensagens · em Notificações, a pílula Mensagens mostra a conversa nova")
        await pg.goto(BASE + "/?teste=1&v=13#org-u-" + c3); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await clica(pg, '.pfacoes [data-act="msgcom"]', 1500)
        confere("msg-" in pg.url and await pg.locator('#msgtx2').count() == 1, "mensagens · o botão Mensagem, abaixo do nome, abre a conversa", pg.url)
        confere(await pg.evaluate("document.body.innerText.includes('a mensagem chega como pedido')"), "mensagens · sem vínculo, avisa que é pedido")
        await pg.fill("#msgtx2", "Oi, tudo bem?"); await clica(pg, '[data-act="msgmanda"]', 1200)
        confere(await pg.locator('#msgsbox .bolha.eu').count() == 1, "mensagens · a mensagem enviada aparece")
        await clica(pg, '[data-act="topomais"]', 700); await clica(pg, '#layer [data-act="denconv"]', 700)
        await clica(pg, '#layer [data-act="denconvmot"][data-k="ataque"]', 300); await clica(pg, '#layer [data-act="denconvenvia"]', 1200)
        confere(await pg.evaluate("document.body.innerText.includes('Denúncia enviada')"), "mensagens · denunciar a conversa pelo ⋯")
        await pg.goto(BASE + "/?teste=1&v=14#mensagens"); await pg.wait_for_timeout(1500)
        confere(await pg.locator('#mlist .ncard').count() >= 1, "mensagens · a conversa aparece na lista")
        await clica(pg, '[data-act="msgf"][data-f="atendimento"]', 900)
        confere(await pg.evaluate("document.querySelector('#mlist').innerText.includes('sábados')"), "mensagens · Atendimento mostra quem falou com a sua página")
        await pg.goto(BASE + "/?teste=1&v=15#msg-00000000-0000-4000-8000-0000000000c1"); await pg.wait_for_timeout(1500)
        await clica(pg, '[data-act="msgresp"]', 900)
        await pg.fill("#rpnome", "Horários"); await pg.fill("#rptxt", "Atendemos de terça a sábado, das 10h às 19h."); await clica(pg, '#layer [data-act="msgrespnova"]', 900)
        await clica(pg, '#layer [data-act="msgrespusa"]', 500)
        confere("terça a sábado" in (await pg.evaluate("document.querySelector('#msgtx2').value")), "mensagens · resposta pronta entra na mensagem")
        await clica(pg, '[data-act="msgmanda"]', 1200)
        confere(await pg.locator('#msgsbox .bolha.eu').count() == 1, "mensagens · a página responde como página")
        await clica(pg, '[data-act="msgresp"]', 900); await clica(pg, '#layer [data-act="msgrespedita"]', 400)
        await pg.fill("#rptxt", "Atendemos de terça a domingo."); await clica(pg, '#layer [data-act="msgrespnova"]', 900)
        confere(await pg.evaluate("document.querySelector('#layer .sheet') && document.querySelector('#layer .sheet').innerText.includes('terça a domingo')"), "mensagens · resposta pronta pode ser editada")
        await fecha_folha(pg); await pg.goto(BASE + "/?teste=1&v=40#pg-00000000-0000-4000-8000-0000000000ad"); await pg.wait_for_timeout(1800); await fecha_folha(pg)
        await clica(pg, '.phacoes [data-act="topomais"]', 700); await clica(pg, '#layer [data-act="paginaedita"]', 800)   # 23/11: Editar página fica no ⋯
        if await pg.locator('#layer [data-act="equipe"]').count():
            await clica(pg, '#layer [data-act="equipe"]', 900); await pg.fill("#equsu", "@caio_teste"); await clica(pg, '#layer [data-act="equipepoe"]', 1000)
            confere(await pg.evaluate("document.querySelector('#layer .sheet').innerText.includes('@caio_teste')"), "equipe · a dona põe alguém pelo @")
            await clica(pg, '#layer [data-act="equipetira"]', 300); await clica(pg, '#layer [data-act="equipetira"]', 1000)
            confere(not await pg.evaluate("document.querySelector('#layer .sheet').innerText.includes('@caio_teste')"), "equipe · a dona tira da equipe")
        else: confere(False, "equipe · Editar página mostra Equipe de atendimento")
        await fecha_folha(pg)
        # 22/11: quem visita um perfil com Redes aberta vê os mesmos blocos que a dona, sem os botões de ajustar
        await pg.evaluate("()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); const r = db.t.conta_dados.find(x=>x.user_id === '00000000-0000-4000-8000-000000000002' && x.chave === 'vitrine'); r.valor.redes = [{rede:'github', url:'https://github.com/jim', u:'jim', d:'perfil', n:6, nm:'jim'}, {rede:'letterboxd', url:'https://letterboxd.com/jim'}]; localStorage.setItem('arede-teste-db', JSON.stringify(db)); }")
        await pg.goto(BASE + "/?teste=1&v=16#org-u-" + jim); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await clica(pg, '[data-act="pessaba"][data-t="redes"]', 1500)
        confere(await pg.locator('#orgbody .rbloco').count() == 2 and await pg.locator('#orgbody .rbaj').count() == 0, "redes · quem visita vê os blocos da dona, sem Ajustar", str(await pg.locator('#orgbody .rbloco').count()))
        # 22/11: sugestões de quem seguir no Início
        await pg.goto(BASE + "/?teste=1&v=17#inicio"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        n0 = await pg.locator('#sugs .sugcard').count()
        confere(n0 >= 1, "sugestões · aparecem no Início", str(n0))
        await clica(pg, '#sugs .sugcard .sugx', 500)
        confere(await pg.locator('#sugs .sugcard').count() == n0 - 1, "sugestões · o ✕ tira a sugestão")
        await clica(pg, '#sugs [data-act="sugdepois"]', 500)
        confere(await pg.locator('#sugs').count() == 0, "sugestões · Agora não esconde do Início")
    except Exception as e: confere(False, "seguir · erro: " + str(e)[:200])
    confere(not erros, "seguir · sem erros de JS", "; ".join(erros[:3]))
    await ctx.close()

async def g_marco(b):
    ctx, pg, erros = await abre_contexto(b)
    jim = "00000000-0000-4000-8000-000000000002"
    try:
        await entra(pg, teste=True); await pg.goto(BASE + "/?teste=1#org-u-" + jim); await pg.wait_for_timeout(2200); await fecha_folha(pg)
        await clica(pg, '[data-act="open"]', 1800)
        # 26/11 (Amanda): comentar mais simples. Antes do 1º comentário, uma linha avisa que é público e segue as Regras de conduta (link);
        # comentar vale como concordar, sem caixa de regras nem confirmação extra
        confere(await pg.locator(".cnovo .cregra [data-act=\"regrasver\"]").count() == 1, "marco · antes do 1º comentário, a linha das Regras de conduta")
        await pg.locator(".cnovo .ctxt").first.fill("Comentário de teste do marco"); await pg.locator(".cnovo .ctxt").first.dispatch_event("input")
        await clica(pg, ".cnovo .cbt", 2000)
        confere(await pg.locator(".rgbox").count() == 0 and await pg.evaluate("document.body.innerText.includes('Comentário de teste do marco')"), "marco · 1º comentário sai direto, sem caixa de regras")
        confere(await pg.locator(".cnovo .cregra").count() == 0, "marco · a linha das regras some depois do 1º comentário")
        await pg.locator(".cnovo .ctxt").first.fill("Segundo comentário do marco"); await pg.locator(".cnovo .ctxt").first.dispatch_event("input")
        await clica(pg, ".cnovo .cbt", 2000)
        confere(await pg.evaluate("document.body.innerText.includes('Segundo comentário do marco')"), "marco · 2º comentário sai")
        await pg.goto(BASE + "/?teste=1#org-u-" + jim); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await clica(pg, '[data-act="pessoainfo"]', 800); await clica(pg, '#layer [data-act="bloqpede"]', 800)
        confere(await folha(pg, "Bloquear"), "marco · confirmação de bloqueio abre")
        await clica(pg, '#layer [data-act="bloqueia"]', 1500)
        confere(await pg.evaluate("document.body.innerText.includes('Você bloqueou este perfil')"), "marco · perfil bloqueado mostra o aviso")
        await pg.goto(BASE + "/?teste=1#inicio"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        confere(not await pg.evaluate("document.body.innerText.includes('Feira de trocas de sementes')"), "marco · publicação de quem foi bloqueado some do feed")
        await pg.goto(BASE + "/?teste=1#config"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await clica(pg, '[data-act="bloqueados"]', 1500)
        confere(await pg.locator('#bloqlista [data-act="desbloqueia"]').count() == 1, "marco · Pessoas bloqueadas lista quem foi bloqueado")
        await clica(pg, '#bloqlista [data-act="desbloqueia"]', 1200)
        confere(await pg.locator('#bloqlista [data-act="desbloqueia"]').count() == 0, "marco · desbloquear tira da lista")
        # 22/11: conta nova pelo Google completa o cadastro (nome, 18+ e aceite) antes de usar a rede
        await pg.evaluate("()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); db.cadIncompleto = true; localStorage.setItem('arede-teste-db', JSON.stringify(db)); }")
        await pg.goto(BASE + "/?teste=1&cad=1#inicio"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        confere(await pg.locator(".cadcomp #knasc").count() == 1, "marco · cadastro incompleto leva para Completar cadastro")
        await pg.fill("#knome", "Ana"); await pg.fill("#ksobre", "Teste"); await pg.fill("#knasc", "1990-05-10"); await pg.check("#kok")
        await pg.wait_for_function("!document.querySelector('[data-act=cadcompleta]').disabled", timeout=5000)
        await pg.click('[data-act="cadcompleta"]'); await pg.wait_for_timeout(2500)
        confere(await folha(pg, "Primeiros passos"), "marco · depois de completar o cadastro, as boas-vindas abrem")
        npas = await pg.locator("#tutbox .tutdots i").count()   # 28/11: 4 passos sem repetir as boas-vindas, mais "Comece seguindo" quando há sugestões
        pf = 0
        for _ in range(npas - 1):
            pf = max(pf, await pg.locator('#tutbox .pfcheck li').count()); await clica(pg, '#tutbox [data-act="tutvai"].primary', 500)
        pf = max(pf, await pg.locator('#tutbox .pfcheck li').count())
        tits = await pg.evaluate("(document.querySelector('#tutbox .tut-t')||{}).innerText || ''")
        confere(npas in (4, 5) and await pg.locator('#tutbox [data-act="tutfim"]').count() == 1 and pf == 6 and (npas == 4 or tits == "Comece seguindo"), f"marco · Primeiros passos em {npas} passos, com o que falta no perfil{' e o que seguir' if npas == 5 else ''}", tits)
        await clica(pg, '#tutbox [data-act="tutfim"]', 700)
        confere(await pg.locator(".cadcomp").count() == 0, "marco · depois de concluir, a conta funciona", await pg.evaluate("[location.hash, (document.querySelector('.ferr:not([hidden])')||{}).innerText, document.querySelector('#knasc') && document.querySelector('#knasc').value, document.querySelector('#kok') && document.querySelector('#kok').checked, document.body.innerText.slice(0,200)].join(' | ')"))
        # 23/11: conta nova (até 3 dias) que confirmou o e-mail em outro aparelho vê as boas-vindas na primeira visita, uma vez só
        await pg.evaluate("()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); (db.t.perfis || []).forEach(x=>{ if (String(x.id).endsWith('000000000001')) x.criado_em = new Date().toISOString(); }); localStorage.setItem('arede-teste-db', JSON.stringify(db)); Object.keys(localStorage).filter(k=>/tutVisto/.test(k)).forEach(k=>localStorage.removeItem(k)); }")
        await pg.goto(BASE + "/?teste=1#inicio"); await pg.wait_for_timeout(5000)
        confere(await folha(pg, "Primeiros passos"), "marco · conta nova vê as boas-vindas na primeira visita, mesmo sem voltar pelo link do e-mail")
        await fecha_folha(pg); await pg.goto(BASE + "/?teste=1#inicio"); await pg.wait_for_timeout(4000)
        confere(not await folha(pg, "Primeiros passos"), "marco · as boas-vindas não voltam depois de vistas")
        await pg.goto(BASE + "/?teste=1&cad=1#config"); await pg.wait_for_timeout(1200); await fecha_folha(pg)
        await pg.evaluate("document.querySelector('main [data-act=sair]') && document.querySelector('main [data-act=sair]').click()"); await pg.wait_for_timeout(1500)
        await pg.goto(BASE + "/?teste=1#conta"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        confere(await pg.locator(".segconta [role=tab]").count() == 2 and await pg.locator(".gbtn").count() == 0, "marco · login com Entrar/Criar conta, sem o Google (próximo passo)")
        # 22/11: ajustar a capa antes de salvar (arrastar e aproximar)
        import base64
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAGklEQVR4nGNkYPjPgAqYUDlgCSZGBkZGJAkAKawBCJT8ZqAAAAAASUVORK5CYII=")
        await pg.evaluate("()=>{ const db = JSON.parse(localStorage.getItem('arede-teste-db')); db.logada = true; localStorage.setItem('arede-teste-db', JSON.stringify(db)); }")
        await pg.goto(BASE + "/?teste=1&c=1#perfil"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        await clica(pg, '[data-act="capaedita"]', 800)
        await pg.set_input_files("#capafile", files=[{"name": "capa.png", "mimeType": "image/png", "buffer": png}]); await pg.wait_for_timeout(1200)
        confere(await pg.locator(".sheet .crop .cropguia").count() == 1, "marco · capa abre o ajuste com a faixa sempre visível")
        await pg.locator(".sheet .cropzoom input").fill("2"); await clica(pg, "#cropok", 1500)
        confere(await pg.locator(".sheet .crop").count() == 0, "marco · Usar capa salva e fecha o ajuste")
        confere(not erros, "marco · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "marco · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

# 22/11 (Amanda): resumo da semana e do mês, a faixa "Enquanto você esteve fora" e Hoje · Semana · Mês no Em alta (modo de teste)
async def g_resumo(b):
    ctx, pg, erros = await abre_contexto(b)
    try:
        await pg.goto(BASE + "/?teste=1#resumo"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        confere(await pg.locator(".resumo .reslista li").count() >= 4, "resumo · semana com assuntos, desmentidos e dados oficiais")
        confere(await pg.locator(".resumo .ressec").count() == 4, "resumo · 4 seções (assuntos, desmentidos, dados oficiais, comunidades)")
        await pg.goto(BASE + "/?teste=1#resumo-mes"); await pg.wait_for_timeout(1500)
        confere(await pg.locator('.resseg [aria-selected="true"]').inner_text() == "Mês", "resumo · aba Mês")
        await pg.evaluate("localStorage.setItem('arede-ultVisita', JSON.stringify(Date.now() - 5 * 864e5))")
        await pg.goto(BASE + "/?teste=1&r=1#inicio"); await pg.wait_for_timeout(3000); await fecha_folha(pg)
        confere(await pg.locator("#fora .reslista li").count() >= 1, "resumo · faixa Enquanto você esteve fora depois de 5 dias")
        await clica(pg, '[data-act="forafecha"]', 400)
        confere(await pg.locator("#fora").count() == 0, "resumo · a faixa fecha")
        await sem_rolagem_lateral(pg) and confere(True, "resumo · sem rolagem lateral")
        confere(not erros, "resumo · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "resumo · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

# 22/11 (Amanda): redes conectadas. Prévia antes de conectar e partidas de xadrez com tabuleiro (modo de teste, exemplos sem internet)
async def g_redes(b):
    ctx, pg, erros = await abre_contexto(b)
    try:
        await pg.goto(BASE + "/?teste=1#perfil"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        await clica(pg, '[data-act="redes"]', 800); await clica(pg, '[data-act="redeconectar"][data-r="chesscom"]', 600)
        await pg.fill("#redeuser", "exemplo"); await pg.wait_for_timeout(2500)
        confere(await pg.locator("#redeprev .rprev.xad").count() >= 1, "redes · prévia antes de conectar mostra as partidas")
        confere(await pg.locator("#redeprev .xtab text").count() >= 2, "redes · tabuleiro com as peças")
        await clica(pg, '[data-act="close"]', 400); await clica(pg, '[data-act="redes"]', 800); await clica(pg, '[data-act="redeconectar"][data-r="medium"]', 600)
        await pg.fill("#redeuser", "exemplo"); await pg.wait_for_timeout(2500)
        confere(await pg.locator("#redeprev .rprev").count() >= 1, "redes · prévia de outra rede (exemplos sem internet)")
        confere(not erros, "redes · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "redes · roteiro completo", str(e)[:200])
    finally:
        await ctx.close()

async def g_instalavel(b):
    ctx, pg, erros = await abre_contexto(b)
    try:
        await entra(pg)
        r = await pg.evaluate("""async () => { const m = await fetch('/manifest.webmanifest').then(r => r.ok ? r.json() : null).catch(() => null);
          if (!m) return {m:false}; const ic = await Promise.all(m.icons.map(i => fetch(i.src).then(r => r.ok).catch(() => false)));
          const sw = await fetch('/sw.js').then(r => r.ok && r.text()).catch(() => '');
          return {m:true, nome:m.name, standalone:m.display === 'standalone', icones:ic.length && ic.every(Boolean), mascara:m.icons.some(i => i.purpose === 'maskable'), sw:!!sw && sw.includes('push') && sw.includes('caches'),
            link:!!document.querySelector('link[rel=manifest]'), apple:!!document.querySelector('link[rel=apple-touch-icon]')}; }""")
        confere(r.get("m") and r.get("nome") == "arede.online" and r.get("standalone"), "instalavel · manifesto", str(r))
        confere(r.get("icones") and r.get("mascara"), "instalavel · ícones (inclusive o de máscara)", str(r))
        confere(r.get("sw") and r.get("link") and r.get("apple"), "instalavel · trabalhador e ligações na página", str(r))
        await pg.goto(BASE + "/?teste=1#notificacoes"); await pg.wait_for_timeout(1500); await fecha_folha(pg)
        await pg.evaluate("location.hash='#inicio'"); await pg.wait_for_timeout(400); await pg.evaluate("location.hash='#notificacoes'"); await pg.wait_for_timeout(1200)
        conv = await pg.evaluate("(document.querySelector('#nconvite') || {}).innerText || ''")
        confere("Receber o resumo da semana?" in conv and "celular" not in conv and await pg.locator('#nconvite [data-act="resumosim"]').count() == 1 and await pg.locator('#nconvite [data-act="resumonao"]').count() == 1,
                "instalavel · convite do resumo pergunta antes (Quero receber / Agora não), sem falar de celular", conv[:80])
        await clica(pg, '[data-act="notifprefs"]', 1200)
        sw = await pg.evaluate("[...document.querySelectorAll('#layer [data-act=resumopref], #layer [data-act=resumomensal]')].map(b=>b.getAttribute('aria-checked'))")
        confere(sw == ["false", "false"], "instalavel · resumos por e-mail aparecem desligados até a pessoa ligar", str(sw))
        confere(await pg.locator('#layer [data-act="pushpref"]').count() == 0, "instalavel · sem avisos no celular enquanto estiver desligado")
        confere(not erros, "instalavel · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "instalavel · roteiro completo", str(e)[:200])
    await ctx.close()

async def g_csat(b):
    import datetime
    if not OFFLINE: return avisa("csat", "só roda com --offline, para não mandar medição de uso de verdade")
    ctx, pg, erros = await abre_contexto(b)
    async def visita(p, nome):
        await p.goto(BASE + "/?uso=1&v=" + nome.replace(" ", "") + "#inicio", wait_until="domcontentloaded", timeout=45000); await p.wait_for_timeout(1500)
        for _ in range(3):
            c = p.locator("#layer button", has_text="Continuar")
            if await c.count(): await c.first.click(); await p.wait_for_timeout(300)
        await fecha_folha(p)
        await p.clock.run_for(70000); await p.wait_for_timeout(600)
        return await p.locator("#layer .sheet", has_text="Como está sendo usar").count() > 0
    try:
        await pg.clock.install()
        confere(await visita(pg, "1"), "csat · aparece depois de 1 minuto")
        await fecha_folha(pg)
        confere(not await visita(pg, "2"), "csat · não volta na mesma semana")
        await pg.close(); pg = await ctx.new_page(); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        await pg.clock.install(time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=4))
        confere(not await visita(pg, "3"), "csat · não volta 4 dias depois")
        await pg.close(); pg = await ctx.new_page(); pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
        await pg.clock.install(time=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=8))
        confere(await visita(pg, "4"), "csat · volta depois de 7 dias")
        confere(not erros, "csat · sem erro de código", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "csat · roteiro completo", str(e)[:200])
    await ctx.close()

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
    """28/11: quem chega em português do Brasil entra direto, sem a folha de idioma; nos outros idiomas a folha aparece,
    e tocar no idioma já marcado não desmarca nem avisa."""
    nome = "primeiro"
    for loc in ("pt-BR", "en-US"):
        ctx, pg, erros = await abre_contexto(b, locale=loc)
        try:
            await pg.goto(BASE + "/#inicio", wait_until="domcontentloaded", timeout=45000); await pg.wait_for_timeout(1500)
            if await pg.locator("#bvbox").count():   # no site de verdade, quem chega sem conta vê as boas-vindas antes do idioma
                await pg.locator('#bvbox [data-act="bvpula"]').evaluate("e=>e.click()"); await pg.wait_for_timeout(1500)
            c = pg.locator("#layer button", has_text="Continuar")
            if loc == "pt-BR":
                confere(await c.count() == 0, f"{nome} · em português do Brasil, entra sem a escolha de idioma")
            else:
                confere(await c.count() >= 1, f"{nome} · em outro idioma, a escolha de idioma e país aparece")
                confere(await pg.locator("#layer select").count() >= 1, f"{nome} · escolha de país")
                m = pg.locator('#layer .acopt[aria-checked="true"]')
                if await m.count() == 1:
                    k = await m.get_attribute("data-k"); await m.click(); await pg.wait_for_timeout(400)
                    confere(await pg.locator(f'#layer .acopt[data-k="{k}"]').get_attribute("aria-checked") == "true", f"{nome} · tocar no idioma marcado não desmarca")
                if await c.count():
                    await c.first.click(); await pg.wait_for_timeout(800)
                    confere(await pg.locator("#layer button", has_text="Continuar").count() == 0, f"{nome} · Continuar fecha")
            confere(not erros, f"{nome} · sem erro de código ({loc})", "; ".join(erros[:3]))
        except Exception as e:
            confere(False, f"{nome} · roteiro completo ({loc})", str(e)[:200])
        finally:
            await ctx.close()

async def g_boasvindas(b):
    """23/11: quem chega sem conta vê as boas-vindas (o que a rede faz e o que a diferencia) antes do idioma; por link direto, a faixa."""
    nome = "boasvindas"
    ctx, pg, erros = await abre_contexto(b)
    try:
        await pg.goto(BASE + "/?real=1#inicio", wait_until="domcontentloaded", timeout=45000); await pg.wait_for_timeout(6000)
        confere(await pg.locator("#bvbox").count() == 1, f"{nome} · primeira visita sem conta abre as boas-vindas")
        confere(await pg.locator('#bvbox [data-act="bvconta"]').count() == 1, f"{nome} · Criar conta já no primeiro passo")   # 28/11
        tit = []; npas = await pg.locator("#bvbox .tutdots i").count()   # 25/11: 5 passos até 31/12/2026 (o 5º é o dos convites), 4 depois
        for i in range(npas):
            tit.append(await pg.evaluate("(document.querySelector('#bvbox .tut-t')||{}).innerText || ''"))
            if i < npas - 1: await pg.locator('#bvbox [data-act="bvvai"].primary').evaluate("e=>e.click()"); await pg.wait_for_timeout(300)
        import datetime as _dt
        conv = _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=-3))) < _dt.datetime(2027, 1, 1, tzinfo=_dt.timezone(_dt.timedelta(hours=-3)))
        confere(npas == (5 if conv else 4) and tit[0].startswith("Saia da bolha") and "algoritmo" in tit[1] and len(set(tit)) == npas and (not conv or "Convites ilimitados" in tit[-1]), f"{nome} · {npas} passos, do Saia da bolha {'aos convites' if conv else 'ao participar'}", " | ".join(tit))
        confere(await pg.locator('#bvbox [data-act="bvconta"]').count() == 1 and await pg.locator('#bvbox [data-act="bvexplora"]').count() == 1, f"{nome} · último passo: Criar conta e Explorar")
        await pg.locator('#bvbox [data-act="bvexplora"]').evaluate("e=>e.click()"); await pg.wait_for_timeout(1600)
        confere(await pg.locator("#layer button", has_text="Continuar").count() == 0, f"{nome} · depois, em português do Brasil, entra direto no Início")
        await pg.goto(BASE + "/?real=1#inicio"); await pg.wait_for_timeout(5000)
        confere(await pg.locator("#bvbox").count() == 0, f"{nome} · não volta na segunda visita")
        await ctx.close(); ctx, pg, erros2 = await abre_contexto(b); erros += erros2
        await pg.goto(BASE + "/?real=1#transparencia", wait_until="domcontentloaded", timeout=45000); await pg.wait_for_timeout(6000)
        confere(await pg.locator("#bvbar").count() == 1 and await pg.locator("#bvbox").count() == 0, f"{nome} · por link direto, a faixa Primeira vez aqui? sem interromper")
        await pg.locator('#bvbar [data-act="bvabre"]').evaluate("e=>e.click()"); await pg.wait_for_timeout(800)
        confere(await pg.locator("#bvbox").count() == 1 and await pg.locator("#bvbar").count() == 0, f"{nome} · Conhecer abre os mesmos passos")
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

async def g_logado(b):
    """22/11: teste diário com a conta de teste (@jackie.disguise), logada de verdade no site.
    Só roda com a chave TESTE_CHAVE no ambiente. Só lê: não cria, não envia, não segue ninguém.
    Não tira foto da tela nem imprime e-mail ou token (o resultado do GitHub fica aberto)."""
    chave = os.environ.get("TESTE_CHAVE", "")
    if not chave: return avisa("logado", "sem TESTE_CHAVE, pulei o teste logado")
    import urllib.request
    try:
        req = urllib.request.Request("https://zbmzabgdejylpmabujad.supabase.co/functions/v1/teste-sessao", data=b"{}", method="POST",
                                     headers={"x-teste-chave": chave, "content-type": "application/json"})
        sess = json.loads(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e:
        return confere(False, "logado · abre a sessão da conta de teste", type(e).__name__)
    confere(bool(sess.get("access_token")) and "@" not in json.dumps(sess.get("user", {})), "logado · abre a sessão da conta de teste, sem e-mail")
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    await ctx.add_init_script("(() => { const K = 'sb-zbmzabgdejylpmabujad-auth-token'; try { if (!localStorage.getItem(K)) localStorage.setItem(K, " + json.dumps(json.dumps(sess)) + "); } catch (e) {} })()")
    pg = await ctx.new_page(); erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)[:200]))
    rpcs = []; pg.on("response", lambda rs: rpcs.append(rs.status) if "/rpc/pessoas_busca" in rs.url else None)
    try:
        await entra(pg)
        await pg.goto(BASE + "/#perfil"); await pg.wait_for_timeout(3500); await fecha_folha(pg)
        ok = False
        for _ in range(12):
            ok = await pg.locator('.pfacoes [data-act="create"]').count() > 0
            if ok: break
            await pg.wait_for_timeout(500)
        diag = await pg.evaluate("(()=>{ const a=document.querySelector('[data-act=acessar]'); return 'topo ' + (a ? (a.innerText||'').replace(/\\s+/g,' ').trim() : '?') + ' · ' + location.hash; })()")
        confere(ok, "logado · Seu perfil abre com Criar (só a dona vê)", diag)
        await clica(pg, '[data-act="ptab"][data-tab="conexoes"]', 2000)
        confere(await pg.locator('#conxbody [data-act="conxvis"]').count() == 3, "logado · Conexões abre com quem vê")
        await pg.goto(BASE + "/#explorar"); await pg.wait_for_timeout(2000); await fecha_folha(pg)
        await pg.fill("#q", "rede"); n = 0
        for _ in range(16):
            await pg.wait_for_timeout(500); n = await pg.locator('#expessoas a.rowitem').count()
            if n: break
        if not n:   # diagnóstico sem dado pessoal: o que o servidor responde e o que a lista diz
            try:
                rq = urllib.request.Request("https://zbmzabgdejylpmabujad.supabase.co/rest/v1/rpc/pessoas_busca", data=b'{"p_q":"rede"}', method="POST",
                    headers={"apikey": "sb_publishable_GZXwglA_bRngXUSD-BWfLQ_hawYSnLD", "authorization": "Bearer " + sess["access_token"], "content-type": "application/json"})
                srv = "servidor " + str(len(json.loads(urllib.request.urlopen(rq, timeout=20).read()) or []))
            except Exception as e: srv = "servidor " + type(e).__name__ + " " + str(getattr(e, "code", ""))
            lista = await pg.evaluate("(document.querySelector('#expessoas')||{}).innerText || ''")
            n_diag = f"{srv}; lista '{lista[:60]}'; pedidos do site {rpcs}; versão " + await pg.evaluate("(document.querySelector('script[src*=\"/a/app.\"]')||{}).src || '?'")
        confere(n >= 1, "logado · Busca encontra pessoas pelo nome", n_diag if not n else "")
        await pg.goto(BASE + "/#mensagens"); await pg.wait_for_timeout(2500); await fecha_folha(pg)
        confere(await pg.locator('#mlist').count() == 1, "logado · Mensagens abre")
        tudo = await pg.evaluate("document.documentElement.outerHTML")
        outros = {m.lower() for m in re.findall(r"[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b", tudo, re.I)} - EMAILS_OK
        outros = {m for m in outros if not re.search(r"\.(png|jpe?g|webp|svg|js|css)$", m)}
        confere(not outros, "logado · nenhum e-mail na tela", ", ".join(sorted(m[0] + "…@" + m.split("@")[1] for m in outros)))   # só a 1ª letra e o domínio
        confere(not erros, "logado · sem erro de JavaScript", "; ".join(erros[:3]))
    except Exception as e:
        confere(False, "logado · erro", type(e).__name__ + ": " + str(e)[:160])
    finally:
        await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await g_seguranca(b); await g_sempre(b)
        G = set(GRUPOS)
        if "card" in G: await g_card(b)
        if "voltar" in G: await g_voltar(b)
        if "ajustar" in G: await g_ajustar(b)
        if "fontes" in G: await g_fontes(b)
        if "conta" in G: await g_conta(b)
        if "filtros" in G: await g_filtros(b)
        if "anuncio" in G: await g_anuncio(b)
        if "desinfo" in G: await g_desinfo(b)
        if "abas" in G: await g_abas(b)
        if "acoes" in G and OFFLINE: await g_acoes(b)
        if "mapa" in G: await g_mapa(b)
        if "atividades" in G: await g_atividades(b)
        if "eventos" in G: await g_rota(b, "eventos", "#participar", x_eventos)
        if "comunidades" in G: await g_rota(b, "comunidades", "#organizacoes", x_comunidades)
        if "emalta" in G: await g_rota(b, "emalta", "#em-alta", x_emalta)
        if "config" in G: await g_rota(b, "config", "#config", x_config, teste=True)
        if "primeiro" in G: await g_primeiro(b)
        if "boasvindas" in G: await g_boasvindas(b)
        if "publicar" in G: await g_rota(b, "publicar", "#inicio", x_publicar, teste=True)
        if "rodape" in G: await g_rota(b, "rodape", "#inicio", x_rodape)
        if "busca" in G: await g_busca(b)
        if "institucional" in G:
            for r in ["#manifesto", "#termos", "#privacidade"]: await g_rota(b, "institucional", r)
            await g_rota(b, "institucional", "#transparencia", x_funciona, teste=True)
        if "instalavel" in G: await g_instalavel(b)
        if "csat" in G: await g_csat(b)
        if "seguir" in G and OFFLINE: await g_seguir(b)
        if "marco" in G and OFFLINE: await g_marco(b)
        if "resumo" in G and OFFLINE: await g_resumo(b)
        if "redes" in G and OFFLINE: await g_redes(b)
        if "logado" in G and not OFFLINE: await g_logado(b)
        if "layout" in G:
            for w, escuro in ((390, True), (1280, False)):
                await g_sempre(b, w, escuro, "layout"); await g_card(b, w, escuro, "layout")
        await b.close()
    json.dump({"base": BASE, "grupos": GRUPOS, "certos": len(certos), "falhas": falhas, "avisos": avisos}, open(f"{OUT}/resultado.json", "w"), ensure_ascii=False, indent=1)
    print(f"\nGrupos: {', '.join(GRUPOS)}\n{len(certos)} certos, {len(falhas)} falhas, {len(avisos)} avisos")
    sys.exit(1 if falhas else 0)

asyncio.run(main())

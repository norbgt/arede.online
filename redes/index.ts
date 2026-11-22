// arede.online · REDES: lê o feed público de um perfil em outra rede (Letterboxd, Substack, Medium, Pinterest, YouTube)
// e devolve as publicações em formato único. Só leitura, só o que já é público, nada é guardado aqui.
// O endereço do feed é montado pela função a partir da rede e do nome de usuário: ela não busca endereços arbitrários.
// 19/11 (Amanda): YouTube. A rede.online não recebe vídeos (custam caro e são difíceis de checar); o canal conectado aparece no perfil
// em prévia, e o vídeo toca no player oficial do YouTube, como na aba Canais. Lido pelo feed público do canal (sem chave nem login).
// As playlists públicas do canal também aparecem, e levam para o YouTube.
// 19/11 (Amanda): também aceita o link de uma playlist pública (…&list=PL…): a prévia mostra os vídeos dela.
// 21/11 (Amanda): jogos e criações. GitHub (feed público de atividade: repositórios criados, versões lançadas, atualizações),
// itch.io (jogos novos de um criador), AniList (anime e mangá que a pessoa acompanha), Lichess e Chess.com (partidas recentes)
// e Steam (jogos das últimas 2 semanas; precisa da chave gratuita da Steam, guardada como segredo STEAM_KEY, e de perfil público).
// Tudo sem custo e só com o que já é público. Nenhuma senha, nenhum login.
// GET ?rede=letterboxd&usuario=amanda
import { XMLParser } from "npm:fast-xml-parser@4.4.1";

const UA = "Mozilla/5.0 (compatible; arede-redes/1.0; +https://arede.online/)";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "GET, OPTIONS" };
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true, htmlEntities: true });
const lista = (x: any) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const texto = (x: any): string => (x == null ? "" : typeof x === "string" ? x : typeof x === "number" ? String(x) : Array.isArray(x) ? texto(x[0]) : (x["#text"] ?? "") + "");
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const limpa = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, " ").trim();
// trecho com frases inteiras (até ~300 caracteres; se a primeira frase for maior, vai ela inteira)
function trecho(t: string): string {
  const fr = t.match(/[^.!?…]+[.!?…]+["”’)]*\s*|[^.!?…]+$/g) || [];
  let out = ""; for (const f of fr) { if (out && (out + f).length > 300) break; out += f; if (out.length > 300) break; }
  return out.trim();
}
function imgDe(html: string): string | null {
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) { const u = m[1]; if (u.startsWith("https://") && !/\/_\/stat|pixel|tracking|1x1/i.test(u)) return u; }
  return null;
}
const iso = (d: any) => { const t = typeof d === "number" ? d : Date.parse(String(d || "")); return isFinite(t) ? new Date(t).toISOString() : null; };
const dec = (x: string) => { try { return decodeURIComponent(x); } catch { return x; } };
const https = (u: any) => (typeof u === "string" && u.startsWith("https://") ? u : null);

type Alvo = { rede: string; feed: string; perfil: string; usuario: string; checa?: RegExp; resolve?: boolean };
function alvo(rede: string, bruto: string): Alvo | null {
  if (rede === "youtube") {   // playlist: pelo código (PL…) ou por qualquer link do YouTube com ?list=
    const b = (bruto || "").trim(), m = b.match(/^((?:PL|OL)[\w-]{10,60})$/) || (/^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtu\.be)\//i.test(b) ? b.match(/[?&]list=((?:PL|OL)[\w-]{10,60})/) : null);
    if (m) return { rede, usuario: m[1], feed: `https://www.youtube.com/feeds/videos.xml?playlist_id=${m[1]}`, perfil: `https://www.youtube.com/playlist?list=${m[1]}` };
  }
  let u = (bruto || "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.|m\.)/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (rede === "letterboxd") { u = u.replace(/^letterboxd\.com\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_]{2,30}$/.test(u) ? { rede, usuario: u, feed: `https://letterboxd.com/${u}/rss/`, perfil: `https://letterboxd.com/${u}/` } : null; }
  if (rede === "medium") { u = u.replace(/^medium\.com\//i, "").replace(/^feed\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_.-]{1,40}$/.test(u) ? { rede, usuario: u, feed: `https://medium.com/feed/@${u}`, perfil: `https://medium.com/@${u}` } : null; }
  if (rede === "pinterest") { u = u.replace(/^([a-z]{2}\.)?pinterest\.[a-z.]+\//i, "").replace(/^@/, "").replace(/\/(feed\.rss|_saved|_created)$/i, "").replace(/\.rss$/i, "");
    const [p, b] = u.split("/");
    if (!/^[A-Za-z0-9_.-]{3,40}$/.test(p || "") || (b && !/^[A-Za-z0-9_-]{1,80}$/.test(b))) return null;
    return { rede, usuario: b ? p + "/" + b : p, feed: b ? `https://www.pinterest.com/${p}/${b}.rss` : `https://www.pinterest.com/${p}/feed.rss`, perfil: `https://www.pinterest.com/${p}/${b ? b + "/" : ""}` }; }
  if (rede === "substack") { u = u.replace(/\/(feed|archive|p\/.*)$/i, "").replace(/^@/, "");
    if (/^[a-z0-9-]{2,60}$/i.test(u)) u = u + ".substack.com";
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u)) return null;
    // domínio próprio: só vale se o feed for mesmo de uma publicação do Substack
    return { rede, usuario: u.replace(/\.substack\.com$/i, ""), feed: `https://${u}/feed`, perfil: `https://${u}/`, checa: /\.substack\.com\b|substackcdn\.com|<generator>Substack/i }; }
  if (rede === "youtube") { u = u.replace(/^youtube\.com\//i, "").replace(/\/(videos|featured|streams|shorts|playlists|about)$/i, "");
    const id = u.match(/^(?:channel\/)?(UC[\w-]{22})$/);
    if (id) return { rede, usuario: id[1], feed: `https://www.youtube.com/feeds/videos.xml?channel_id=${id[1]}`, perfil: `https://www.youtube.com/channel/${id[1]}` };
    const h = u.replace(/^(c\/|user\/)/i, "").replace(/^@/, "");
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(h)) return null;
    return { rede, usuario: "@" + h, feed: "", perfil: `https://www.youtube.com/@${h}`, resolve: true }; }
  // 21/11: jogos e criações
  if (rede === "github") { u = u.replace(/^github\.com\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(u) ? { rede, usuario: u, feed: `https://github.com/${u}.atom`, perfil: `https://github.com/${u}` } : null; }
  if (rede === "itchio") { u = u.replace(/^itch\.io\/profile\//i, "").replace(/\.itch\.io.*$/i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_-]{2,40}$/.test(u) ? { rede, usuario: u.toLowerCase(), feed: `https://itch.io/games/newest/by-${u.toLowerCase()}.xml`, perfil: `https://${u.toLowerCase()}.itch.io/` } : null; }
  if (rede === "anilist") { u = u.replace(/^anilist\.co\/user\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_]{2,20}$/.test(u) ? { rede, usuario: u, feed: "", perfil: `https://anilist.co/user/${u}/` } : null; }
  if (rede === "lichess") { u = u.replace(/^lichess\.org\/@\//i, "").replace(/^lichess\.org\//i, "").replace(/^@\/?/, "").split("/")[0];
    return /^[A-Za-z0-9_-]{2,30}$/.test(u) ? { rede, usuario: u, feed: "", perfil: `https://lichess.org/@/${u}` } : null; }
  if (rede === "chesscom") { u = u.replace(/^chess\.com\/(member|players?)\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_-]{3,25}$/.test(u) ? { rede, usuario: u.toLowerCase(), feed: "", perfil: `https://www.chess.com/member/${u.toLowerCase()}` } : null; }
  if (rede === "steam") { u = u.replace(/^steamcommunity\.com\//i, "");
    const id = u.match(/^(?:profiles\/)?(7656119\d{10})$/);
    if (id) return { rede, usuario: id[1], feed: "", perfil: `https://steamcommunity.com/profiles/${id[1]}` };
    u = u.replace(/^id\//i, "").replace(/^@/, "").split("/")[0];
    return /^[A-Za-z0-9_-]{2,32}$/.test(u) ? { rede, usuario: u, feed: "", perfil: `https://steamcommunity.com/id/${u}`, resolve: true } : null; }
  return null;
}

async function get(url: string, html = false, extra: Record<string, string> = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000);
  try { const r = await fetch(url, { signal: c.signal, redirect: "follow", headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9",
      accept: html ? "text/html;q=0.9, */*;q=0.5" : "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5", ...extra } });
    const buf = new Uint8Array(await r.arrayBuffer()).slice(0, 3_000_000);
    return { ok: r.ok, status: r.status, txt: new TextDecoder().decode(buf) };
  } catch (e) { return { ok: false, status: 0, txt: "", err: String(e).slice(0, 120) }; } finally { clearTimeout(t); }
}
async function json(url: string, init: RequestInit = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000);
  try { const r = await fetch(url, { ...init, signal: c.signal, headers: { "user-agent": UA, accept: "application/json", ...(init.headers || {}) } });
    let d: any = null; try { d = await r.json(); } catch { d = null; }
    return { ok: r.ok, status: r.status, d };
  } catch { return { ok: false, status: 0, d: null }; } finally { clearTimeout(t); }
}
const falha = (status: number, msg404 = "Não achamos esse perfil, ou ele é privado.") =>
  ({ erro: status === 404 ? "nao_achou" : "rede", msg: status === 404 ? msg404 : "A rede não respondeu agora. Tente de novo em alguns minutos.", status });

// YouTube: o feed é Atom, um vídeo por entrada
function leYoutube(a: Alvo, xml: string) {
  const f = parser.parse(xml)?.feed; if (!f) return null;
  const itens = lista(f.entry).slice(0, 15).map((e: any) => {
    const v = texto(e["yt:videoId"]); const g = e["media:group"] || {};
    return { titulo: limpa(texto(e.title)) || "Sem título", ano: "", url: `https://www.youtube.com/watch?v=${v}`, texto: trecho(limpa(texto(g["media:description"]))),
      imagem: /^[\w-]{11}$/.test(v) ? `https://i.ytimg.com/vi/${v}/hqdefault.jpg` : null, data: texto(e.published) ? new Date(texto(e.published)).toISOString() : null,
      tipo: "video", video: /^[\w-]{11}$/.test(v) ? v : null, nota: null, repost: false };
  }).filter((i: any) => i.video);
  return { rede: a.rede, usuario: a.usuario, perfil: a.perfil, nome: limpa(texto(f.title)), foto: null, itens };
}

// 19/11 (Amanda): canal sem vídeos próprios ainda pode mostrar as playlists públicas. Cada uma leva para o YouTube.
async function playlists(canal: string) {
  if (!/^UC[\w-]{22}$/.test(canal)) return [];
  const p = await get(`https://www.youtube.com/channel/${canal}/playlists`, true); if (!p.ok) return [];
  const ids = [...new Set([...p.txt.matchAll(/"playlistId":"((?:PL|OL)[\w-]{10,60})"/g)].map((m) => m[1]))].slice(0, 6);
  const out: any[] = [];
  await Promise.all(ids.map(async (id) => {
    const r = await get(`https://www.youtube.com/feeds/videos.xml?playlist_id=${id}`); if (!r.ok) return;
    const f = parser.parse(r.txt)?.feed; if (!f) return;
    const es = lista(f.entry), v = texto(es[0]?.["yt:videoId"]), n = es.length;
    if (!n) return;
    const datas = es.map((e: any) => Date.parse(texto(e.published))).filter((x: number) => isFinite(x));
    out.push({ titulo: limpa(texto(f.title)) || "Playlist", ano: "", url: `https://www.youtube.com/playlist?list=${id}`,
      texto: n >= 15 ? "Playlist com 15 vídeos ou mais" : n === 1 ? "Playlist com 1 vídeo" : `Playlist com ${n} vídeos`,
      imagem: /^[\w-]{11}$/.test(v) ? `https://i.ytimg.com/vi/${v}/hqdefault.jpg` : null, data: datas.length ? new Date(Math.max(...datas)).toISOString() : null,
      tipo: "playlist", video: null, nota: null, repost: false });
  }));
  return out;
}

// 21/11 · GitHub: o feed público de atividade (Atom). Fica só o que a pessoa criou ou lançou: repositório novo, versão lançada,
// repositório que ficou público e atualizações (uma por repositório, a mais recente). Estrelas e cópias de projetos de outras pessoas ficam de fora.
// A imagem é a prévia pública do repositório que o próprio GitHub gera (nome, descrição, linguagem e estrelas).
function leGithub(a: Alvo, xml: string) {
  const f = parser.parse(xml)?.feed; if (!f) return null;
  const vistos = new Set<string>(), itens: any[] = [];
  for (const e of lista(f.entry)) {
    // o formato do código mudou em 2026 (…2008:push/123); o antigo era …2008:PushEvent/123. Os dois valem.
    const tipo = ((texto(e.id).match(/2008:([A-Za-z]+)\//) || [])[1] || "").toLowerCase().replace(/event$/, "");
    const link = lista(e.link).map((l: any) => l?.["@_href"]).find((h: any) => typeof h === "string") || "";
    const repo = (String(link).match(/^https:\/\/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+)/) || [])[1] || "";
    if (!repo || !repo.toLowerCase().startsWith(a.usuario.toLowerCase() + "/")) continue;   // só o que é da própria pessoa
    let titulo = "", t = "";
    const raiz = new RegExp(`^https://github\\.com/${repo.replace(/[.]/g, "\\.")}/?$`, "i").test(link);
    if (tipo === "create" && (raiz || /created a repository/i.test(texto(e.title)))) { titulo = `Criou o repositório ${repo.split("/")[1]}`; t = "novo"; }
    else if (tipo === "release") { const v = dec((link.match(/\/releases\/tag\/([^/?#]+)/) || [])[1] || "") || (texto(e.title).match(/released (\S+)/i) || [])[1] || "";
      titulo = `Lançou ${v ? "a versão " + v + " de " : "uma versão de "}${repo.split("/")[1]}`; t = "versao"; }
    else if (tipo === "public") { titulo = `Abriu o repositório ${repo.split("/")[1]}`; t = "novo"; }
    else if (tipo === "push") { if (vistos.has(repo)) continue; titulo = `Atualizou ${repo.split("/")[1]}`; t = "atualizacao"; }
    else continue;
    vistos.add(repo);
    itens.push({ titulo, ano: "", url: link.startsWith("https://github.com/") ? link : `https://github.com/${repo}`, texto: "", imagem: `https://opengraph.githubassets.com/1/${repo}`,
      data: iso(texto(e.published) || texto(e.updated)), tipo: t, nota: null, repost: false });
    if (itens.length >= 12) break;
  }
  const foto = lista(f.entry).map((e: any) => e?.["media:thumbnail"]?.["@_url"]).find((u: any) => https(u)) || null;
  return { rede: a.rede, usuario: a.usuario, perfil: a.perfil, nome: a.usuario, foto, itens };
}

// 21/11 · itch.io: jogos novos de um criador (RSS)
function leItch(a: Alvo, xml: string) {
  const ch = parser.parse(xml)?.rss?.channel; if (!ch) return null;
  const itens = lista(ch.item).slice(0, 12).map((it: any) => {
    const corpo = texto(it.description);
    return { titulo: limpa(texto(it.plainTitle) || texto(it.title)) || "Jogo", ano: "", url: texto(it.link), texto: trecho(limpa(corpo)),
      imagem: https(texto(it.imageurl)) || imgDe(corpo), data: iso(texto(it.pubDate) || texto(it.createDate)), tipo: "jogo", nota: null, repost: false };
  }).filter((i: any) => /^https:\/\//.test(i.url));
  return { rede: a.rede, usuario: a.usuario, perfil: a.perfil, nome: a.usuario, foto: null, itens };
}

// 21/11 · AniList: o que a pessoa está vendo ou lendo (atividades públicas da lista). API aberta para leitura, sem chave.
const ANI_STATUS: Record<string, string> = { "watched episode": "Assistiu", "rewatched episode": "Reviu", "read chapter": "Leu", "reread chapter": "Releu",
  "completed": "Terminou", "plans to watch": "Quer ver", "plans to read": "Quer ler", "dropped": "Parou", "paused watching": "Pausou", "paused reading": "Pausou" };
async function leAnilist(a: Alvo) {
  const q = (query: string, variables: any) => json("https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables }) });
  const u = await q("query($n:String){User(name:$n){id name avatar{large} siteUrl}}", { n: a.usuario });
  const U = u.d?.data?.User; if (!U) return falha(u.status === 404 || (u.d?.errors || []).some((e: any) => e.status === 404) ? 404 : u.status || 502);
  const r = await q(`query($id:Int){Page(perPage:15){activities(userId:$id,type:MEDIA_LIST,sort:ID_DESC){... on ListActivity{status progress createdAt siteUrl
    media{type isAdult title{romaji english} coverImage{large} siteUrl startDate{year}}}}}}`, { id: U.id });
  const acts = r.d?.data?.Page?.activities || [];
  const itens = acts.filter((x: any) => x && x.media && !x.media.isAdult).map((x: any) => {   // conteúdo adulto nunca entra
    const st = String(x.status || ""), verbo = ANI_STATUS[st] || (st ? st[0].toUpperCase() + st.slice(1) : "");
    const nome = x.media.title?.english || x.media.title?.romaji || "Título";
    const prog = x.progress ? (x.media.type === "MANGA" ? ` · capítulo ${x.progress}` : ` · episódio ${x.progress}`) : "";
    return { titulo: nome, ano: x.media.startDate?.year ? String(x.media.startDate.year) : "", url: https(x.siteUrl) || https(x.media.siteUrl) || a.perfil,
      texto: `${verbo}${prog}`.trim(), imagem: https(x.media.coverImage?.large), data: iso((x.createdAt || 0) * 1000), tipo: x.media.type === "MANGA" ? "manga" : "anime", nota: null, repost: false };
  });
  return { rede: a.rede, usuario: U.name || a.usuario, perfil: https(U.siteUrl) || a.perfil, nome: U.name || a.usuario, foto: https(U.avatar?.large), itens };
}

// 21/11 · xadrez: partidas recentes. Lichess (API aberta) e Chess.com (dados publicados, sem chave).
const RITMO: Record<string, string> = { bullet: "bullet", blitz: "blitz", rapid: "rápida", classical: "clássica", daily: "por correspondência", correspondence: "por correspondência" };
// 22/11 (Amanda): partidas com resultado, adversário e pontuação, ritmo, abertura e a posição final (FEN) para desenhar o tabuleiro.
// Chess.com: a liga (quando o perfil público traz) e a pontuação de cada ritmo. Sem "valendo pontos".
const LIGA: Record<string, string> = { wood: "Madeira", stone: "Pedra", bronze: "Bronze", silver: "Prata", crystal: "Cristal", elite: "Elite", champion: "Campeão", legend: "Lenda" };
const FEN_OK = /^[pnbrqkPNBRQK1-8/]{15,90}\s[wb]\b/;
const fen = (f: any) => (typeof f === "string" && FEN_OK.test(f.trim()) ? f.trim().split(" ").slice(0, 2).join(" ") : null);
function controle(tc: any): string { const t = String(tc || ""); if (/^1\/\d+$/.test(t)) return Math.round(+t.split("/")[1] / 86400) + " dia(s) por lance";
  const [b, inc] = t.split("+").map(Number); if (!isFinite(b)) return ""; const m = b >= 60 ? (b % 60 ? (b / 60).toFixed(1).replace(".", ",") : String(b / 60)) + " min" : b + " s"; return inc ? `${m} + ${inc} s` : m; }
const abre = (n: any) => String(n || "").replace(/\s+/g, " ").replace(/\s*[:,]\s*$/, "").trim().slice(0, 80);
function resultado(meu: string, outro: string, vencedor: string | null, empate: boolean) {
  return empate ? `Empatou com ${outro}` : vencedor === meu ? `Venceu ${outro}` : vencedor ? `Perdeu para ${outro}` : `Jogou contra ${outro}`;
}
async function leLichess(a: Alvo) {
  const p = await json(`https://lichess.org/api/user/${encodeURIComponent(a.usuario)}`); if (!p.ok || !p.d || p.d.disabled) return falha(p.status || 404);
  const g = await get(`https://lichess.org/api/games/user/${encodeURIComponent(a.usuario)}?max=12&moves=false&opening=true&lastFen=true`, false, { accept: "application/x-ndjson" });
  const eu = String(p.d.username || a.usuario).toLowerCase();
  const itens = (g.ok ? g.txt.split("\n") : []).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((x: any) => {
    const b = x.players?.white?.user?.name || "anônimo", w = x.players?.black?.user?.name || "anônimo";
    const minha = String(b).toLowerCase() === eu ? "white" : "black", outro = minha === "white" ? w : b;
    const empate = x.status === "draw" || x.status === "stalemate" || (!x.winner && x.status !== "started" && x.status !== "aborted");
    const ven = x.winner ? (x.winner === minha ? "v" : "d") : empate ? "e" : "";
    const ritmo = [RITMO[x.speed] || x.speed, x.clock ? controle(`${x.clock.initial}+${x.clock.increment}`) : ""].filter(Boolean).join(" · ");
    return { titulo: resultado(minha, outro, x.winner || null, empate), ano: "", url: `https://lichess.org/${x.id}`,
      texto: [ritmo, abre(x.opening?.name)].filter(Boolean).join(" · "), imagem: null,
      data: iso(x.lastMoveAt || x.createdAt), tipo: "partida", nota: null, repost: false,
      xadrez: { res: ven, adv: outro, advRating: x.players?.[minha === "white" ? "black" : "white"]?.rating || null, meuRating: x.players?.[minha]?.rating || null,
        ritmo, abertura: abre(x.opening?.name), fen: fen(x.lastFen ? x.lastFen + " w" : null), cor: minha === "white" ? "w" : "b" } };
  });
  const perfs = p.d.perfs || {}, melhor = ["blitz", "rapid", "bullet", "classical"].map((k) => [k, perfs[k]?.rating]).filter((x) => x[1]).sort((x: any, y: any) => y[1] - x[1])[0];
  return { rede: a.rede, usuario: p.d.username || a.usuario, perfil: a.perfil, nome: p.d.username || a.usuario, foto: null, itens,
    resumo: melhor ? `${melhor[1]} na ${RITMO[melhor[0] as string] || melhor[0]}` : "" };
}
async function leChesscom(a: Alvo) {
  const p = await json(`https://api.chess.com/pub/player/${a.usuario}`); if (!p.ok || !p.d) return falha(p.status || 404);
  const [ar, st] = await Promise.all([json(`https://api.chess.com/pub/player/${a.usuario}/games/archives`), json(`https://api.chess.com/pub/player/${a.usuario}/stats`)]);
  const ult = String((ar.d?.archives || []).slice(-1)[0] || "");
  const seguro = new RegExp(`^https://api\\.chess\\.com/pub/player/${a.usuario}/games/\\d{4}/\\d{2}$`, "i").test(ult);   // só o arquivo de partidas da própria pessoa
  const gs = seguro ? await json(ult) : { d: { games: [] } };
  const itens = (gs.d?.games || []).slice(-12).reverse().map((x: any) => {
    const souBranco = String(x.white?.username || "").toLowerCase() === a.usuario, eu = souBranco ? x.white : x.black, outro = souBranco ? x.black : x.white;
    const r = String(eu?.result || ""), empate = /agreed|repetition|stalemate|insufficient|50move|timevsinsufficient/.test(r);
    const venc = r === "win" ? "eu" : empate ? null : "outro";
    const abertura = (String(x.eco || "").match(/openings\/([^/?#]+)/) || [])[1]?.replace(/-/g, " ") || "";
    const ritmo = [RITMO[x.time_class] || x.time_class, controle(x.time_control)].filter(Boolean).join(" · ");
    return { titulo: resultado("eu", outro?.username || "alguém", venc, empate), ano: "", url: https(x.url) || a.perfil,
      texto: [ritmo, abre(abertura)].filter(Boolean).join(" · "), imagem: null,
      data: iso((x.end_time || 0) * 1000), tipo: "partida", nota: null, repost: false,
      xadrez: { res: venc === "eu" ? "v" : empate ? "e" : venc ? "d" : "", adv: outro?.username || "alguém", advRating: outro?.rating || null, meuRating: eu?.rating || null,
        ritmo, abertura: abre(abertura), fen: fen(x.fen), cor: souBranco ? "w" : "b" } };
  });
  const S = st.d || {}, melhor = [["chess_rapid", "rápida"], ["chess_blitz", "blitz"], ["chess_bullet", "bullet"], ["chess_daily", "por correspondência"]]
    .map(([k, n]) => [n, S[k]?.last?.rating]).filter((x) => x[1]).sort((x: any, y: any) => y[1] - x[1])[0];
  const liga = LIGA[String(p.d.league || "").toLowerCase()] || "";
  const resumo = [liga ? "Liga " + liga : "", melhor ? `${melhor[1]} na ${melhor[0]}` : ""].filter(Boolean).join(" · ");
  return { rede: a.rede, usuario: p.d.username || a.usuario, perfil: https(p.d.url) || a.perfil, nome: p.d.name || p.d.username || a.usuario, foto: https(p.d.avatar), itens, resumo };
}

// 21/11 · Steam: jogos das últimas 2 semanas, com capa e horas. Precisa da chave gratuita da Steam (segredo STEAM_KEY)
// e de perfil e detalhes de jogo públicos na Steam. Três leituras por pedido, bem abaixo do limite de 100 mil por dia.
async function leSteam(a: Alvo) {
  const k = Deno.env.get("STEAM_KEY"); if (!k) return { erro: "sem_chave", msg: "A Steam ainda não está ligada na rede.online.", status: 503 };
  let id = a.usuario;
  if (a.resolve) { const v = await json(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${k}&vanityurl=${encodeURIComponent(a.usuario)}`);
    id = v.d?.response?.steamid || ""; if (!/^7656119\d{10}$/.test(id)) return falha(404, "Não achamos esse perfil na Steam."); }
  const s = await json(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${k}&steamids=${id}`);
  const P = s.d?.response?.players?.[0]; if (!P) return falha(s.ok ? 404 : s.status, "Não achamos esse perfil na Steam.");
  if (P.communityvisibilitystate !== 3) return { erro: "privado", msg: "Esse perfil da Steam é privado. Deixe o perfil e os detalhes de jogo públicos na Steam para a prévia aparecer.", status: 403 };
  const g = await json(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${k}&steamid=${id}&count=12`);
  const horas = (m: number) => m >= 60 ? `${Math.round(m / 6) / 10} h`.replace(".", ",") : `${m} min`;
  const itens = (g.d?.response?.games || []).map((x: any) => ({ titulo: x.name || "Jogo", ano: "", url: `https://store.steampowered.com/app/${x.appid}/`,
    texto: `${horas(x.playtime_2weeks || 0)} nas últimas 2 semanas · ${horas(x.playtime_forever || 0)} no total`,
    imagem: /^\d+$/.test(String(x.appid)) ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${x.appid}/header.jpg` : null,
    data: null, tipo: "jogo", nota: null, repost: false }));
  return { rede: a.rede, usuario: a.usuario, perfil: https(P.profileurl) || a.perfil, nome: P.personaname || a.usuario, foto: https(P.avatarfull), itens,
    resumo: itens.length ? "" : "Nenhum jogo nas últimas 2 semanas, ou os detalhes de jogo estão privados na Steam." };
}

function le(a: Alvo, xml: string) {
  if (a.rede === "youtube") return leYoutube(a, xml);
  if (a.rede === "github") return leGithub(a, xml);
  if (a.rede === "itchio") return leItch(a, xml);
  const o = parser.parse(xml); const ch = o?.rss?.channel; if (!ch) return null;
  const itens = lista(ch.item).slice(0, 30).map((it: any) => {
    const corpo = texto(it["content:encoded"]) || texto(it.description);
    const url = texto(it.link) || texto(it.guid);
    const data = texto(it.pubDate) || texto(it["dc:date"]);
    let titulo = limpa(texto(it.title)), tx = "", tipo = "post", nota: number | null = null, ano = "", repost = false;
    let img: string | null = null;
    for (const e of lista(it.enclosure)) if (/^image\//.test(e["@_type"] || "")) img = e["@_url"];
    if (!img) img = imgDe(corpo);
    if (a.rede === "letterboxd") {
      const g = texto(it.guid);
      tipo = /-list-/.test(g) ? "lista" : /-review-/.test(g) ? "critica" : "diario";
      if (texto(it["letterboxd:filmTitle"])) { titulo = limpa(texto(it["letterboxd:filmTitle"])); ano = texto(it["letterboxd:filmYear"]); }
      const r = parseFloat(texto(it["letterboxd:memberRating"])); nota = isFinite(r) && r > 0 ? r : null;
      // tira o pôster e a linha "Watched on …"; o que sobra é a crítica (quando há)
      tx = limpa(corpo.replace(/<p>\s*<img[^>]*>\s*<\/p>/i, "").replace(/<p>\s*Watched on [^<]*<\/p>/i, "").replace(/<p>\s*This review may contain spoilers\.?\s*<\/p>/i, ""));
      if (it["letterboxd:rewatch"] && /yes/i.test(texto(it["letterboxd:rewatch"]))) tipo = "revisto";
    } else if (a.rede === "pinterest") {
      tipo = "pin"; repost = true;   // no Pinterest, o perfil reúne o que a pessoa salvou (dela ou de outras pessoas)
      tx = limpa(corpo); if (tx === titulo) tx = "";
    } else {
      tx = limpa(a.rede === "substack" ? (texto(it.description) || corpo) : corpo).replace(/\s*Continue reading on [^.]*»?\s*$/i, "");
    }
    return { titulo: titulo || "Sem título", ano, url, texto: trecho(tx), imagem: img && img.startsWith("https://") ? img : null, data: data ? new Date(data).toISOString() : null, tipo, nota, repost };
  }).filter((i: any) => /^https?:\/\//.test(i.url));
  const nome = limpa(texto(ch.title)).replace(/^Letterboxd\s*-\s*/i, "").replace(/\s+on Medium$/i, "").replace(/^Stories by\s+/i, "");
  const foto = texto(ch.image?.url) || null;
  return { rede: a.rede, usuario: a.usuario, perfil: a.perfil, nome, foto: foto && foto.startsWith("https://") ? foto : null, itens };
}

// 21/11: limite simples por endereço de origem, por instância da função: 40 pedidos por minuto
const JANELA = new Map<string, number[]>();
function demais(ip: string) { const ag = Date.now(), xs = (JANELA.get(ip) || []).filter((t) => ag - t < 60000); xs.push(ag); JANELA.set(ip, xs);
  if (JANELA.size > 5000) JANELA.clear(); return xs.length > 40; }
// 21/11: a Steam usa a chave da rede.online; só quem está com a conta aberta pede (o token é conferido no Auth do próprio Supabase)
async function logado(req: Request) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!t || !url || !anon || t === anon) return false;
  try { const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: `Bearer ${t}`, apikey: anon } }); return r.ok; } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  if (demais(ip)) return new Response(JSON.stringify({ erro: "muitos", msg: "Muitos pedidos seguidos. Tente de novo em um minuto." }), { status: 429, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
  const q = new URL(req.url).searchParams;
  const resp = (b: any, status = 200, cache = 0) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...(cache ? { "cache-control": `public, max-age=${cache}` } : {}) } });
  const a = alvo(q.get("rede") || "", q.get("usuario") || "");
  if (!a) return resp({ erro: "usuario", msg: "Nome de usuário ou endereço que não reconhecemos." }, 400);
  // 21/11: as que respondem por API, não por feed
  const API: Record<string, (a: Alvo) => Promise<any>> = { anilist: leAnilist, lichess: leLichess, chesscom: leChesscom, steam: leSteam };
  if (API[a.rede]) {
    if (a.rede === "steam" && !(await logado(req))) return resp({ erro: "entrar", msg: "Entre na sua conta para ver a prévia da Steam." }, 401);
    let d: any = null; try { d = await API[a.rede](a); } catch { d = { erro: "rede", msg: "A rede não respondeu agora. Tente de novo em alguns minutos.", status: 502 }; }
    if (d.erro) return resp({ erro: d.erro, msg: d.msg }, d.status === 404 ? 404 : d.status === 403 ? 403 : d.status === 503 ? 503 : 502);
    return resp(d, 200, a.rede === "steam" ? 0 : 900);   // Steam: pedido com conta aberta, a resposta não fica em cache compartilhado
  }
  if (a.resolve) {   // YouTube por @: a página pública do canal diz qual é o código do canal (UC…)
    const p = await get(a.perfil, true);
    const m = p.txt.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) || p.txt.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/);
    if (!m) return resp({ erro: "nao_achou", msg: "Não achamos esse canal no YouTube." }, 404);
    a.feed = `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`; a.perfil = `https://www.youtube.com/${a.usuario}`;
  }
  const r = await get(a.feed);
  if (!r.ok && a.rede === "youtube" && r.status === 404 && a.feed.includes("channel_id=")) {   // canal sem nenhum vídeo próprio: o feed não existe, mas as playlists podem existir
    const pl = await playlists(a.feed.split("channel_id=")[1] || "").catch(() => []);
    if (pl.length) return resp({ rede: a.rede, usuario: a.usuario, perfil: a.perfil, nome: a.usuario, foto: null, itens: pl }, 200, 900);
  }
  if (!r.ok) return resp({ erro: r.status === 404 ? "nao_achou" : "rede", msg: r.status === 404 ? (a.feed.includes("playlist_id=") ? "Não achamos essa playlist, ou ela não é pública." : "Não achamos esse perfil, ou ele é privado.") : "A rede não respondeu agora. Tente de novo em alguns minutos.", status: r.status }, r.status === 404 ? 404 : 502);
  if (a.checa && !a.checa.test(r.txt.slice(0, 20000))) return resp({ erro: "nao_substack", msg: "Esse endereço não é de uma publicação do Substack." }, 400);
  let d: any = null; try { d = le(a, r.txt); } catch { d = null; }
  if (!d) return resp({ erro: "feed", msg: "Esse perfil não tem um feed público para ler." }, 422);
  if (a.rede === "youtube" && /^UC/.test(a.feed.split("channel_id=")[1] || "")) { try { d.itens = d.itens.concat(await playlists(a.feed.split("channel_id=")[1] || "")); } catch { /* sem playlists: segue só com os vídeos */ } }
  return resp(d, 200, 900);
});

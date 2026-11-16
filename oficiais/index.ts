// arede.online · OFICIAIS: dados de interfaces oficiais viram documentos na aba Documentos (16/11/2026, pedido da Amanda).
// Fontes: Câmara (votações do plenário), Senado (votações), IBGE (IPCA, desocupação, PIB), Banco Central (Selic),
// Querido Diário (diários oficiais das capitais) e Portal da Transparência (gastos; só com a chave TRANSPARENCIA_CHAVE).
// Só leitura de interfaces públicas feitas para programas; nada é publicado em nome de ninguém.
// Chamada pela rotina de hora em hora com o cabeçalho x-coletor (mesma chave do coletor).
import { createClient } from "npm:@supabase/supabase-js@2";

const SB = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UA = "arede-oficiais/1.0 (+https://arede.online/)";
const hoje = () => new Date(Date.now() - 3 * 3600e3);   // horário de Brasília
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dias = (n: number) => new Date(Date.now() - n * 864e5);
const num = (v: string | number) => String(v).replace(".", ",");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

async function getJSON(url: string, headers: Record<string, string> = {}, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": UA, accept: "application/json", ...headers } });
    if (!r.ok) throw new Error(url + " respondeu " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// 16/11 (Amanda): o voto do texto principal (inclusive substitutivo) é o que decide; vale igual na Câmara e no Senado.
// Um cartão por projeto no Tudo: cada votação guarda a matéria ("PL 504/2021") para o site agrupar.
const SIGLAS: [RegExp, string][] = [[/projeto de lei complementar/i, "PLP"], [/projeto de decreto legislativo/i, "PDL"], [/projeto de lei de convers[aã]o/i, "PLV"], [/projeto de lei/i, "PL"],
  [/proposta de emenda (à|a) constitui[cç][aã]o/i, "PEC"], [/medida provis[oó]ria/i, "MPV"]];
function materiaDe(t: string): string | null {
  const m = t.match(/\b(PLP|PDL|PLV|PEC|MPV|PL)\s*n?[ºo°]?\s*([\d.]+)\s*(?:\/|,?\s*de\s*)(\d{4})/i);
  if (m) return `${m[1].toUpperCase()} ${m[2].replace(/\./g, "")}/${m[3]}`;
  for (const [re, sg] of SIGLAS) { const r = t.match(new RegExp(re.source + "\\s*n[ºo°]?\\s*([\\d.]+),?\\s*de\\s*(\\d{4})", "i")); if (r) return `${sg} ${r[1].replace(/\./g, "")}/${r[2]}`; }
  return null;
}
const RESSALVA = /,?\s*ressalvad[oa]s? os destaques\.?/i;
// 16/11 (Amanda): resumo curto, que cabe no cartão; a ementa vai à parte (dados.ementa) e aparece no cartão aberto
const RESSALVA_TXT = "Trechos ainda vão a voto.";
// voto de mérito: o projeto ou o texto que o substitui; não o de um trecho (destaque) nem de uma emenda avulsa
const merito = (t: string) => { const x = t.replace(RESSALVA, ""); return /substitutiv/i.test(x) || (/\b(projeto|proposta de emenda|pec|medida provis|plp|pl)\b/i.test(x) && !/\bdestaques?\b|\bemenda n[ºo°]/i.test(x)); };

type Doc = { chave: string; tipo: string; fonte: string; titulo: string; resumo?: string | null; valor?: string | null; anterior?: string | null;
  url: string; publicado_em: string; cidade?: string | null; uf?: string | null; destaque?: boolean; dados?: any };

// CÂMARA: votações do plenário (órgão 180) dos últimos 3 dias. Grande: aprovação ou rejeição de projeto, PEC ou MP.
async function camara(): Promise<Doc[]> {
  const j = await getJSON(`https://dadosabertos.camara.leg.br/api/v2/votacoes?idOrgao=180&dataInicio=${iso(dias(10))}&ordem=DESC&ordenarPor=dataHoraRegistro&itens=50`);
  const PROC = /requerimento|reda[cç][aã]o final|regime de tramita|recurso|retirada de pauta|adiamento|encerramento da discuss|quebra de interst|preferência/i;
  return (j.dados || []).filter((v: any) => v.descricao && !PROC.test(v.descricao)).map((v: any) => {
    const ev = String(v.uriEvento || "").split("/").pop();
    const d0 = v.descricao.replace(/\s+/g, " ").trim(), ress = RESSALVA.test(d0), desc = d0.replace(RESSALVA, ".").replace(/\.\.$/, ".");
    const grande = /^(aprovad|rejeitad)[ao]s?\b/i.test(desc) && merito(desc);
    return { chave: "camara-" + v.id, tipo: "votacao", fonte: "Câmara dos Deputados", titulo: "Câmara: " + desc,
      // o título da Câmara já diz "Aprovado o…" ou "Rejeitado o…": o resumo só entra quando ainda há trechos a votar
      resumo: ress && v.aprovacao === 1 ? "Texto principal aprovado. " + RESSALVA_TXT : null,
      url: ev ? `https://www.camara.leg.br/evento-legislativo/${ev}` : "https://www.camara.leg.br/", publicado_em: new Date((v.dataHoraRegistro || v.data) + "-03:00").toISOString(),
      destaque: grande, dados: { id: v.id, aprovacao: v.aprovacao, materia: materiaDe(desc) } };
  });
}

// SENADO: votações do plenário dos últimos 10 dias (serviço de dados abertos /votacao, que substituiu o antigo em 2026).
async function senado(): Promise<Doc[]> {
  const j = await getJSON(`https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=${iso(dias(10))}&dataFim=${iso(hoje())}`);
  const RES: Record<string, string> = { A: "Aprovado", R: "Rejeitado" };
  return (Array.isArray(j) ? j : []).filter((v: any) => v && v.descricaoVotacao && !/requerimento/i.test(v.descricaoVotacao)).map((v: any) => {
    const res = RES[String(v.resultadoVotacao || "").trim()] || "";
    const d0 = String(v.descricaoVotacao).replace(/\s+/g, " ").replace(/^vota[cç][aã]o nominal d[oa]s?\s+/i, "").trim(), ress = RESSALVA.test(d0);
    const desc = d0.replace(RESSALVA, "").replace(/,?\s*nos termos d[oa]s? parecer(es)?\.?$/i, "").replace(/^emenda n[ºo°]\s*[\d.]+\s*\(substitutivo\)\s+/i, "Substitutivo ").replace(/[.,;]\s*$/, "").trim();
    const vs = Array.isArray(v.votos) ? v.votos : [];
    const sim = vs.filter((x: any) => /^sim$/i.test(x.siglaVotoParlamentar)).length, nao = vs.filter((x: any) => /^n[aã]o$/i.test(x.siglaVotoParlamentar)).length;
    const placar = vs.length ? `${sim} sim · ${nao} não` : null, aXb = vs.length ? `: ${sim} a ${nao}` : "";
    const ementa = String(v.ementa || "").replace(/\s+/g, " ").trim();
    return { chave: "senado-" + (v.codigoSessaoVotacao || v.sequencialVotacao || desc.slice(0, 60)), tipo: "votacao", fonte: "Senado Federal",
      titulo: "Senado: " + desc.charAt(0).toUpperCase() + desc.slice(1),
      resumo: (ress && res === "Aprovado" ? `Texto principal aprovado${aXb}. ${RESSALVA_TXT}` : res ? `${res}${aXb}.` : "") || null, valor: placar,
      url: v.codigoMateria ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${v.codigoMateria}` : "https://www25.senado.leg.br/web/atividade/plenario",
      publicado_em: new Date((v.dataSessao || iso(hoje())) + "T18:00:00-03:00").toISOString(),
      destaque: /aprovad|rejeitad/i.test(res) && merito(d0),
      dados: { codigo: v.codigoSessaoVotacao, codigoMateria: v.codigoMateria, ementa: ementa || null, materia: (v.identificacao ? String(v.identificacao).replace(/\s+/g, " ").trim() : null) || materiaDe(desc) } };
  });
}

// IBGE: os indicadores mais acompanhados. Cada divulgação nova vira um documento (com o valor anterior ao lado).
const IBGE = [
  { ag: 7060, v: 63, nome: "IPCA", frase: (p: string) => `IPCA de ${mesDe(p)}`, un: "%", url: "https://www.ibge.gov.br/explica/inflacao.php" },
  { ag: 6381, v: 4099, nome: "Desocupação", frase: (p: string) => `Taxa de desocupação no trimestre até ${mesDe(p)}`, un: "%", url: "https://www.ibge.gov.br/explica/desemprego.php" },
  { ag: 5932, v: 6564, cl: "&classificacao=11255[90707]", nome: "PIB", frase: (p: string) => `PIB do ${+p.slice(4)}º trimestre de ${p.slice(0, 4)} (frente ao trimestre anterior)`, un: "%", url: "https://www.ibge.gov.br/explica/pib.php" },
];
const mesDe = (p: string) => (MESES[+p.slice(4, 6) - 1] || p.slice(4)) + " de " + p.slice(0, 4);
async function ibge(): Promise<Doc[]> {
  const out: Doc[] = [];
  for (const x of IBGE) {
    try {
      const j = await getJSON(`https://servicodados.ibge.gov.br/api/v3/agregados/${x.ag}/periodos/-2/variaveis/${x.v}?localidades=N1[all]${(x as any).cl || ""}`);
      const s = j?.[0]?.resultados?.[0]?.series?.[0]?.serie || {}, ks = Object.keys(s).sort();
      if (!ks.length) continue;
      const p = ks[ks.length - 1], ant = ks.length > 1 ? ks[ks.length - 2] : null, val = s[p];
      if (!/^-?\d/.test(String(val ?? ""))) continue;
      out.push({ chave: `ibge-${x.ag}-${x.v}-${p}`, tipo: "indicador", fonte: "IBGE", titulo: `${x.frase(p)}: ${num(val)}${x.un}`,
        resumo: ant && /^-?\d/.test(String(s[ant] ?? "")) ? `Antes: ${num(s[ant])}${x.un}.` : null, valor: num(val) + x.un, anterior: ant ? num(s[ant]) + x.un : null,
        url: x.url, publicado_em: new Date().toISOString(), destaque: true, dados: { agregado: x.ag, variavel: x.v, periodo: p } });
    } catch (_) { /* um indicador fora do ar não para os outros */ }
  }
  return out;
}

// BANCO CENTRAL: meta da Selic (série 432). Vira documento quando a meta muda.
async function bcb(): Promise<Doc[]> {
  const j = await getJSON(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=${iso(dias(150)).split("-").reverse().join("/")}&dataFinal=${iso(hoje()).split("-").reverse().join("/")}`);
  const hojeS = iso(hoje()), l = (j || []).map((r: any) => ({ d: r.data.split("/").reverse().join("-"), v: r.valor })).filter((r: any) => r.d <= hojeS);
  if (!l.length) return [];
  let i = l.length - 1; while (i > 0 && l[i - 1].v === l[i].v) i--;
  const cur = l[l.length - 1], desde = l[i], ant = i > 0 ? l[i - 1].v : null;
  return [{ chave: `bcb-432-${desde.d}-${cur.v}`, tipo: "indicador", fonte: "Banco Central do Brasil", titulo: `Selic: ${num(cur.v)}% ao ano`,
    resumo: ant ? `Antes: ${num(ant)}% ao ano. Vale desde ${desde.d.split("-").reverse().join("/")}.` : `Vale desde ${desde.d.split("-").reverse().join("/")}.`,
    valor: num(cur.v) + "%", anterior: ant ? num(ant) + "%" : null, url: "https://www.bcb.gov.br/controleinflacao/historicotaxasjuros",
    publicado_em: new Date(desde.d + "T12:00:00-03:00").toISOString(), destaque: !!ant, dados: { serie: 432, desde: desde.d } }];
}

// QUERIDO DIÁRIO: diários oficiais das capitais com termos de interesse público, dos últimos 2 dias.
const CAPITAIS: Record<string, [string, string]> = { "1200401": ["Rio Branco", "AC"], "2704302": ["Maceió", "AL"], "1600303": ["Macapá", "AP"], "1302603": ["Manaus", "AM"],
  "2927408": ["Salvador", "BA"], "2304400": ["Fortaleza", "CE"], "5300108": ["Brasília", "DF"], "3205309": ["Vitória", "ES"], "5208707": ["Goiânia", "GO"],
  "2111300": ["São Luís", "MA"], "5103403": ["Cuiabá", "MT"], "5002704": ["Campo Grande", "MS"], "3106200": ["Belo Horizonte", "MG"], "1501402": ["Belém", "PA"],
  "2507507": ["João Pessoa", "PB"], "4106902": ["Curitiba", "PR"], "2611606": ["Recife", "PE"], "2211001": ["Teresina", "PI"], "3304557": ["Rio de Janeiro", "RJ"],
  "2408102": ["Natal", "RN"], "4314902": ["Porto Alegre", "RS"], "1100205": ["Porto Velho", "RO"], "1400100": ["Boa Vista", "RR"], "4205407": ["Florianópolis", "SC"],
  "3550308": ["São Paulo", "SP"], "2800308": ["Aracaju", "SE"], "1721000": ["Palmas", "TO"] };
async function queridoDiario(): Promise<Doc[]> {
  const ids = Object.keys(CAPITAIS).map((k) => "territory_ids=" + k).join("&");
  const q = encodeURIComponent('"licitação" | "contrato" | "nomeação" | "decreto" | "orçamento" | "concurso público"');
  const j = await getJSON(`https://queridodiario.ok.org.br/api/gazettes?${ids}&since=${iso(dias(2))}&querystring=${q}&excerpt_size=280&number_of_excerpts=1&size=60&sort_by=descending_date`, {}, 55000);
  return (j.gazettes || []).map((g: any) => {
    const [cid, uf] = CAPITAIS[g.territory_id] || [g.territory_name || "", g.state_code || ""];
    const tr = String((g.excerpts || [])[0] || "").replace(/\s+/g, " ").trim();
    const data = String(g.date || iso(hoje()));
    return { chave: "qd-" + (g.url || g.txt_url || g.territory_id + data), tipo: "diario", fonte: "Querido Diário", titulo: `Diário oficial de ${cid}, ${data.split("-").reverse().slice(0, 2).join("/")}`,
      resumo: tr ? tr.slice(0, 280) : null, url: g.url || g.txt_url || "https://queridodiario.ok.org.br/", publicado_em: new Date(data + "T08:00:00-03:00").toISOString(),
      cidade: cid, uf, destaque: false, dados: { territorio: g.territory_id, edicao: g.edition || null } };
  });
}

// PORTAL DA TRANSPARÊNCIA: contratos federais acima de R$ 10 milhões dos últimos 3 dias. Precisa da chave gratuita do governo.
async function transparencia(): Promise<Doc[]> {
  const chave = Deno.env.get("TRANSPARENCIA_CHAVE"); if (!chave) return [];
  const f = (d: Date) => iso(d).split("-").reverse().join("/");
  const j = await getJSON(`https://api.portaldatransparencia.gov.br/api-de-dados/contratos?dataInicial=${f(dias(3))}&dataFinal=${f(hoje())}&pagina=1`, { "chave-api-dados": chave });
  return (j || []).filter((c: any) => +c.valorInicialCompra >= 1e7).map((c: any) => {
    const v = (+c.valorInicialCompra).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
    const org = c.unidadeGestora?.orgaoVinculado?.nome || c.unidadeGestora?.nome || "Governo federal";
    return { chave: "cgu-" + c.id, tipo: "gasto", fonte: "Portal da Transparência", titulo: `${org}: contrato de ${v}`,
      resumo: String(c.objeto || "").replace(/\s+/g, " ").trim().slice(0, 280) || null, valor: v,
      url: `https://portaldatransparencia.gov.br/contratos/${c.id}`, publicado_em: new Date((c.dataAssinatura || iso(hoje())).split("/").reverse().join("-") + "T12:00:00-03:00").toISOString(),
      destaque: true, dados: { id: c.id, fornecedor: c.fornecedor?.nome || null } };
  });
}

Deno.serve(async (req) => {
  const { data: ok } = await SB.rpc("coletor_chave_confere", { k: req.headers.get("x-coletor") || "" });
  if (!ok) return new Response(JSON.stringify({ erro: "não autorizado" }), { status: 401 });
  // ?ver=<url> mostra o começo da resposta crua de uma interface oficial (só para conferir formato; exige a chave)
  const ver = new URL(req.url).searchParams.get("ver");
  if (ver && /^https:\/\/[a-z0-9.-]+\.(gov\.br|leg\.br|org\.br)\//.test(ver)) {
    try { const r = await fetch(ver, { headers: { "user-agent": UA, accept: "application/json" } }); return new Response(JSON.stringify({ status: r.status, corpo: (await r.text()).slice(0, 3000) })); }
    catch (e) { return new Response(JSON.stringify({ erro: String(e) })); }
  }
  const rel: Record<string, any> = {};
  for (const [nome, fn] of Object.entries({ camara, senado, ibge, bcb, queridoDiario, transparencia })) {
    try {
      const docs = await (fn as () => Promise<Doc[]>)();
      if (docs.length) {
        // indicador já guardado não muda a data: o upsert ignora o que já existe
        // 16/11: votação é regravada a cada coleta (formato novo vale para as já guardadas, sem apagar); indicador e diário só entram se forem novos
        const { error } = await SB.from("dados_oficiais").upsert(docs, { onConflict: "chave", ignoreDuplicates: !(nome === "camara" || nome === "senado") });
        rel[nome] = error ? { erro: error.message } : { lidos: docs.length };
      } else rel[nome] = { lidos: 0 };
    } catch (e) { rel[nome] = { erro: String(e).slice(0, 200) }; }
  }
  return new Response(JSON.stringify(rel), { headers: { "content-type": "application/json" } });
});

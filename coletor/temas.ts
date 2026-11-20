// arede.online · TEMAS (20 nov 2026): 15 temas principais e 4 temas leves, cada um com subtemas, para agrupar as notícias, filtrar o feed e calibrar o algoritmo.
// Classificação por pontos: cada termo do título vale 2, da chamada vale 1; vence o tema com mais pontos (empate: a ordem abaixo).
// Tema secundário: o segundo colocado, quando tem pelo menos metade dos pontos do principal (só entre temas principais).
// Subtema: o mesmo cálculo, só entre os subtemas do tema; sem nenhum termo, a notícia fica só com o tema.
// Temas leves (esporte, entretenimento, sorte e signos, casa e consumo) só aparecem no feed de quem escolhe.
// Sem nenhum termo, a notícia fica em "Outros" (não vira filtro). O texto é comparado sem acentos e em minúsculas, em pt, en e es.
// A lista que vale é a do Painel (Regras › Temas, tabela privado.taxonomia); este arquivo é a cópia de partida e a reserva se o banco não responder.
export const TEMAS_LISTA = ["Política e governo", "Economia e trabalho", "Segurança pública", "Justiça", "Direitos e igualdade", "Saúde", "Educação",
  "Meio ambiente e clima", "Mobilidade", "Moradia", "Saneamento", "Alimentação e campo", "Ciência e tecnologia", "Cultura", "Mundo"];
export const TEMAS_LEVES = ["Esporte", "Entretenimento", "Sorte e signos", "Casa e consumo"];
export const TEMA_OUTROS = "Outros";

const T = (...p: string[]) => new RegExp("\\b(" + p.join("|") + ")\\b", "g");
export const TEMAS_TERMOS: [string, RegExp][] = [
  ["Política e governo", T(
    "congresso", "senado\\w*", "senador\\w*", "deputad\\w*", "camara dos deputados", "camara municipal", "camara aprova", "comissao aprova", "plenario", "vereador\\w*", "assembleia legislativa", "eleic\\w*", "eleitor\\w*", "eleitora\\w*",
    "candidat\\w*", "partido\\w*", "pt", "pl", "psdb", "mdb", "psol", "uniao brasil", "psb", "pdt", "psd", "federacao partidaria", "partidari\\w*", "debate eleitoral", "labor party", "exalcalde\\w*", "republicanos", "presidente da republica", "planalto", "ministr[oa]s?", "ministerio\\w*", "governador\\w*", "governo",
    "prefeit[oa]s?", "prefeitura\\w*", "lula", "bolsonaro", "alcolumbre", "hugo motta", "governo federal", "governo lula", "base aliada", "oposicao", "cpmi", "cpi", "projeto de lei", "pec", "plp",
    "medida provisoria", "impeachment", "veto\\w*", "sancion\\w*", "orcamento", "ajuste fiscal", "arcabouco", "emenda\\w* parlamentar\\w*", "reforma ministerial", "licitac\\w*", "audiencia publica",
    "orcamento participativo", "conselho municipal", "consulta publica", "plebiscito", "referendo", "tse", "urna\\w*", "gestao publica", "servidor\\w* public\\w*",
    "congress", "senate", "senator\\w*", "lawmaker\\w*", "mps", "election\\w*", "voter\\w*", "campaign", "democrat\\w*", "republican\\w*", "white house", "governor\\w*", "mayor\\w*", "parliament\\w*", "prime minister",
    "congreso", "senado", "diputad\\w*", "elecciones", "eleccion", "votantes", "gobierno", "gobernador\\w*", "alcalde\\w*", "presidencia", "parlamento", "oficialismo", "oposicion", "psoe", "vox", "feijoo")],
  ["Economia e trabalho", T(
    "economia\\w*", "economic\\w*", "pib", "inflac\\w*", "ipca", "juros", "selic", "banco central", "copom", "dolar", "cambio", "bolsa\\w*", "ibovespa", "acoes da \\w+", "mercado financeiro", "banco\\w*", "bc", "fed", "financas", "financeir\\w*", "logistic\\w*", "investidor\\w*",
    "investiment\\w*", "lucro\\w*", "prejuizo\\w*", "receita\\w*", "faturamento", "empresa\\w*", "empresari\\w*", "industria\\w*", "comercio", "varejo", "exportac\\w*", "importac\\w*", "tarifa\\w* de importacao",
    "imposto\\w*", "tribut\\w*", "reforma tributaria", "cbs", "ibs", "irpf", "imposto de renda", "fiscal", "divida\\w*", "credito", "credor\\w*", "falencia", "recuperacao judicial", "ipo", "startups?", "empreendedor\\w*",
    "emprego\\w*", "desemprego", "trabalh\\w*", "salario\\w*", "salario minimo", "renda", "clt", "escala 6x1", "jornada", "greve\\w*", "sindicat\\w*", "aposentadori\\w*", "inss", "previdencia", "vagas de emprego",
    "bolsa familia", "beneficio\\w*", "pix", "fgts", "mei", "petrobras", "anp", "aneel", "ceo", "boeing", "airbus", "embraer", "turismo", "conta de luz", "combustive\\w*", "gasolina", "diesel", "precos?", "custo de vida", "consumidor\\w*",
    "economy", "inflation", "banks?", "banking", "interest rates?", "stocks?", "shares", "market\\w*", "investor\\w*", "earnings", "profit\\w*", "revenue", "tariff\\w*", "jobs", "unemployment", "wages?", "workers?", "strike\\w*", "union\\w*", "entrepreneurs?",
    "economia", "inflacion", "tasas?", "mercados?", "empleo\\w*", "desempleo", "trabajador\\w*", "salarios?", "huelga\\w*", "impuestos?", "precios?", "empresas?", "paro de \\w+")],
  ["Segurança pública", T(
    "policia\\w*", "pm", "pf", "policia federal", "prf", "delegacia\\w*", "delegad\\w*", "preso\\w*", "presa\\w*", "prisao", "prisoes", "prende\\w*", "detid\\w*", "suspeit\\w*",
    "operacao", "crime\\w*", "criminos\\w*", "desaparecid\\w*", "corpo de", "corpo e encontrado", "encontrad[oa] mort[oa]", "afogad\\w*", "homicidio\\w*", "assassin\\w*", "tiro\\w*", "baleado\\w*", "assalto\\w*", "roubo\\w*", "furto\\w*", "furta\\w*", "ladr\\w*", "golpe\\w*",
    "trafico", "traficante\\w*", "faccao", "faccoes", "milicia\\w*", "sequestro\\w*", "violencia", "agress\\w*", "estupro\\w*", "feminicidio\\w*", "abuso\\w*", "chacina\\w*", "tiroteio\\w*", "presidio\\w*", "penitenciari\\w*", "sistema prisional", "detento\\w*", "carcerari\\w*",
    "police", "arrest\\w*", "crime\\w*", "murder\\w*", "shooting", "killed", "stabbing", "gang\\w*", "prison\\w*", "body found", "missing", "drink spiking", "sexual assault",
    "policia", "detenido\\w*", "asesinat\\w*", "homicidio", "narcotrafico", "carcel", "sicarios?", "carteles?", "crimen")],
  ["Justiça", T(
    "justica", "juiz\\w*", "supremo", "audiencia (nacional|provincial|de \\w+)", "juiza\\w*", "tribunal", "tribunais", "stf", "stj", "tst", "trf\\w*", "tj\\w{2}", "ministro do stf", "fachin", "moraes", "dino", "gilmar", "pgr", "procurador\\w*", "ministerio publico", "mp", "defensoria\\w*",
    "denuncia\\w*", "condenad\\w*", "condenac\\w*", "absolvid\\w*", "julgamento\\w*", "julga\\w*", "juri", "sentenca", "habeas corpus", "processo\\w*", "acusad\\w*", "reu", "inquerito\\w*", "investigac\\w*", "indiciad\\w*", "delac\\w*", "fake news",
    "court\\w*", "judge\\w*", "trial", "lawsuit\\w*", "prosecutor\\w*", "charged", "sentenced", "supreme court", "inquiry", "indicted", "verdict",
    "tribunal", "juez", "jueza", "juicio", "fiscalia", "condena\\w*", "suprema corte", "audiencia judicial")],
  ["Direitos e igualdade", T(
    "direitos humanos", "direito\\w* d[ao]s?", "racismo", "racista\\w*", "racial", "injuria racial", "negr[oa]s", "quilombo\\w*", "quilombola\\w*", "indigena\\w*", "povos? originari\\w*", "terra\\w* indigena\\w*",
    "comunidades tradicionais", "consciencia negra", "zumbi dos palmares", "zumbi", "novembro negro", "escravizad\\w*", "ancianos", "orientac\\w* sexual", "funai", "mulher\\w*", "feminis\\w*", "machismo", "genero", "violencia domestica", "lei maria da penha", "igualdade", "desigualdade\\w*", "discrimina\\w*", "representatividade", "gestantes?",
    "lgbt\\w*", "lgbtqia\\w*", "trans", "transfobia", "homofobia", "pessoa\\w* com deficiencia", "deficiencia", "acessibilidade", "autis\\w*", "idos[oa]s", "crianca\\w*", "infanc\\w*", "adolescente\\w*",
    "juventude", "jovens", "refugiad\\w*", "migrante\\w*", "imigrante\\w*", "populacao de rua", "situacao de rua", "trabalho escravo", "trabalho infantil", "trabalho de cuidado", "inclusao social",
    "human rights", "civil rights", "racism", "racial", "indigenous", "women", "gender", "lgbtq\\w*", "transgender", "disabilit\\w*", "refugee\\w*", "migrants?", "immigrants?", "discrimination", "equality",
    "derechos humanos", "racismo", "indigenas?", "mujeres", "genero", "migrantes", "refugiados", "discriminacion", "igualdad")],
  ["Saúde", T(
    "saude", "sus", "hospita\\w*", "ubs", "upa", "posto\\w* de saude", "medic[oa]s?", "enfermeir\\w*", "vacina\\w*", "vacinac\\w*", "imuniza\\w*", "dengue", "chikungunya", "zika", "covid\\w*", "gripe",
    "influenza", "sarampo", "tuberculose", "hiv", "aids", "cancer", "diabetes", "obesidade", "doenca\\w*", "epidemi\\w*", "pandemi\\w*", "surto\\w*", "anvisa", "remedio\\w*", "medicament\\w*",
    "saude mental", "depressao", "ansiedade", "suicidio", "cirurgia\\w*", "transplante\\w*", "exames?", "pacientes?", "glaucoma", "bulas?", "ozempic", "wegovy", "cerebro", "hormonio\\w*", "sono", "novembro azul", "outubro rosa", "sintoma\\w*", "tratamento\\w*", "plano\\w* de saude", "oms", "opas", "fiocruz", "psicolog\\w*", "alzheimer", "suplemento\\w*", "creatina", "vitamina\\w*", "nutric\\w*", "clinicas?", "clinics?",
    "health", "hospital\\w*", "doctors?", "nurses?", "vaccin\\w*", "disease\\w*", "outbreak\\w*", "virus", "cancer", "mental health",
    "salud", "hospitales", "medicos?", "vacunas?", "enfermedad\\w*", "brote\\w*")],
  ["Educação", T(
    "educac\\w*", "escola\\w*", "ensino", "aluno\\w*", "aluna\\w*", "estudante\\w*", "professor\\w*", "professora\\w*", "docente\\w*", "universidade\\w*", "faculdade\\w*", "enem", "sisu", "prouni",
    "fies", "vestibular\\w*", "mec", "inep", "creche\\w*", "alfabetiza\\w*", "merenda", "sala\\w* de aula", "bolsa\\w* de estudo", "pos-graduacao", "capes", "cnpq", "iftm", "if\\w{2,3}", "usp", "unicamp", "unesp", "ufmg", "ufrj", "estagio\\w*",
    "education", "schools?", "students?", "teachers?", "universit\\w*", "college\\w*", "campus",
    "educacion", "escuela\\w*", "estudiantes?", "docentes?", "maestros?", "universidad\\w*")],
  ["Meio ambiente e clima", T(
    "meio ambiente", "ambiental\\w*", "clima", "climatic\\w*", "aquecimento global", "cop ?30", "cop ?31", "emiss\\w*", "carbono", "desmatamento", "amazonia", "cerrado", "pantanal", "mata atlantica",
    "floresta\\w*", "queimada\\w*", "incendio\\w* florest\\w*", "biodiversidade", "especie\\w*", "fauna", "flora", "ibama", "icmbio", "garimpo\\w*", "mineracao", "terras raras", "poluic\\w*", "aves silvestres", "animais silvestres", "aves", "golfinho\\w*", "baleia\\w*", "tartaruga\\w*", "lobo-marinho", "onca\\w*", "ameacad[oa]s? de extincao", "previsao do tempo", "temperaturas?", "overfishing", "wildlife",
    "enchente\\w*", "inundac\\w*", "chuva\\w*", "temporal", "seca", "estiagem", "onda de calor", "calor extremo", "frente fria", "ciclone\\w*", "tempestade\\w*", "deslizamento\\w*", "defesa civil", "terremoto\\w*", "sismo\\w*",
    "energia solar", "energia eolica", "renovave\\w*", "transicao energetica", "petroleo na foz", "oceano\\w*", "recicla\\w*", "plastico\\w*",
    "climate", "environment\\w*", "el nino", "la nina", "emissions?", "deforestation", "wildfires?", "floods?", "flooding", "storms?", "hurricanes?", "drought", "heatwave", "renewable\\w*", "species", "pollution", "earthquake\\w*",
    "clima", "ambiental", "medio ambiente", "deforestacion", "incendios?", "inundaciones", "tormenta", "huracan", "sequia", "emisiones", "contaminacion", "temblor", "sismo")],
  ["Mobilidade", T(
    "mobilidade", "transporte\\w*", "onibus", "metro", "trem", "trens", "brt", "vlt", "ciclovia\\w*", "ciclofaixa\\w*", "bicicleta\\w*", "pedestre\\w*", "calcada\\w*", "transito", "congestionamento\\w*",
    "rodovia\\w*", "estrada\\w*", "br-\\d+", "tarifa zero", "passagem de onibus", "aplicativo\\w* de transporte", "uber", "motoboy\\w*", "aeroporto\\w*", "voo\\w*", "aviao", "portos?(?! alegre| velho| seguro| rico)", "porto\\w* (de|do|maritimo)", "obras? viar\\w*",
    "acidente\\w*", "colisao", "motorista\\w*", "lei seca", "embriaguez ao volante", "capotou", "capotamento", "atropela\\w*", "engavetamento",
    "transit", "subway", "buses", "bus", "trains?", "rail\\w*", "traffic", "commut\\w*", "cycling", "bike lanes?", "airport\\w*", "flights?", "crash\\w*",
    "movilidad", "autobus\\w*", "subte", "trenes", "tren", "transito", "trafico vehicular", "ciclovia\\w*", "aeropuerto\\w*", "vuelos?", "vialidad", "accidente\\w*")],
  ["Moradia", T(
    "moradia\\w*", "habitac\\w*", "minha casa,? minha vida", "mcmv", "aluguel", "alugue\\w*", "despejo\\w*", "reintegrac\\w* de posse", "ocupac\\w*", "sem-teto", "sem teto", "mtst", "favela\\w*",
    "periferia\\w*", "financiamento imobiliario", "urbanismo", "plano diretor", "zoneamento", "regularizacao fundiaria", "area\\w* de risco", "habitacao popular", "desabrigad\\w*", "sem casa", "desalojad\\w*",
    "housing", "rent", "renters?", "tenants?", "eviction\\w*", "homeless\\w*", "affordable housing", "mortgage\\w*",
    "vivienda\\w*", "alquiler\\w*", "desalojo\\w*", "inquilinos?", "hipoteca\\w*")],
  ["Saneamento", T(
    "saneamento", "esgoto\\w*", "agua tratada", "abastecimento de agua", "falta de agua", "sabesp", "copasa", "cedae", "embasa", "compesa", "corsan", "drenagem", "lixo", "residuos", "coleta seletiva",
    "aterro\\w*", "lixao\\w*", "bueiro\\w*", "alagamento\\w*", "marco do saneamento",
    "sanitation", "sewage", "drinking water", "water supply", "wastewater", "landfill\\w*", "garbage", "waste",
    "saneamiento", "agua potable", "alcantarillado", "basura", "residuos")],
  ["Alimentação e campo", T(
    "fome", "inseguranca alimentar", "seguranca alimentar", "alimentac\\w*", "alimento\\w*", "comida", "cesta basica", "agricultura", "agricultor\\w*", "agricultura familiar", "agroecolog\\w*",
    "agronegocio", "agro", "safra\\w*", "colheita\\w*", "plantio", "soja", "milho", "cafe", "gado", "pecuaria", "agrotox\\w*", "pesca\\w*", "horta\\w*", "assentamento\\w*", "mst",
    "reforma agraria", "embrapa", "conab", "merenda", "restaurante\\w* popula\\w*", "cozinha\\w* solidaria\\w*", "feira\\w* livre\\w*", "feira\\w* organica\\w*",
    "hunger", "food", "farm\\w*", "agricultur\\w*", "crops?", "harvest", "livestock", "fisher\\w*",
    "hambre", "alimentos?", "alimentacion", "agricultura", "agricultores", "cosecha\\w*", "campesinos?")],
  ["Ciência e tecnologia", T(
    "ciencia\\w*", "cientist\\w*", "pesquisa\\w*", "pesquisador\\w*", "estudo\\w*", "descoberta\\w*", "tecnologia\\w*", "inteligencia artificial", "ia", "chatgpt", "openai", "anthropic", "nvidia",
    "google", "apple", "meta platforms", "microsoft", "big techs?", "internet", "redes sociais", "algoritmo\\w*", "dados pessoais", "lgpd", "hacker\\w*", "ataque hacker", "ciberataque\\w*", "seguranca digital",
    "aplicativo\\w*", "celular\\w*", "smartphone\\w*", "5g", "satelite\\w*", "espacial", "estacao espacial", "nasa", "astronom\\w*", "foguete\\w*", "lua", "marte", "robo\\w*", "chip\\w*", "semicondutor\\w*", "biologo\\w*", "arqueolog\\w*", "fisica quantica",
    "science", "scientists?", "research\\w*", "study", "artificial intelligence", "ai", "tech", "technology", "software", "cyber\\w*", "space", "rocket\\w*", "satellites?", "quantum",
    "ciencia", "cientificos?", "investigadores?", "tecnologia", "inteligencia artificial", "espacio", "arqueologos?")],
  ["Cultura", T(
    "cultura\\w*", "cultural", "arte\\w*", "artista\\w*", "museu\\w*", "exposic\\w*", "cinema", "filme\\w*", "documentario\\w*", "curta\\w*-metrage\\w*", "festival\\w*", "musica\\w*", "musico\\w*", "cantor\\w*",
    "cantora\\w*", "teatro\\w*", "danca", "livro\\w*", "literatura", "escritor\\w*", "escritora\\w*", "poesia", "poeta\\w*", "patrimonio", "carnaval", "samba", "funk", "lei rouanet", "lei paulo gustavo",
    "biblioteca\\w*", "premio\\w*", "oscar", "bienal", "folclore", "religia\\w*", "papa", "igreja\\w*", "minc", "tatua\\w*",
    "culture", "art", "artists?", "museums?", "film\\w*", "movies?", "music\\w*", "books?", "novels?", "theat(?:er|re)", "festival\\w*", "pope",
    "cultura", "artistas?", "museo\\w*", "pelicula\\w*", "musica", "libros?", "teatro", "festival")],
  ["Mundo", T(
    "internacional\\w*", "diplomac\\w*", "diplomat\\w*", "embaixad\\w*", "itamaraty", "chanceler\\w*", "onu", "nacoes unidas", "otan", "g20", "g7", "brics", "mercosul", "uniao europeia", "cupula",
    "guerra\\w*", "conflito\\w*", "cessar-fogo", "cessar fogo", "bombardeio\\w*", "ataque\\w* aere\\w*", "invasao", "tropas", "militar\\w*", "exercito\\w*", "sancoes", "acordo de paz", "soberania", "misse\\w*",
    "ucrania", "russia", "putin", "zelensky", "gaza", "israel\\w*", "palestin\\w*", "hamas", "hezbollah", "iraque", "siria", "libano", "iemen", "venezuela", "maduro", "argentina", "milei", "cisjordania", "jerico",
    "estados unidos", "eua", "trump", "casa branca", "china", "xi jinping", "taiwan", "coreia do norte", "india", "paquistao", "afeganistao", "africa do sul", "europa", "papa leao", "tratado\\w*", "brexit", "groenlandia", "greenland",
    "war", "ceasefire", "troops", "military", "diplomat\\w*", "united nations", "nato", "sanctions", "invasion", "airstrikes?", "ukraine", "russia", "gaza", "israel", "iran", "china",
    "guerra", "alto el fuego", "lebanon", "peacekeepers", "mideast", "middle east", "tropas", "militares", "naciones unidas", "otan", "sanciones", "invasion", "ucrania", "rusia", "israel", "iran")],
  // leves: só no feed de quem escolhe
  ["Esporte", T(
    "esporte\\w*", "esportiv\\w*", "atleta\\w*", "futebol", "campeonato\\w*", "brasileirao", "libertadores", "sul-americana", "copa do brasil", "copa do mundo", "eliminatorias", "goleada", "gols?", "selecao brasileira", "selecao feminina",
    "tecnico do", "tecnico da selecao", "jogadores", "jugadores", "treinador\\w*", "atacante", "zagueiro", "goleiro", "meio-campista", "estadio\\w*", "torcida\\w*", "torcedor\\w*", "fifa", "cbf", "vini jr", "neymar", "ancelotti", "thiago silva",
    "palmeiras", "corinthians", "flamengo", "fluminense", "botafogo", "vasco", "santos fc", "sao paulo fc", "gremio", "cruzeiro", "atletico-mg", "fortaleza ec", "campeao", "campea",
    "volei", "basquete", "handebol", "tenis", "judo", "natacao", "atletismo", "skate", "surf\\w*", "boxe", "ufc", "mma", "jiu-jitsu", "xadrez", "formula 1", "f1", "grande premio", "olimpiad\\w*", "olimpic\\w*", "paralimpic\\w*", "jogos pan-americanos",
    "sport\\w*", "soccer", "football", "premier league", "champions league", "world cup", "super bowl", "playoffs?", "touchdown", "nba", "nfl", "mlb", "nhl", "nrl", "afl", "rugby", "cricket", "grand prix", "tennis", "golf", "olympic\\w*", "chessboxing", "a-league", "ireland xv",
    "futbol", "liga mx", "laliga", "uefa", "nations league", "donde ver el partido", "taekwondo", "wallabies", "goles?", "seleccion", "entrenador\\w*", "torneo\\w*", "juegos (deportivos|olimpicos|panamericanos|laborales)", "real madrid", "barcelona fc", "bayern", "juventus", "psg", "jockey", "turfe")],
  ["Entretenimento", T(
    "celebridade\\w*", "famosos", "famosas", "ator", "atriz", "atores", "atrizes", "novela\\w*", "telenovela\\w*", "reality", "realities", "bbb", "big brother", "a fazenda", "masterchef", "the voice",
    "programa de tv", "apresentador\\w*", "apresentadora\\w*", "series?", "serie de tv", "streaming", "netflix", "hbo", "disney", "prime video", "globoplay", "influenciador\\w*", "influencer\\w*", "youtuber\\w*", "tiktoker\\w*",
    "games?", "videogame\\w*", "gta\\w*", "playstation", "xbox", "nintendo", "e-sports?", "esports", "gamer\\w*", "fofoca\\w*", "namoro", "kardashian\\w*",
    "celebrity", "celebrities", "actor", "actress", "tv show", "reality show", "hollywood", "red carpet", "video games?",
    "farandula", "actriz", "telenovela", "casa de los famosos", "madre por", "padre por")],
  ["Sorte e signos", T(
    "loteria\\w*", "mega-sena", "mega sena", "megasena", "lotofacil", "quina", "timemania", "dia de sorte", "dupla sena", "lotomania", "super sete", "milionaria", "resultado\\w* do sorteio",
    "horoscopo\\w*", "signos?", "tarot", "taro", "astrolog\\w*", "mapa astral", "zodiaco", "mercurio retrogrado", "numerolog\\w*",
    "lottery", "powerball", "mega millions", "horoscope\\w*", "zodiac", "astrology",
    "quiniela", "loto", "resultado del sorteo", "signos del zodiaco")],
  ["Casa e consumo", T(
    "carro\\w*", "automove\\w*", "automotiv\\w*", "suv", "sedan", "hatch", "picape", "volkswagen", "fiat", "toyota", "honda", "hyundai", "chevrolet", "byd", "renault", "jeep", "motor a combustao", "test drive", "golf gti",
    "imove\\w*", "imobiliari\\w*", "apartamento\\w* a venda", "casa\\w* a venda", "condominio\\w*", "decorac\\w*", "limpeza", "faxina", "jardinagem", "dicas? para", "como limpar", "encanador\\w*", "tubulac\\w*", "eletrodomestic\\w*", "receitas? (de|para)", "recipes?", "recetas?",
    "black friday", "promoc\\w*", "desconto\\w*", "cupom", "cupons", "oferta\\w*", "compras", "monitor gamer",
    "cars?", "real estate", "homes for sale", "for sale", "three-bed", "bedroom", "property market", "holiday shopping", "discounts?",
    "coches?", "inmobiliari\\w*", "fontanero", "tuberias", "rebajas", "tienda\\w*", "ofertas?")],
];

// subtemas: o mesmo cálculo, só entre os subtemas do tema
export const SUBTEMAS_TERMOS: Record<string, [string, RegExp][]> = {
  "Política e governo": [
    ["Eleições", T("eleic\\w*", "eleitor\\w*", "eleitora\\w*", "candidat\\w*", "campanha eleitoral", "tse", "urna\\w*", "pesquisa eleitoral", "turno", "election\\w*", "voter\\w*", "elecciones", "eleccion", "votantes")],
    ["Leis e Congresso", T("congresso", "senado\\w*", "senador\\w*", "deputad\\w*", "camara\\w*", "plenario", "comissao aprova", "projeto de lei", "pec", "plp", "medida provisoria", "veto\\w*", "sancion\\w*", "emenda\\w*", "cpmi", "cpi", "assembleia legislativa", "vereador\\w*", "congress", "senate", "lawmaker\\w*", "parliament\\w*", "congreso", "diputad\\w*", "parlamento")],
    ["Serviços públicos", T("servic\\w* public\\w*", "servidor\\w* public\\w*", "gestao publica", "prefeitura\\w*", "concurso\\w* public\\w*", "atendimento", "dni", "cadunico", "licitac\\w*", "obras? public\\w*", "public services?")],
    ["Participação e conselhos", T("orcamento participativo", "conselho\\w* municipa\\w*", "conselho\\w*", "consulta publica", "audiencia publica", "plebiscito", "referendo", "participac\\w* social", "participac\\w* popular", "conferencia\\w*", "town hall")],
  ],
  "Economia e trabalho": [
    ["Emprego e renda", T("emprego\\w*", "desemprego", "vagas?", "salario\\w*", "salario minimo", "renda", "clt", "escala 6x1", "jornada", "greve\\w*", "sindicat\\w*", "aposentadori\\w*", "inss", "previdencia", "fgts", "bolsa familia", "beneficio\\w*", "jobs", "unemployment", "wages?", "workers?", "strike\\w*", "empleo\\w*", "desempleo", "salarios?", "huelga\\w*", "paro de \\w+")],
    ["Custo de vida", T("inflac\\w*", "ipca", "precos?", "custo de vida", "conta de luz", "gasolina", "diesel", "combustive\\w*", "cesta basica", "aluguel", "consumidor\\w*", "inflation", "cost of living", "prices?", "inflacion", "precios?")],
    ["Mercado e empresas", T("bolsa\\w*", "ibovespa", "acoes", "mercado financeiro", "dolar", "cambio", "juros", "selic", "copom", "banco central", "banco\\w*", "investiment\\w*", "investidor\\w*", "lucro\\w*", "faturamento", "empresa\\w*", "ipo", "fus\\w*", "aquisic\\w*", "petrobras", "stocks?", "shares", "market\\w*", "investor\\w*", "earnings", "profit\\w*", "banks?", "mercados?", "empresas?")],
    ["Impostos e contas públicas", T("imposto\\w*", "tribut\\w*", "reforma tributaria", "cbs", "ibs", "irpf", "imposto de renda", "fiscal", "ajuste fiscal", "arcabouco", "orcamento", "divida publica", "deficit", "superavit", "tax\\w*", "budget", "impuestos?")],
    ["Pequenos negócios", T("pequen[oa]s? (negocios?|empresas?|empresarios?)", "mei", "microempreendedor\\w*", "empreendedor\\w*", "startups?", "comercio local", "small business\\w*", "entrepreneurs?", "pymes?", "emprendedor\\w*")],
    ["Economia solidária", T("economia solidaria", "cooperativa\\w*", "cooperativismo", "banco comunitario", "moeda social", "associac\\w* de produtores", "comercio justo", "fair trade")],
  ],
  "Segurança pública": [
    ["Violência e polícia", T("policia\\w*", "pm", "pf", "prf", "delegacia\\w*", "operacao", "tiro\\w*", "baleado\\w*", "tiroteio\\w*", "homicidio\\w*", "assassin\\w*", "chacina\\w*", "violencia", "agress\\w*", "estupro\\w*", "feminicidio\\w*", "assalto\\w*", "roubo\\w*", "furto\\w*", "golpe\\w*", "desaparecid\\w*", "corpo", "police", "shooting", "murder\\w*", "killed", "stabbing", "policia", "homicidio", "asesinat\\w*")],
    ["Crime organizado", T("faccao", "faccoes", "pcc", "comando vermelho", "milicia\\w*", "trafico", "traficante\\w*", "narcotrafico", "lavagem de dinheiro", "crime organizado", "contrabando", "sicarios?", "carteles?", "cartel", "gang\\w*", "organized crime")],
    ["Sistema prisional", T("presidio\\w*", "penitenciari\\w*", "sistema prisional", "detento\\w*", "carcerari\\w*", "cadeia\\w*", "fuga de presos", "saidinha", "prison\\w*", "inmates?", "carcel\\w*", "presos?")],
  ],
  "Justiça": [
    ["STF e tribunais", T("audiencia (nacional|provincial|de \\w+)", "stf", "stj", "tst", "trf\\w*", "tj\\w{2}", "supremo", "ministro do stf", "fachin", "moraes", "dino", "gilmar", "tribunal", "tribunais", "supreme court", "suprema corte", "corte suprema")],
    ["Julgamentos", T("julgamento\\w*", "julga\\w*", "juri", "sentenca", "condenad\\w*", "condenac\\w*", "absolvid\\w*", "reu", "habeas corpus", "trial", "verdict", "sentenced", "juicio", "condena\\w*")],
    ["Ministério Público", T("ministerio publico", "mp", "mpf", "pgr", "procurador\\w*", "promotor\\w*", "denuncia\\w*", "inquerito\\w*", "investigac\\w*", "indiciad\\w*", "delac\\w*", "prosecutor\\w*", "fiscalia", "fiscal general")],
  ],
  "Direitos e igualdade": [
    ["Mulheres", T("mulher\\w*", "feminis\\w*", "machismo", "violencia domestica", "lei maria da penha", "feminicidio\\w*", "gestantes?", "maternidade", "igualdade de genero", "women", "mujeres")],
    ["Raça", T("zumbi", "novembro negro", "escravizad\\w*", "racismo", "racista\\w*", "racial", "injuria racial", "negr[oa]s", "quilombo\\w*", "quilombola\\w*", "consciencia negra", "zumbi dos palmares", "antirracis\\w*", "racism", "black lives")],
    ["LGBTQIA+", T("lgbt\\w*", "lgbtqia\\w*", "trans", "transfobia", "homofobia", "parada do orgulho", "orgulho", "lgbtq\\w*", "transgender", "gay", "lesbica\\w*", "bissexua\\w*")],
    ["Pessoas com deficiência", T("pessoa\\w* com deficiencia", "deficiencia", "acessibilidade", "autis\\w*", "libras", "cadeirante\\w*", "disabilit\\w*", "discapacidad")],
    ["Povos indígenas", T("indigena\\w*", "povos? originari\\w*", "terra\\w* indigena\\w*", "funai", "yanomami", "guarani\\w*", "demarcac\\w*", "marco temporal", "indigenous", "indigenas?")],
    ["Infância e juventude", T("crianca\\w*", "infanc\\w*", "infantil", "adolescente\\w*", "juventude", "jovens", "eca", "conselho tutelar", "trabalho infantil", "children", "youth", "ninos", "ninas", "infancia")],
  ],
  "Saúde": [
    ["SUS", T("sus", "ubs", "upa", "posto\\w* de saude", "hospita\\w* public\\w*", "fila\\w* d[ae] (cirurgia|atendimento|espera)", "mais medicos", "farmacia popular", "ministerio da saude", "secretaria de saude", "plano\\w* de saude", "anvisa")],
    ["Doenças e epidemias", T("alzheimer", "dengue", "chikungunya", "zika", "covid\\w*", "gripe", "influenza", "sarampo", "tuberculose", "hiv", "aids", "cancer", "diabetes", "obesidade", "doenca\\w*", "epidemi\\w*", "pandemi\\w*", "surto\\w*", "virus", "outbreak\\w*", "disease\\w*", "enfermedad\\w*", "brote\\w*")],
    ["Saúde mental", T("saude mental", "depressao", "ansiedade", "suicidio", "psicolog\\w*", "psiquiatr\\w*", "burnout", "caps", "mental health", "salud mental")],
    ["Prevenção", T("vacina\\w*", "vacinac\\w*", "imuniza\\w*", "prevenc\\w*", "novembro azul", "outubro rosa", "exames?", "rastreamento", "vaccin\\w*", "vacunas?")],
    ["Cuidado e bem-estar", T("suplemento\\w*", "creatina", "vitamina\\w*", "nutric\\w*", "bem-estar", "sono", "alimentacao saudavel", "exercicio\\w*", "cuidado\\w*", "envelhecimento", "autocuidado", "wellness", "well-being", "sleep")],
  ],
  "Educação": [
    ["Escola", T("escola\\w*", "ensino fundamental", "ensino medio", "aluno\\w*", "aluna\\w*", "professor\\w*", "professora\\w*", "sala\\w* de aula", "merenda", "creche\\w*", "alfabetiza\\w*", "enem", "schools?", "escuela\\w*")],
    ["Universidade", T("universidade\\w*", "faculdade\\w*", "sisu", "prouni", "fies", "vestibular\\w*", "pos-graduacao", "capes", "cnpq", "usp", "unicamp", "unesp", "ufmg", "ufrj", "if\\w{2,3}", "universit\\w*", "college\\w*", "campus", "universidad\\w*")],
    ["Cursos e formação", T("curso\\w*", "formac\\w*", "capacitac\\w*", "qualificac\\w*", "estagio\\w*", "ensino tecnico", "senai", "senac", "bolsa\\w* de estudo", "training", "courses?")],
    ["Educação popular", T("educacao popular", "cursinho\\w* popula\\w*", "eja", "educacao de jovens e adultos", "paulo freire", "educacao do campo", "biblioteca\\w* comunitaria\\w*")],
  ],
  "Meio ambiente e clima": [
    ["Eventos extremos", T("enchente\\w*", "inundac\\w*", "chuva\\w*", "temporal", "seca", "estiagem", "onda de calor", "calor extremo", "frente fria", "ciclone\\w*", "tempestade\\w*", "deslizamento\\w*", "defesa civil", "terremoto\\w*", "sismo\\w*", "floods?", "flooding", "storms?", "hurricanes?", "drought", "heatwave", "earthquake\\w*", "inundaciones", "tormenta", "huracan", "sequia", "temblor")],
    ["Florestas e biomas", T("aves", "golfinho\\w*", "baleia\\w*", "tartaruga\\w*", "lobo-marinho", "onca\\w*", "wildlife", "desmatamento", "amazonia", "cerrado", "pantanal", "mata atlantica", "caatinga", "floresta\\w*", "queimada\\w*", "incendio\\w* florest\\w*", "biodiversidade", "especie\\w*", "fauna", "flora", "ibama", "icmbio", "garimpo\\w*", "silvestres?", "deforestation", "wildfires?", "species", "deforestacion")],
    ["Água e rios", T("rio\\w*", "agua\\w*", "bacia\\w*", "nascente\\w*", "oceano\\w*", "mar", "praia\\w*", "lago\\w*", "represa\\w*", "rivers?", "ocean\\w*", "water", "rios?")],
    ["Energia", T("energia solar", "energia eolica", "renovave\\w*", "transicao energetica", "petroleo\\w*", "carvao", "hidreletrica\\w*", "energia", "renewable\\w*", "solar", "wind power", "energy")],
    ["Lixo e reciclagem", T("recicla\\w*", "plastico\\w*", "lixo", "residuos", "coleta seletiva", "aterro\\w*", "lixao\\w*", "catador\\w*", "waste", "recycl\\w*", "plastic\\w*", "basura")],
  ],
  "Mobilidade": [
    ["Transporte público", T("transporte public\\w*", "onibus", "metro", "trem", "trens", "brt", "vlt", "tarifa zero", "passagem de onibus", "transit", "subway", "buses", "bus", "trains?", "autobus\\w*", "subte", "trenes", "tren")],
    ["Trânsito e acidentes", T("motorista\\w*", "lei seca", "transito", "congestionamento\\w*", "acidente\\w*", "colisao", "carreta\\w*", "caminhao", "caminhoes", "tomba\\w*", "ultrapassage\\w*", "pico y placa", "capotou", "capotamento", "atropela\\w*", "engavetamento", "rodovia\\w*", "estrada\\w*", "br-\\d+", "traffic", "crash\\w*", "accidente\\w*", "vialidad")],
    ["Bicicleta", T("bicicleta\\w*", "ciclovia\\w*", "ciclofaixa\\w*", "ciclista\\w*", "bike\\w*", "cycling", "cyclists?")],
    ["A pé e calçadas", T("pedestre\\w*", "calcada\\w*", "travessia\\w*", "faixa de pedestre\\w*", "caminhabilidade", "pedestrians?", "sidewalks?")],
  ],
  "Moradia": [
    ["Aluguel", T("aluguel", "alugue\\w*", "inquilino\\w*", "rent", "renters?", "tenants?", "alquiler\\w*", "inquilinos?")],
    ["Ocupações e despejos", T("ocupac\\w*", "despejo\\w*", "reintegrac\\w* de posse", "sem-teto", "sem teto", "mtst", "eviction\\w*", "desalojo\\w*")],
    ["Áreas de risco", T("area\\w* de risco", "encosta\\w*", "deslizamento\\w*", "desabrigad\\w*", "desalojad\\w*", "familias sem casa", "sem casa", "interdit\\w*")],
    ["Habitação popular", T("habitacao popular", "housing", "vivienda\\w*", "homes", "habitac\\w* de interesse social", "minha casa,? minha vida", "mcmv", "conjunto\\w* habitaciona\\w*", "regularizacao fundiaria", "favela\\w*", "affordable housing", "vivienda social")],
  ],
  "Saneamento": [
    ["Água encanada", T("agua tratada", "abastecimento de agua", "falta de agua", "agua encanada", "sabesp", "copasa", "cedae", "embasa", "compesa", "corsan", "drinking water", "water supply", "agua potable")],
    ["Esgoto", T("esgoto\\w*", "tratamento de esgoto", "saneamento basico", "marco do saneamento", "sewage", "wastewater", "alcantarillado")],
    ["Drenagem e enchentes", T("drenagem", "bueiro\\w*", "alagamento\\w*", "enchente\\w*", "galeria\\w* pluvia\\w*", "piscinao", "flooding")],
  ],
  "Alimentação e campo": [
    ["Agricultura familiar", T("agricultura familiar", "agricultor\\w*", "agroecolog\\w*", "assentamento\\w*", "mst", "reforma agraria", "campones\\w*", "pronaf", "small farmers?", "campesinos?")],
    ["Hortas urbanas", T("horta\\w*", "agricultura urbana", "urban farm\\w*", "community gardens?")],
    ["Fome", T("fome", "inseguranca alimentar", "seguranca alimentar", "cesta basica", "cozinha\\w* solidaria\\w*", "restaurante\\w* popula\\w*", "desnutric\\w*", "hunger", "food insecurity", "hambre")],
    ["Feiras", T("feira\\w*", "mercado\\w* municipa\\w*", "farmers markets?", "ferias? libres?")],
  ],
  "Ciência e tecnologia": [
    ["Pesquisa", T("pesquisa\\w*", "pesquisador\\w*", "cientist\\w*", "ciencia\\w*", "estudo\\w*", "descoberta\\w*", "nasa", "astronom\\w*", "espacial", "biologo\\w*", "arqueolog\\w*", "fisica", "research\\w*", "scientists?", "study", "space", "quantum", "investigadores?", "arqueologos?")],
    ["Inteligência artificial", T("inteligencia artificial", "ia", "chatgpt", "openai", "anthropic", "claude", "gemini", "nvidia", "artificial intelligence", "ai", "machine learning", "algoritmo\\w*")],
    ["Internet e dados", T("internet", "redes sociais", "dados pessoais", "lgpd", "hacker\\w*", "ataque hacker", "ciberataque\\w*", "seguranca digital", "big techs?", "privacidade", "vazamento\\w*", "cyber\\w*", "data", "privacy", "social media")],
    ["Tecnologia social", T("tecnologia social", "inclusao digital", "software livre", "codigo aberto", "open source", "tecnologias? sociais", "letramento digital")],
  ],
  "Cultura": [
    ["Artes visuais", T("arte\\w*", "artista\\w* visua\\w*", "museu\\w*", "exposic\\w*", "pintura\\w*", "escultura\\w*", "bienal", "grafite\\w*", "fotografia\\w*", "art", "museums?", "museo\\w*")],
    ["Música", T("musica\\w*", "musico\\w*", "cantor\\w*", "cantora\\w*", "show\\w*", "samba", "funk", "album", "disco", "turne", "music\\w*", "concert\\w*", "musica")],
    ["Literatura", T("livro\\w*", "literatura", "escritor\\w*", "escritora\\w*", "poesia", "poeta\\w*", "biblioteca\\w*", "flip", "books?", "novels?", "libros?")],
    ["Cinema", T("cinema", "filme\\w*", "documentario\\w*", "curta\\w*-metrage\\w*", "oscar", "festival de cinema", "film\\w*", "movies?", "pelicula\\w*")],
    ["Teatro e dança", T("teatro\\w*", "danca\\w*", "espetaculo\\w*", "ballet", "bale", "circo", "theat(?:er|re)", "dance", "teatro")],
    ["Festas e tradições", T("carnaval", "festa\\w* junina\\w*", "folclore", "patrimonio", "tradic\\w*", "religia\\w*", "papa", "igreja\\w*", "natal", "festa\\w* popular\\w*", "pope", "christmas", "navidad")],
    ["Corpo e tatuagem", T("tatua\\w*", "tattoo\\w*", "piercing\\w*", "body art")],
  ],
  "Mundo": [
    ["América Latina", T("america latina", "venezuela", "maduro", "argentina", "milei", "chile", "colombia", "peru", "bolivia", "paraguai", "uruguai", "mexico", "cuba", "equador", "mercosul", "latin america", "latinoamerica")],
    ["Estados Unidos", T("estados unidos", "eua", "trump", "casa branca", "washington", "white house", "united states", "dhs")],
    ["Europa", T("europa", "uniao europeia", "franca", "alemanha", "reino unido", "espanha", "italia", "portugal", "irlanda", "macron", "europe", "european union", "uk", "ireland")],
    ["Oriente Médio", T("lebanon", "mideast", "israel\\w*", "gaza", "palestin\\w*", "hamas", "hezbollah", "iraque", "siria", "libano", "iemen", "ira", "iran", "cisjordania", "jerico", "middle east")],
    ["África e Ásia", T("africa\\w*", "china", "xi jinping", "taiwan", "coreia\\w*", "japao", "india", "paquistao", "afeganistao", "asia\\w*", "japan", "korea")],
    ["Conflitos", T("guerra\\w*", "conflito\\w*", "cessar-fogo", "cessar fogo", "bombardeio\\w*", "ataque\\w* aere\\w*", "invasao", "tropas", "misse\\w*", "ucrania", "russia", "putin", "zelensky", "war", "ceasefire", "troops", "airstrikes?", "invasion", "ukraine")],
    ["Migração", T("migra\\w*", "imigra\\w*", "refugiad\\w*", "deportac\\w*", "fronteira\\w*", "asilo", "migrants?", "immigra\\w*", "refugee\\w*", "deport\\w*", "migrantes")],
  ],
  "Esporte": [
    ["Futebol", T("futebol", "brasileirao", "libertadores", "sul-americana", "copa do brasil", "copa do mundo", "eliminatorias", "goleada", "gols?", "selecao brasileira", "fifa", "cbf", "vini jr", "neymar", "ancelotti", "atacante", "zagueiro", "goleiro", "thiago silva",
      "palmeiras", "corinthians", "flamengo", "fluminense", "botafogo", "vasco", "gremio", "cruzeiro", "soccer", "premier league", "champions league", "world cup", "futbol", "liga mx", "laliga", "uefa", "nations league", "donde ver el partido", "taekwondo", "wallabies", "goles?", "real madrid", "bayern", "juventus", "psg")],
    ["Esporte feminino", T("feminin[oa]s?", "selecao feminina", "jogadoras?", "atletas? mulher\\w*", "women's", "womens", "wnba", "femenin[oa]")],
    ["Outros esportes", T("volei", "basquete", "handebol", "tenis", "judo", "natacao", "atletismo", "skate", "surf\\w*", "boxe", "ufc", "mma", "jiu-jitsu", "xadrez", "formula 1", "f1", "grande premio", "olimpiad\\w*", "olimpic\\w*", "paralimpic\\w*",
      "nba", "nfl", "rugby", "cricket", "grand prix", "tennis", "golf", "chessboxing", "turfe", "jockey")],
  ],
  "Entretenimento": [
    ["Celebridades", T("celebridade\\w*", "famosos", "famosas", "ator", "atriz", "atores", "atrizes", "fofoca\\w*", "influenciador\\w*", "influencer\\w*", "namoro", "kardashian\\w*", "celebrity", "celebrities", "actor", "actress", "farandula", "actriz", "madre por", "padre por")],
    ["TV e novela", T("novela\\w*", "telenovela\\w*", "programa de tv", "apresentador\\w*", "apresentadora\\w*", "tv show", "televis\\w*")],
    ["Reality", T("reality", "realities", "bbb", "big brother", "a fazenda", "masterchef", "the voice", "reality show", "casa de los famosos")],
    ["Séries e streaming", T("series?", "serie de tv", "streaming", "netflix", "hbo", "disney", "prime video", "globoplay")],
    ["Games", T("games?", "videogame\\w*", "gta\\w*", "playstation", "xbox", "nintendo", "e-sports?", "esports", "gamer\\w*", "video games?")],
  ],
  "Sorte e signos": [
    ["Loteria", T("loteria\\w*", "mega-sena", "mega sena", "megasena", "lotofacil", "quina", "timemania", "dia de sorte", "dupla sena", "lotomania", "super sete", "sorteio\\w*", "lottery", "powerball", "mega millions", "quiniela", "loto", "resultado del sorteo")],
    ["Horóscopo", T("horoscopo\\w*", "signos?", "tarot", "taro", "astrolog\\w*", "mapa astral", "zodiaco", "mercurio retrogrado", "numerolog\\w*", "horoscope\\w*", "zodiac", "astrology")],
  ],
  "Casa e consumo": [
    ["Carros", T("carro\\w*", "automove\\w*", "automotiv\\w*", "suv", "sedan", "hatch", "picape", "volkswagen", "fiat", "toyota", "honda", "hyundai", "chevrolet", "byd", "renault", "jeep", "motor a combustao", "test drive", "golf gti", "cars?", "coches?")],
    ["Imóveis", T("imove\\w*", "imobiliari\\w*", "apartamento\\w* a venda", "casa\\w* a venda", "condominio\\w*", "real estate", "homes for sale", "three-bed", "bedroom", "property market", "inmobiliari\\w*")],
    ["Casa", T("decorac\\w*", "receitas? (de|para)", "recipes?", "recetas?", "limpeza", "faxina", "jardinagem", "como limpar", "encanador\\w*", "tubulac\\w*", "eletrodomestic\\w*", "fontanero", "tuberias", "dicas? para")],
    ["Compras", T("black friday", "promoc\\w*", "desconto\\w*", "cupom", "cupons", "oferta\\w*", "compras", "loja\\w*", "shopping", "deals?", "discounts?", "rebajas", "tienda\\w*", "monitor gamer")],
  ],
};
export const SUBTEMAS: Record<string, string[]> = Object.fromEntries(Object.entries(SUBTEMAS_TERMOS).map(([k, l]) => [k, l.map((x) => x[0])]));
// empate entre subtemas: estes ganham (ex.: "futebol feminino" fica em Esporte feminino)
export const SUB_PRIMEIRO = ["Esporte feminino", "Mulheres", "Povos indígenas"];

// temas vizinhos (20 nov 2026): quem lê muito um tema recebe um pouco dos vizinhos. Fixos por enquanto; editáveis no Painel.
export const VIZINHOS_PARES: [string, string][] = [
  ["Política e governo", "Justiça"], ["Política e governo", "Economia e trabalho"], ["Política e governo", "Direitos e igualdade"], ["Política e governo", "Mundo"],
  ["Economia e trabalho", "Moradia"], ["Economia e trabalho", "Alimentação e campo"], ["Economia e trabalho", "Mundo"],
  ["Segurança pública", "Justiça"], ["Segurança pública", "Direitos e igualdade"], ["Justiça", "Direitos e igualdade"],
  ["Direitos e igualdade", "Educação"], ["Direitos e igualdade", "Saúde"], ["Direitos e igualdade", "Moradia"], ["Direitos e igualdade", "Cultura"],
  ["Saúde", "Saneamento"], ["Saúde", "Alimentação e campo"], ["Educação", "Cultura"], ["Educação", "Ciência e tecnologia"],
  ["Meio ambiente e clima", "Saneamento"], ["Meio ambiente e clima", "Alimentação e campo"], ["Meio ambiente e clima", "Ciência e tecnologia"], ["Meio ambiente e clima", "Moradia"], ["Meio ambiente e clima", "Mobilidade"],
  ["Mobilidade", "Moradia"], ["Moradia", "Saneamento"],
  ["Esporte", "Entretenimento"], ["Entretenimento", "Sorte e signos"], ["Entretenimento", "Casa e consumo"],
];
export const VIZINHOS: Record<string, string[]> = {};
for (const [a, b] of VIZINHOS_PARES) { (VIZINHOS[a] = VIZINHOS[a] || []).push(b); (VIZINHOS[b] = VIZINHOS[b] || []).push(a); }

// ruído: título que é nome de arquivo ("Edital.pdf", "Untitled Design (2).png") não é notícia
export const RUIDO = /(\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|pptx?|zip|rar)\s*$)|^untitled\b/i;

const sem = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 \-']+/g, " ").replace(/\s+/g, " ");
const conta = (re: RegExp, t: string) => { re.lastIndex = 0; const m = t.match(re); return m ? new Set(m).size : 0; };
const pontua = (l: [string, RegExp][], a: string, b: string) => l.map(([k, re]) => [k, 2 * conta(re, a) + conta(re, b)] as [string, number]);
function subDe(tema: string, a: string, b: string): string {
  const l = SUBTEMAS_TERMOS[tema]; if (!l) return "";
  let melhor = "", max = 0;
  for (const [k, p] of pontua(l, a, b)) if (p > max || (p === max && p > 0 && SUB_PRIMEIRO.includes(k) && !SUB_PRIMEIRO.includes(melhor))) { max = p; melhor = k; }
  return melhor;
}
export type Classe = { tema: string; sub: string; tema2: string; sub2: string; leve: boolean; ruido: boolean };
export function classifica(titulo: string, chamada?: string | null): Classe {
  const a = " " + sem(titulo) + " ", b = " " + sem(chamada || "") + " ";
  const pts = pontua(TEMAS_TERMOS, a, b);
  let melhor = TEMA_OUTROS, max = 0;
  for (const [k, p] of pts) if (p > max) { max = p; melhor = k; }
  const leve = TEMAS_LEVES.includes(melhor);
  let tema2 = "", max2 = 0;
  if (max > 0 && !leve) for (const [k, p] of pts) if (k !== melhor && !TEMAS_LEVES.includes(k) && p > max2 && p * 2 >= max) { max2 = p; tema2 = k; }
  return { tema: melhor, sub: max > 0 ? subDe(melhor, a, b) : "", tema2, sub2: tema2 ? subDe(tema2, a, b) : "", leve, ruido: RUIDO.test((titulo || "").trim()) };
}
export function temaDe(titulo: string, chamada?: string | null): string {
  return classifica(titulo, chamada).tema;
}

// lista do Painel (20 nov 2026): troca, no lugar, temas, subtemas, termos e vizinhos pelos que vêm do banco (função taxonomia()).
// Os termos ficam no banco no mesmo formato daqui (pedaços de expressão regular, sem acento e em minúsculas).
export type Taxonomia = { temas: { tema: string; leve: boolean; termos: string[]; subs: { sub: string; termos: string[] }[] }[]; vizinhos: [string, string][] };
export function aplicaTaxonomia(tx: Taxonomia): boolean {
  if (!tx || !Array.isArray(tx.temas) || tx.temas.length < 5) return false;
  try {
    const ok = tx.temas.filter((t) => t && t.tema && Array.isArray(t.termos) && t.termos.length);
    const novos: [string, RegExp][] = ok.map((t) => [t.tema, T(...t.termos)]);
    const subs: Record<string, [string, RegExp][]> = {};
    for (const t of ok) subs[t.tema] = (t.subs || []).filter((x) => x && x.sub && Array.isArray(x.termos) && x.termos.length).map((x) => [x.sub, T(...x.termos)] as [string, RegExp]);
    TEMAS_LISTA.splice(0, TEMAS_LISTA.length, ...ok.filter((t) => !t.leve).map((t) => t.tema));
    TEMAS_LEVES.splice(0, TEMAS_LEVES.length, ...ok.filter((t) => t.leve).map((t) => t.tema));
    TEMAS_TERMOS.splice(0, TEMAS_TERMOS.length, ...novos);
    for (const k of Object.keys(SUBTEMAS_TERMOS)) delete SUBTEMAS_TERMOS[k];
    for (const k of Object.keys(SUBTEMAS)) delete SUBTEMAS[k];
    for (const [k, l] of Object.entries(subs)) { SUBTEMAS_TERMOS[k] = l; SUBTEMAS[k] = l.map((x) => x[0]); }
    if (Array.isArray(tx.vizinhos)) {
      VIZINHOS_PARES.splice(0, VIZINHOS_PARES.length, ...tx.vizinhos.filter((p) => Array.isArray(p) && p.length === 2));
      for (const k of Object.keys(VIZINHOS)) delete VIZINHOS[k];
      for (const [a, b] of VIZINHOS_PARES) { (VIZINHOS[a] = VIZINHOS[a] || []).push(b); (VIZINHOS[b] = VIZINHOS[b] || []).push(a); }
    }
    return true;
  } catch { return false; }
}

// a lista deste arquivo no formato do banco (semente do Painel: coletor ?modo=taxonomia)
const fonte = (re: RegExp) => { const s = re.source.replace(/^\\b\(/, "").replace(/\)\\b$/, ""), out: string[] = []; let d = 0, cur = "";
  for (const ch of s) { if (ch === "(" || ch === "[") d++; if (ch === ")" || ch === "]") d--; if (ch === "|" && d === 0) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out; };
export function taxonomiaAtual(): Taxonomia {
  return { temas: TEMAS_TERMOS.map(([k, re]) => ({ tema: k, leve: TEMAS_LEVES.includes(k), termos: fonte(re), subs: (SUBTEMAS_TERMOS[k] || []).map(([s, r]) => ({ sub: s, termos: fonte(r) })) })),
    vizinhos: VIZINHOS_PARES.map(([a, b]) => [a, b] as [string, string]) };
}

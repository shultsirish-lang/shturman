import { useEffect, useMemo, useState } from "react";

const apiBase = import.meta.env.PROD ? "/api/knowledge" : (import.meta.env.VITE_API_URL || "/api");
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const api = async (path) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const cacheKey = `gci_api_${path}`;
  try {
    const response = await fetch(`${apiBase}${path}`, { headers: apiKey ? { apikey: apiKey } : {}, signal: controller.signal });
    if (!response.ok) throw new Error("API error");
    const payload = await response.json();
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), payload }));
    return payload;
  } catch (error) {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached?.payload && Date.now() - cached.savedAt < 24 * 60 * 60 * 1000) return cached.payload;
    throw error;
  } finally { clearTimeout(timeout); }
};

const workflows = [
  ["Записать пациента", "Подобрать врача, время или лист ожидания", "запись", "◫"],
  ["Анализы", "Подготовка, методы, поиск исследования", "анализ", "⌬"],
  ["Цена и возражения", "Стоимость, «дорого», акции и скидки", "дорого", "₽"],
  ["Изменить запись", "Перенос, отмена, задержка или опоздание", "перенос записи", "↔"],
  ["Документы", "Результаты, справки, родственники", "результаты", "▤"],
  ["Жалоба или конфликт", "Недовольство, ожидание, эскалация", "жалоба", "!"],
];

export default function App() {
  const [cards, setCards] = useState([]);
  const [modules, setModules] = useState([]);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("");
  const [kind, setKind] = useState("Все");
  const [view, setView] = useState("home");
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [favorites, setFavorites] = useState(() => new Set(JSON.parse(localStorage.getItem("gci_favorites") || "[]")));
  const [error, setError] = useState("");

  useEffect(() => { api("/modules").then(setModules).catch(() => setError("Не удалось получить список направлений.")); }, []);
  useEffect(() => {
    if (view === "home") { setCards([]); setLoading(false); return undefined; }
    const timer = setTimeout(async () => {
      try {
        setLoading(true); setError("");
        const path = query.trim() ? `/search?q=${encodeURIComponent(query)}${module ? `&module=${encodeURIComponent(module)}` : ""}` : `/cards?limit=200${module ? `&module=${encodeURIComponent(module)}` : ""}`;
        const data = await api(path);
        setCards(data.results);
      } catch { setError("База знаний временно не отвечает. Проверьте подключение и повторите попытку."); }
      finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, module, view, retryKey]);

  const kinds = useMemo(() => ["Все", ...new Set(cards.map((card) => card.kind).filter(Boolean))], [cards]);
  const visible = useMemo(() => cards.filter((card) => (
    (kind === "Все" || card.kind === kind)
    && (view !== "favorites" || favorites.has(card.id))
    && (card.kind !== "Лабораторное исследование" || Boolean(card.price))
  )), [cards, kind, view, favorites]);
  const libraryCount = modules.reduce((total, item) => total + item.count, 0);
  const toggleFavorite = (id) => { const next = new Set(favorites); next.has(id) ? next.delete(id) : next.add(id); setFavorites(next); localStorage.setItem("gci_favorites", JSON.stringify([...next])); };
  const showLibrary = () => { setView("library"); setQuery(""); setModule(""); setKind("Все"); };
  const chooseModule = (name) => { setView("library"); setModule(name); setQuery(""); setKind("Все"); };
  const runWorkflow = (term) => { setView("results"); setModule(""); setKind("Все"); setQuery(term); };
  const openFavorites = () => { setView("favorites"); setModule(""); setQuery(""); setKind("Все"); };
  const clear = () => { setView("home"); setQuery(""); setModule(""); setKind("Все"); };
  const title = view === "favorites" ? "Избранное" : module || (query ? `Результаты: «${query}»` : "Библиотека знаний");

  return <div className="shell">
    <aside className="sidebar">
      <button className="brand" onClick={clear} aria-label="На главную"><div className="logo"><img src="/green-clinic-logo.jpg" alt="Green Clinic" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }} /></div><div><b>Green Clinic</b><small>Intelligence</small></div></button>
      <div className="side-title">Рабочее пространство</div>
      <Nav active={view === "home"} onClick={clear} label="Пациент сейчас" value="⌂" />
      <Nav active={view === "library" && !module} onClick={showLibrary} label="Библиотека знаний" value={libraryCount || "…"} />
      <Nav active={view === "favorites"} onClick={openFavorites} label="Избранное" value={favorites.size} />
      {view === "library" && <><div className="side-title">Направления</div><div className="module-list">{modules.map((item) => <Nav key={item.module} active={module === item.module} onClick={() => chooseModule(item.module)} label={item.module} value={item.count} />)}</div></>}
    </aside>
    <section className="content">
      <div className="topbar"><div className="searchbox"><span className="search-icon">⌕</span><input value={query} onChange={(event) => { setView("results"); setModule(""); setKind("Все"); setQuery(event.target.value); }} placeholder="Например: «анализ на герпес», «дорого», «мама просит результаты»" /><button className="search-clear" onClick={clear}>Очистить</button></div></div>
      <main className="main">{view === "home" ? <Home onWorkflow={runWorkflow} onLibrary={showLibrary} /> : <Results title={title} cards={visible} kinds={kinds} kind={kind} setKind={setKind} loading={loading} error={error} favorites={favorites} onFavorite={toggleFavorite} onOpen={setCurrent} onRetry={() => setRetryKey((value) => value + 1)} />}</main>
    </section>
    {current && <Drawer card={current} onClose={() => setCurrent(null)} />}
  </div>;
}

function Home({ onWorkflow, onLibrary }) {
  return <>
    <section className="hero workspace-hero"><div><span className="eyebrow">Рабочая навигация</span><h1>Что происходит с пациентом?</h1><p>Выберите ситуацию — получите готовый скрипт, вопросы для уточнения и следующий шаг. Искать по разделам не нужно.</p></div><button className="library-cta" onClick={onLibrary}>Открыть всю библиотеку <span>→</span></button></section>
    <section className="workflow-section"><div className="section-heading"><div><span className="eyebrow">Быстрый старт</span><h2>Выберите рабочую ситуацию</h2></div><p>Каждая кнопка запускает поиск по готовым карточкам.</p></div><div className="workflow-grid">{workflows.map(([title, description, query, icon]) => <button className="workflow-card" key={title} onClick={() => onWorkflow(query)}><span className="workflow-icon">{icon}</span><b>{title}</b><small>{description}</small><span className="workflow-arrow">→</span></button>)}</div></section>
    <section className="safety-strip"><div><b>Срочная ситуация?</b><span>Боль в груди, выраженная одышка, потеря сознания, внезапная слабость или нарушение речи.</span></div><button onClick={() => onWorkflow("боль в груди")}>Открыть алгоритм</button></section>
  </>;
}

function Results({ title, cards, kinds, kind, setKind, loading, error, favorites, onFavorite, onOpen, onRetry }) {
  return <><div className="results-intro"><span className="eyebrow">База знаний</span><p>Сначала — краткая карточка, затем подробности по кнопке «Открыть».</p></div><div className="toolbar"><h2>{title} <span>· {loading ? "…" : cards.length}</span></h2><div className="chips">{kinds.map((item) => <button key={item} className={`chip ${kind === item ? "active" : ""}`} onClick={() => setKind(item)}>{item}</button>)}</div></div><section className="results">{loading ? <div className="empty">Ищу в базе знаний…</div> : error ? <div className="empty">{error}<div className="card-actions"><button className="smallbtn primary" onClick={onRetry}>Повторить</button></div></div> : cards.length ? cards.slice(0, 80).map((card) => <Card key={card.id} card={card} favorite={favorites.has(card.id)} onFavorite={() => onFavorite(card.id)} onOpen={() => onOpen(card)} />) : <div className="empty">Ничего не найдено. Попробуйте коротко: «герпес», «дорого», «перенос» или выберите ситуацию на главной.</div>}</section></>;
}

function Nav({ active, onClick, label, value }) { return <button className={`navbtn ${active ? "active" : ""}`} onClick={onClick}><span>{label}</span><span>{value}</span></button>; }
function methodOf(card) {
  if (card.method) return card.method;
  const text = card.title.toLowerCase();
  if (text.includes("пцр")) return "ПЦР";
  if (text.includes("иммуноблот")) return "Иммуноблот";
  if (text.includes("иммунофлюоресценц")) return "Иммунофлюоресценция";
  if (text.includes("иммунокэп") || text.includes("immunocap")) return "ИммуноКЭП";
  if (text.includes("igg")) return "Определение антител IgG";
  if (text.includes("igm")) return "Определение антител IgM";
  return "Согласно названию исследования";
}
function Card({ card, onOpen }) {
  const isLab = card.kind === "Лабораторное исследование";
  return <article className="card" onClick={onOpen} role="button" tabIndex="0" onKeyDown={(event) => { if (event.key === "Enter") onOpen(); }}>
    <h3>{card.title}</h3>
    {isLab ? <div className="analysis-summary"><div><b>Метод:</b> {methodOf(card)}</div><div><b>Артикул:</b> {card.green_clinic_code || card.code}</div><div><b>Цена:</b> {card.price}</div></div> : <p>{card.quick}</p>}
  </article>;
}
function Drawer({ card, onClose }) {
  const isLab = card.kind === "Лабораторное исследование";
  return <div className="drawer open"><div className="shade" onClick={onClose} /><article className="sheet"><header className="sheet-head"><h2>{card.title}</h2><button className="close" onClick={onClose}>✕</button></header><div className="sheet-body">{isLab ? <><div className="info"><b>Метод:</b> {methodOf(card)}</div><div className="info"><b>Артикул:</b> {card.green_clinic_code || card.code}</div><div className="info"><b>Цена:</b> {card.price}</div><div className="info"><b>Тип биоматериала:</b> {card.biomaterial || "Уточняется"}</div><div className="info"><b>Подготовка:</b> {card.prep || "Уточняется"}</div><div className="info"><b>Срок выполнения:</b> {card.duration || "Уточняется"}</div></> : <KnowledgeDrawer card={card} />}</div></article></div>;
}

function KnowledgeDrawer({ card }) {
  const sections = Array.isArray(card.sections) ? card.sections : [];
  return <>
    <div className="answer">{card.patient_answer || card.quick}</div>
    {sections.map((section, index) => <section className="knowledge-section" key={`${section.heading}-${index}`}>
      <h3>{section.heading}</h3>
      {section.text && <p>{section.text}</p>}
      {section.what && <p><b>Что это:</b> {section.what}</p>}
      {section.say && <p><b>Как сказать пациенту:</b> «{section.say}»</p>}
      {section.remember && <p><b>Важно:</b> {section.remember}</p>}
      {section.pronunciation?.length ? <ul>{section.pronunciation.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </section>)}
    {card.dont?.length ? <section className="knowledge-section"><h3>Не говорить</h3><ul>{card.dont.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
  </>;
}

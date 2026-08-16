import { useEffect, useMemo, useState } from "react";

const apiBase = import.meta.env.VITE_API_URL || "/api";
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const api = (path) => fetch(`${apiBase}${path}`, { headers: apiKey ? { apikey: apiKey } : {} }).then((response) => {
  if (!response.ok) throw new Error("API error");
  return response.json();
});

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
      } catch { setError("Не удалось получить данные. Проверьте подключение к базе знаний."); }
      finally { setLoading(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query, module, view]);

  const kinds = useMemo(() => ["Все", ...new Set(cards.map((card) => card.kind).filter(Boolean))], [cards]);
  const visible = useMemo(() => cards.filter((card) => (kind === "Все" || card.kind === kind) && (view !== "favorites" || favorites.has(card.id))), [cards, kind, view, favorites]);
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
      <button className="brand" onClick={clear} aria-label="На главную"><div className="logo">G</div><div><b>Green Clinic</b><small>Intelligence</small></div></button>
      <div className="side-title">Рабочее пространство</div>
      <Nav active={view === "home"} onClick={clear} label="Пациент сейчас" value="⌂" />
      <Nav active={view === "library" && !module} onClick={showLibrary} label="Библиотека знаний" value={libraryCount || "…"} />
      <Nav active={view === "favorites"} onClick={openFavorites} label="Избранное" value={favorites.size} />
      {view === "library" && <><div className="side-title">Направления</div><div className="module-list">{modules.map((item) => <Nav key={item.module} active={module === item.module} onClick={() => chooseModule(item.module)} label={item.module} value={item.count} />)}</div></>}
    </aside>
    <section className="content">
      <div className="topbar"><div className="searchbox"><span className="search-icon">⌕</span><input value={query} onChange={(event) => { setView("results"); setModule(""); setKind("Все"); setQuery(event.target.value); }} placeholder="Например: «анализ на герпес», «дорого», «мама просит результаты»" /><button className="search-clear" onClick={clear}>Очистить</button></div></div>
      <main className="main">{view === "home" ? <Home onWorkflow={runWorkflow} onLibrary={showLibrary} /> : <Results title={title} cards={visible} kinds={kinds} kind={kind} setKind={setKind} loading={loading} error={error} favorites={favorites} onFavorite={toggleFavorite} onOpen={setCurrent} />}</main>
    </section>
    {current && <Drawer card={current} favorite={favorites.has(current.id)} onFavorite={() => toggleFavorite(current.id)} onClose={() => setCurrent(null)} />}
  </div>;
}

function Home({ onWorkflow, onLibrary }) {
  return <>
    <section className="hero workspace-hero"><div><span className="eyebrow">Рабочая навигация</span><h1>Что происходит с пациентом?</h1><p>Выберите ситуацию — получите готовый скрипт, вопросы для уточнения и следующий шаг. Искать по разделам не нужно.</p></div><button className="library-cta" onClick={onLibrary}>Открыть всю библиотеку <span>→</span></button></section>
    <section className="workflow-section"><div className="section-heading"><div><span className="eyebrow">Быстрый старт</span><h2>Выберите рабочую ситуацию</h2></div><p>Каждая кнопка запускает поиск по готовым карточкам.</p></div><div className="workflow-grid">{workflows.map(([title, description, query, icon]) => <button className="workflow-card" key={title} onClick={() => onWorkflow(query)}><span className="workflow-icon">{icon}</span><b>{title}</b><small>{description}</small><span className="workflow-arrow">→</span></button>)}</div></section>
    <section className="safety-strip"><div><b>Срочная ситуация?</b><span>Боль в груди, выраженная одышка, потеря сознания, внезапная слабость или нарушение речи.</span></div><button onClick={() => onWorkflow("боль в груди")}>Открыть алгоритм</button></section>
  </>;
}

function Results({ title, cards, kinds, kind, setKind, loading, error, favorites, onFavorite, onOpen }) {
  return <><div className="results-intro"><span className="eyebrow">База знаний</span><p>Сначала — краткая карточка, затем подробности по кнопке «Открыть».</p></div><div className="toolbar"><h2>{title} <span>· {loading ? "…" : cards.length}</span></h2><div className="chips">{kinds.map((item) => <button key={item} className={`chip ${kind === item ? "active" : ""}`} onClick={() => setKind(item)}>{item}</button>)}</div></div><section className="results">{loading ? <div className="empty">Ищу в базе знаний…</div> : error ? <div className="empty">{error}</div> : cards.length ? cards.slice(0, 80).map((card) => <Card key={card.id} card={card} favorite={favorites.has(card.id)} onFavorite={() => onFavorite(card.id)} onOpen={() => onOpen(card)} />) : <div className="empty">Ничего не найдено. Попробуйте коротко: «герпес», «дорого», «перенос» или выберите ситуацию на главной.</div>}</section></>;
}

function Nav({ active, onClick, label, value }) { return <button className={`navbtn ${active ? "active" : ""}`} onClick={onClick}><span>{label}</span><span>{value}</span></button>; }
function Card({ card, favorite, onFavorite, onOpen }) { const red = card.urgency === "Красная"; return <article className="card" onClick={onOpen}><button className={`fav ${favorite ? "on" : ""}`} onClick={(event) => { event.stopPropagation(); onFavorite(); }}>{favorite ? "★" : "☆"}</button><div className="meta">{card.module} · {card.kind} · {card.id}</div><h3>{card.title}</h3><p>{card.quick}</p>{(red || card.urgency === "Оранжевая") && <div className={`flag ${red ? "red" : "orange"}`}>● {red ? "Красный флаг" : "Повышенное внимание"}</div>}<div className="tags">{(card.keywords || []).slice(0, 5).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div><div className="card-actions"><button className="smallbtn primary" onClick={(event) => { event.stopPropagation(); onOpen(); }}>Открыть</button><button className="smallbtn" onClick={(event) => { event.stopPropagation(); navigator.clipboard.writeText(card.quick); }}>Копировать</button></div></article>; }
function Drawer({ card, favorite, onFavorite, onClose }) { const infos = [["Стоимость", card.price], ["Подготовка", card.prep], ["Длительность", card.duration], ["Специалист", card.doctor]].filter(([, value]) => value); return <div className="drawer open"><div className="shade" onClick={onClose} /><article className="sheet"><header className="sheet-head"><div className="meta">{card.module} · {card.kind} · {card.id}</div><h2>{card.title}</h2><button className="close" onClick={onClose}>✕</button></header><div className="sheet-body"><h4>Готовый ответ пациенту</h4><div className="answer">{card.patient_answer || card.quick}</div>{infos.map(([name, value]) => <div className="info" key={name}><b>{name}:</b> {value}</div>)}<Info title="Что уточнить" items={card.ask} fallback="Дополнительные вопросы не указаны." /><Info title="Что нельзя говорить" items={card.dont} fallback="Соблюдать общий стандарт общения Green Clinic." warning /><Info title="Следующий шаг" items={[card.next]} fallback="Подобрать запись по ситуации." /><Info title="Источник" items={[card.source]} fallback="Внутренняя база Green Clinic" /></div><div className="sheet-actions"><button className="action" onClick={onFavorite}>{favorite ? "★ В избранном" : "☆ В избранное"}</button><button className="action primary" onClick={() => navigator.clipboard.writeText(card.patient_answer || card.quick)}>Скопировать ответ</button></div></article></div>; }
function Info({ title, items = [], fallback, warning }) { return <div className={`block ${warning ? "warning" : ""}`}><h4>{title}</h4><ul>{(items.filter(Boolean).length ? items.filter(Boolean) : [fallback]).map((item) => <li key={item}>{item}</li>)}</ul></div>; }

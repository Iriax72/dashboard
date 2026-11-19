const API = "https://api.github.com";
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const ownerEl = document.getElementById("owner");
const backEl = document.getElementById("back");

let config = null;
const repoInfo = new Map();    // repo -> infos GitHub
const repoMissing = new Set(); // dépôts introuvables (404)
const readmeCache = new Map(); // repo -> HTML du README

backEl.addEventListener("click", () => { location.hash = ""; });
init();

/* ---------- Démarrage ---------- */
async function init() {
  showHome();
  try {
    const res = await fetch("projects.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("http");
    config = await res.json();
    if (!config || !Array.isArray(config.projects)) throw new Error("format");
  } catch (e) {
    return showNotice({
      kind: "error",
      title: "Impossible de lire projects.json",
      text: e.message === "format"
        ? "Le fichier doit contenir un champ « username » et une liste « projects »."
        : "Ouvre la page depuis un serveur local (par exemple « python3 -m http.server ») : un double-clic sur index.html bloque la lecture du fichier.",
      actions: [button("Réessayer", () => location.reload())],
    });
  }

  ownerEl.textContent = "@" + config.username;
  renderList();
  window.addEventListener("hashchange", openFromHash);

  if (!config.username || config.username.startsWith("TON-PSEUDO")) {
    return showNotice({
      kind: "info", title: "Configuration à terminer",
      text: "Ouvre projects.json et remplace TON-PSEUDO-GITHUB par ton nom d'utilisateur GitHub.",
    });
  }
  if (!config.projects.length) {
    return showNotice({
      kind: "info", title: "Aucun projet pour l'instant",
      text: "Ajoute des dépôts dans la liste « projects » de projects.json.",
    });
  }
  await loadRepoInfos();
  openFromHash();
}

function showHome() {
  document.body.classList.remove("view-detail");
  detailEl.replaceChildren(el("p", "hint", "Choisis un projet pour voir son README et son site déployé."));
}

/* ---------- Liste ---------- */
function renderList() {
  listEl.replaceChildren(...config.projects.map((p) => {
    const b = el("button", "item");
    b.type = "button";
    b.dataset.repo = p.repo;
    const name = el("span", "name");
    name.append(el("span", "dot" + (p.url ? " live" : "")), el("span", "", p.title || p.repo));
    b.append(name, el("span", "sub", p.url ? "En ligne" : "Pas de déploiement"));
    b.addEventListener("click", () => { location.hash = encodeURIComponent(p.repo); });
    return b;
  }));
}

async function loadRepoInfos() {
  await Promise.all(config.projects.map(async (p) => {
    try {
      const res = await fetch(`${API}/repos/${config.username}/${p.repo}`);
      if (res.ok) repoInfo.set(p.repo, await res.json());
      else if (res.status === 404) repoMissing.add(p.repo);
    } catch { /* le détail affichera l'erreur réseau */ }
  }));
}

/* ---------- Navigation ---------- */
function openFromHash() {
  if (!config) return;
  const repo = decodeURIComponent(location.hash.slice(1));
  const project = config.projects.find((p) => p.repo === repo);
  listEl.querySelectorAll(".item").forEach((b) =>
    b.setAttribute("aria-current", String(b.dataset.repo === repo)));
  if (!project) return showHome();
  document.body.classList.add("view-detail");
  showProject(project);
  detailEl.scrollTop = 0;
  detailEl.focus({ preventScroll: true });
}

/* ---------- Fiche projet ---------- */
async function showProject(p) {
  const info = repoInfo.get(p.repo);
  const ghUrl = `https://github.com/${config.username}/${p.repo}`;

  const left = el("div");
  left.append(el("h2", "", p.title || p.repo));
  if (info?.description) left.append(el("p", "desc", info.description));
  if (info) {
    const ul = el("ul", "facts");
    [info.language, `${info.stargazers_count} étoiles`,
     "Mis à jour le " + new Date(info.pushed_at).toLocaleDateString("fr-FR")]
      .filter(Boolean).forEach((t) => ul.append(el("li", "", t)));
    left.append(ul);
  }
  const actions = el("div", "actions");
  actions.append(link("Ouvrir le site", p.url, "btn primary"), link("Voir sur GitHub", ghUrl, "btn"));
  const head = el("div", "head");
  head.append(left, actions);

  detailEl.replaceChildren(head);

  if (repoMissing.has(p.repo)) {
    return detailEl.append(notice({
      kind: "error", title: "Dépôt introuvable",
      text: `Le dépôt « ${config.username}/${p.repo} » n'existe pas ou n'est pas public. Vérifie son nom dans projects.json.`,
    }));
  }

  const loading = el("div", "skeleton");
  loading.setAttribute("aria-busy", "true");
  loading.append(el("span"), el("span"), el("span"), el("span"));
  detailEl.append(loading);

  try {
    const html = await getReadme(p.repo);
    if (!isCurrent(p)) return;
    const article = el("article", "readme");
    article.innerHTML = html;
    loading.replaceWith(article);
  } catch (e) {
    if (!isCurrent(p)) return;
    const retry = button("Réessayer", () => { readmeCache.delete(p.repo); showProject(p); });
    loading.replaceWith(notice(readmeProblem(e, ghUrl, retry)));
  }
}

const isCurrent = (p) => decodeURIComponent(location.hash.slice(1)) === p.repo;

function readmeProblem(e, ghUrl, retry) {
  switch (e.code) {
    case "none":
      return { kind: "info", title: "Pas de README pour ce projet",
        text: "Ce dépôt n'en contient pas encore. Tu peux en ajouter un directement sur GitHub.",
        actions: [link("Ajouter un README", ghUrl, "btn")] };
    case "rate":
      return { kind: "warning", title: "Limite GitHub atteinte",
        text: `GitHub autorise 60 requêtes par heure sans identification. ${e.resetAt ? "Réessaie vers " + e.resetAt + "." : "Réessaie un peu plus tard."}`,
        actions: [retry] };
    case "network":
      return { kind: "warning", title: "Connexion impossible",
        text: "GitHub est injoignable. Vérifie ta connexion internet puis réessaie.", actions: [retry] };
    default:
      return { kind: "error", title: "Le README n'a pas pu être chargé",
        text: `GitHub a répondu par une erreur (${e.status || "inconnue"}).`, actions: [retry] };
  }
}

/* ---------- README (HTML déjà rendu et nettoyé par GitHub) ---------- */
async function getReadme(repo) {
  if (readmeCache.has(repo)) return readmeCache.get(repo);
  let res;
  try {
    res = await fetch(`${API}/repos/${config.username}/${repo}/readme`, {
      headers: { Accept: "application/vnd.github.html+json" },
    });
  } catch { throw { code: "network" }; }

  if (res.status === 404) throw { code: "none" };
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    throw { code: "rate", resetAt: reset ? new Date(reset * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "" };
  }
  if (!res.ok) throw { code: "http", status: res.status };

  const html = fixRelativeUrls(await res.text(), repo);
  readmeCache.set(repo, html);
  return html;
}

function fixRelativeUrls(html, repo) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const raw = `https://raw.githubusercontent.com/${config.username}/${repo}/HEAD/`;
  const blob = `https://github.com/${config.username}/${repo}/blob/HEAD/`;
  const isRelative = (u) => u && !/^([a-z]+:|#|\/\/)/i.test(u);

  doc.querySelectorAll("img[src]").forEach((img) => {
    const s = img.getAttribute("src");
    if (isRelative(s)) img.src = raw + s.replace(/^\.?\//, "");
  });
  doc.querySelectorAll("a[href]").forEach((a) => {
    const h = a.getAttribute("href");
    if (isRelative(h)) a.href = blob + h.replace(/^\.?\//, "");
    if (!h.startsWith("#")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  });
  return doc.body.innerHTML;
}

/* ---------- Petits utilitaires d'interface ---------- */
function el(tag, cls = "", text = "") {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

function button(label, onClick) {
  const b = el("button", "btn", label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function link(label, href, cls) {
  const a = el("a", cls, label);
  if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  else a.setAttribute("aria-disabled", "true");
  return a;
}

// Carte de message : info (bleu), warning (orange), error (rouge)
function notice({ kind, title, text, actions = [] }) {
  const n = el("div", `notice ${kind}`);
  n.setAttribute("role", kind === "error" ? "alert" : "status");
  n.append(el("span", "icon", kind === "info" ? "i" : "!"), el("h3", "", title), el("p", "", text));
  if (actions.length) { const a = el("div", "actions"); a.append(...actions); n.append(a); }
  return n;
}

function showNotice(opts) {
  detailEl.replaceChildren(notice(opts));
  document.body.classList.add("view-detail");
}

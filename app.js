const API = "https://api.github.com";
const listEl = document.getElementById("list");
const detailEl = document.getElementById("detail");
const ownerEl = document.getElementById("owner");

let config = null;
const repoInfo = new Map();   // repo -> infos GitHub
const readmeCache = new Map(); // repo -> HTML du README

init();

async function init() {
  try {
    const res = await fetch("projects.json");
    if (!res.ok) throw new Error("projects.json introuvable");
    config = await res.json();
  } catch (e) {
    showError("Impossible de lire projects.json. Lance la page via un serveur local (ex. « python3 -m http.server »), pas en double-cliquant sur le fichier.");
    return;
  }

  ownerEl.textContent = "@" + config.username;
  renderList();
  loadRepoInfos();
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
}

/* ---------- Liste ---------- */
function renderList() {
  listEl.innerHTML = "";
  config.projects.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "item";
    btn.dataset.repo = p.repo;
    btn.innerHTML = `
      <span class="name"><span class="dot ${p.url ? "live" : ""}"></span><span class="t"></span></span>
      <span class="sub">${p.url ? "En ligne" : "Pas de déploiement"}</span>`;
    btn.querySelector(".t").textContent = p.title || p.repo;
    btn.addEventListener("click", () => { location.hash = p.repo; });
    listEl.appendChild(btn);
  });
}

async function loadRepoInfos() {
  await Promise.all(config.projects.map(async (p) => {
    try {
      const res = await fetch(`${API}/repos/${config.username}/${p.repo}`);
      if (!res.ok) throw new Error(res.status);
      repoInfo.set(p.repo, await res.json());
    } catch { /* la fiche affichera l'erreur */ }
  }));
  openFromHash(true);
}

/* ---------- Détail ---------- */
function openFromHash(silent) {
  const repo = decodeURIComponent(location.hash.slice(1));
  const project = config.projects.find((p) => p.repo === repo);
  listEl.querySelectorAll(".item").forEach((b) =>
    b.setAttribute("aria-current", String(b.dataset.repo === repo)));
  if (project) showProject(project);
  else if (silent !== true) {
    detailEl.innerHTML = `<p class="empty">Choisis un projet dans la liste pour voir son README et son site déployé.</p>`;
  }
}

async function showProject(p) {
  const info = repoInfo.get(p.repo);
  detailEl.innerHTML = "";

  const head = document.createElement("div");
  head.className = "head";
  const left = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.textContent = p.title || p.repo;
  left.appendChild(h2);

  if (info?.description) {
    const d = document.createElement("p");
    d.className = "muted";
    d.textContent = info.description;
    left.appendChild(d);
  }
  if (info) {
    const ul = document.createElement("ul");
    ul.className = "facts";
    [info.language, `${info.stargazers_count} ★`,
     "Mis à jour le " + new Date(info.pushed_at).toLocaleDateString("fr-FR")]
      .filter(Boolean)
      .forEach((t) => { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
    left.appendChild(ul);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    link("Ouvrir le site", p.url, "btn primary"),
    link("Voir sur GitHub", `https://github.com/${config.username}/${p.repo}`, "btn")
  );
  head.append(left, actions);

  const readme = document.createElement("article");
  readme.className = "readme";
  readme.textContent = "Chargement du README…";
  detailEl.append(head, readme);

  try {
    readme.innerHTML = await getReadme(p.repo);
  } catch (e) {
    readme.className = "error";
    readme.textContent = e.message;
  }
}

function link(label, href, cls) {
  const a = document.createElement("a");
  a.className = cls;
  a.textContent = label;
  if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  else a.setAttribute("aria-disabled", "true");
  return a;
}

/* ---------- README (HTML déjà rendu et nettoyé par GitHub) ---------- */
async function getReadme(repo) {
  if (readmeCache.has(repo)) return readmeCache.get(repo);
  const res = await fetch(`${API}/repos/${config.username}/${repo}/readme`, {
    headers: { Accept: "application/vnd.github.html+json" },
  });
  if (res.status === 404) throw new Error("Ce dépôt n'a pas de README.");
  if (res.status === 403) throw new Error("Limite de requêtes GitHub atteinte (60 par heure sans token). Réessaie plus tard.");
  if (!res.ok) throw new Error(`Erreur GitHub (${res.status}).`);
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

function showError(msg) {
  detailEl.innerHTML = "";
  const p = document.createElement("p");
  p.className = "error";
  p.textContent = msg;
  detailEl.appendChild(p);
}

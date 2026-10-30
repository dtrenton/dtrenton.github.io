(function () {
  const data = window.SITE_DATA;
  if (!data?.profile || !data?.sections) {
    document.documentElement.classList.add("data-unavailable");
    return;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };
  const escapeHtml = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shortName = data.profile.name?.replace(/,\s*Ph\.D\.$/, "") || "";
  const parts = shortName.split(/\s+/).filter(Boolean);
  const lastName = parts.at(-1) || "";
  const initials = parts.slice(0, -1).map((part) => `${part.charAt(0)}.`);
  const spacedInitials = initials.join(" ");
  const compactInitials = initials.join("");
  const nameVariants = [
    data.profile.name,
    shortName,
    `${lastName}, ${spacedInitials}`,
    `${lastName}, ${spacedInitials.replace(/\.$/, "")}`,
    `${lastName}, ${compactInitials}`,
    `${lastName}, ${compactInitials.replace(/\.$/, "")}`,
  ].filter(Boolean).sort((a, b) => b.length - a.length);
  const authorPattern = nameVariants.length ? new RegExp(nameVariants.map(escapeRegExp).join("|"), "g") : null;
  const formatPublication = (text) => {
    const escaped = escapeHtml(text);
    const authored = authorPattern ? escaped.replace(authorPattern, (name) => `<strong>${name}</strong>`) : escaped;
    return authored.replace(/https:\/\/doi\.org\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  };
  const splitCompact = (entry) => {
    if (typeof entry !== "string") return entry || {};
    const [title = "", institution = "", date = "", ...details] = entry.split(" | ");
    return { title, institution, date, details };
  };

  document.title = `${data.profile.name} | Curriculum Vitae`;
  document.querySelectorAll("[data-field='name']").forEach((node) => { node.textContent = data.profile.name; });
  const email = data.profile.contact?.find((item) => item.label === "Email")?.value?.split("|")[0]?.trim();
  if (email) document.querySelectorAll('a[href^="mailto:"]').forEach((link) => { link.href = `mailto:${email}`; });

  const contact = document.querySelector("[data-profile-contact]");
  (data.profile.contact || []).forEach((item) => {
    const row = el("div");
    row.appendChild(el("dt", "", item.label));
    row.appendChild(el("dd", "", item.value));
    contact?.appendChild(row);
  });

  const headshot = document.querySelector("[data-headshot]");
  const fallback = document.querySelector("[data-headshot-fallback]");
  const showFallback = () => { if (headshot) headshot.hidden = true; if (fallback) fallback.hidden = false; };
  headshot?.addEventListener("error", showFallback, { once: true });
  if (headshot?.complete && headshot.naturalWidth === 0) showFallback();

  const renderEducation = (container, entries) => entries.forEach((entry) => {
    const article = el("article", "education-entry");
    article.appendChild(el("p", "compact-entry", entry.text));
    container.appendChild(article);
  });

  const renderAppointments = (container, entries) => entries.forEach((entry) => {
    const article = el("article", "appointment-entry");
    entry.titles.forEach((title) => article.appendChild(el("p", "appointment-title", title)));
    entry.details.forEach((detail) => article.appendChild(el("p", "appointment-detail", detail)));
    if (entry.date) article.appendChild(el("p", "appointment-date", entry.date));
    container.appendChild(article);
  });

  const renderPublications = (container, groups) => groups.forEach((group, index) => {
    const section = el("section", "publication-group");
    section.dataset.publicationGroup = String(index);
    section.appendChild(el("h3", "group-title", group.subheading));
    const list = el("div", "publication-list");
    group.entries.forEach((entry) => {
      const article = el("article", "publication");
      const citation = el("p", "raw-entry");
      citation.innerHTML = formatPublication(entry);
      article.appendChild(citation);
      list.appendChild(article);
    });
    section.appendChild(list);
    container.appendChild(section);
  });

  const renderGrants = (container, groups) => groups.forEach((group) => {
    const section = el("section", "grant-group");
    section.appendChild(el("h3", "group-title", group.subheading));
    const list = el("div", "grant-list");
    group.entries.forEach((entry) => {
      const article = el("article", "grant-entry");
      article.appendChild(el("h4", "grant-title", entry.title));
      if (entry.institution) article.appendChild(el("p", "grant-meta", entry.institution));
      if (entry.date) article.appendChild(el("p", "grant-date", entry.date));
      if (entry.details?.length) article.appendChild(el("p", "grant-details", entry.details.join("; ")));
      list.appendChild(article);
    });
    section.appendChild(list);
    container.appendChild(section);
  });

  const renderTeaching = (container, groups) => groups.forEach((group) => {
    const section = el("section", "teaching-group");
    section.appendChild(el("h3", "group-title", group.subheading));
    const list = el("div", "teaching-list");
    group.entries.forEach((raw) => {
      const entry = splitCompact(raw);
      const article = el("article", "teaching-entry");
      article.appendChild(el("h4", "teaching-title", entry.title));
      if (entry.institution) article.appendChild(el("p", "teaching-meta", entry.institution));
      if (entry.date) article.appendChild(el("p", "teaching-date", entry.date));
      if (entry.details?.length) article.appendChild(el("p", "teaching-details", entry.details.join("; ")));
      list.appendChild(article);
    });
    section.appendChild(list);
    container.appendChild(section);
  });

  const renderService = (container, groups) => groups.forEach((group) => {
    const section = el("section", "service-group");
    section.appendChild(el("h3", "service-subheading", group.subheading));
    const list = el("ul", "service-list");
    group.entries.forEach((entry) => {
      const item = el("li", "service-entry");
      item.appendChild(el("span", "", entry.text));
      if (entry.date) item.appendChild(el("time", "", entry.date));
      list.appendChild(item);
    });
    section.appendChild(list);
    container.appendChild(section);
  });

  const renderHonors = (container, entries) => entries.forEach((entry) => {
    const article = el("article", "honor-entry");
    article.appendChild(el("p", "honor-title", entry.title));
    if (entry.label) article.appendChild(el("p", "honor-detail", entry.label));
    entry.details?.forEach((detail) => article.appendChild(el("p", "honor-detail", detail)));
    container.appendChild(article);
  });

  const renderSkills = (container, entries) => {
    const list = el("ul", "skills-list");
    entries.forEach((entry) => {
      const item = el("li", "skills-entry");
      const split = entry.search(/[:(]/);
      if (split > -1) { item.appendChild(el("strong", "skill-name", entry.slice(0, split).trim())); item.appendChild(document.createTextNode(` ${entry.slice(split)}`)); }
      else item.textContent = entry;
      list.appendChild(item);
    });
    container.appendChild(list);
  };
  const renderAffiliations = (container, entries) => {
    const list = el("ul", "affiliations-list");
    entries.forEach((entry) => list.appendChild(el("li", "affiliations-entry", entry)));
    container.appendChild(list);
  };

  const renderers = { education: renderEducation, appointments: renderAppointments, publications: renderPublications, grants: renderGrants, teaching: renderTeaching, service: renderService, honors: renderHonors, skills: renderSkills, affiliations: renderAffiliations };
  document.querySelectorAll("[data-section]").forEach((container) => {
    const key = container.dataset.section;
    const entries = data.sections[key];
    if (Array.isArray(entries) && renderers[key]) renderers[key](container, entries);
  });

  const filters = document.querySelector("[data-publication-filters]");
  const publicationGroups = Array.from(document.querySelectorAll(".publication-group"));
  if (filters && publicationGroups.length) {
    const addFilter = (label, value, pressed = false) => {
      const button = el("button", "filter-button", label);
      button.type = "button"; button.dataset.filter = value; button.setAttribute("aria-pressed", String(pressed)); filters.appendChild(button);
    };
    addFilter("All", "all", true);
    publicationGroups.forEach((group, index) => addFilter(group.querySelector(".group-title")?.textContent || `Group ${index + 1}`, String(index)));
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      filters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      publicationGroups.forEach((group) => { group.hidden = button.dataset.filter !== "all" && group.dataset.publicationGroup !== button.dataset.filter; });
    });
  }

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  navToggle?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks?.addEventListener("click", (event) => {
    if (event.target.closest("a")) { navLinks.classList.remove("is-open"); navToggle?.setAttribute("aria-expanded", "false"); }
  });
})();

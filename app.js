(function () {
  const data = window.SITE_DATA;

  if (!data || !data.profile || !data.sections) {
    document.documentElement.classList.add("data-unavailable");
    return;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const escapeHtml = (text) => String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const shortName = data.profile.name ? data.profile.name.replace(/,\s*Ph\.D\.$/, "") : "";
  const nameParts = shortName.split(/\s+/).filter(Boolean);
  const lastName = nameParts.at(-1) || "";
  const initials = nameParts.slice(0, -1).map((part) => `${part.charAt(0)}.`);
  const citationNameVariants = [
    data.profile.name,
    shortName,
    lastName && initials.length ? `${lastName}, ${initials.join(" ")}` : "",
    lastName && initials.length ? `${lastName}, ${initials.join("")}` : "",
  ].filter(Boolean).sort((a, b) => b.length - a.length);

  const citationNamePattern = citationNameVariants.length
    ? new RegExp(citationNameVariants.map(escapeRegExp).join("|"), "g")
    : null;

  const linkDoiUrls = (html) => html.replace(
    /https:\/\/doi\.org\/[^\s<]+/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );

  const formatPublication = (text) => {
    const escapedText = escapeHtml(text);
    const withAuthor = citationNamePattern
      ? escapedText.replace(citationNamePattern, (name) => `<strong>${name}</strong>`)
      : escapedText;
    return linkDoiUrls(withAuthor);
  };

  const yearFrom = (text) => (String(text).match(/\b(20\d{2})\b/) || [])[1] || "";
  const publicationParts = (text) => {
    const source = String(text);
    const doi = (source.match(/https:\/\/doi\.org\/[^\s]+/) || [])[0] || "";
    const clean = doi ? source.replace(doi, "").trim() : source;
    const yearMatch = clean.match(/\((20\d{2})\)\.\s*/);
    const year = yearMatch?.[1] || yearFrom(clean);
    const authors = yearMatch ? clean.slice(0, yearMatch.index).replace(/[,.\s]+$/, "") : "";
    const remainder = yearMatch ? clean.slice(yearMatch.index + yearMatch[0].length) : clean;
    const titleEnd = remainder.indexOf(". ");
    const title = titleEnd > -1 ? remainder.slice(0, titleEnd + 1) : remainder;
    const venue = titleEnd > -1 ? remainder.slice(titleEnd + 2).trim() : "";
    return { year, authors, title, venue, doi };
  };
  const setText = (selector, value) => document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value || "";
  });

  const profileContact = (label) => data.profile.contact.find((item) => item.label === label)?.value || "";
  const email = profileContact("Email").split("|")[0].trim();
  if (email) {
    document.querySelectorAll('a[href^="mailto:"]').forEach((link) => link.href = `mailto:${email}`);
  }
  setText("[data-field='name']", data.profile.name);
  document.title = `${data.profile.name} | Cyber Education`;

  const headshot = document.querySelector("[data-headshot]");
  const headshotFallback = document.querySelector("[data-headshot-fallback]");
  const showHeadshotFallback = () => {
    if (headshot) headshot.hidden = true;
    if (headshotFallback) headshotFallback.hidden = false;
  };
  if (headshot) {
    headshot.addEventListener("error", showHeadshotFallback, { once: true });
    if (headshot.complete && headshot.naturalWidth === 0) showHeadshotFallback();
  }

  const featuredContainer = document.querySelector('[data-render="featured-publications"]');
  if (featuredContainer) {
    const publicationGroups = data.sections.publications || [];
    const featured = [
      ...(publicationGroups[0]?.entries || []).slice(0, 2).map((entry) => ({ entry, type: publicationGroups[0].subheading })),
      ...(publicationGroups[1]?.entries || []).slice(0, 1).map((entry) => ({ entry, type: publicationGroups[1].subheading })),
    ];
    featured.forEach(({ entry, type }) => {
      const parts = publicationParts(entry);
      const article = el("article", "publication-row");
      article.appendChild(el("div", "publication-year", parts.year));
      const main = el("div", "publication-main");
      main.appendChild(el("h3", "publication-title", parts.title));
      const authors = el("p", "publication-authors");
      authors.innerHTML = citationNamePattern
        ? escapeHtml(parts.authors).replace(citationNamePattern, (name) => `<strong>${name}</strong>`)
        : escapeHtml(parts.authors);
      main.appendChild(authors);
      article.appendChild(main);
      const meta = el("div", "publication-meta");
      meta.appendChild(el("p", "publication-venue", parts.venue || type));
      if (parts.doi) {
        const link = el("a", "publication-link", "DOI ↗");
        link.href = parts.doi;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        meta.appendChild(link);
      }
      article.appendChild(meta);
      featuredContainer.appendChild(article);
    });
  }

  const currentWorkContainer = document.querySelector('[data-render="current-work"]');
  if (currentWorkContainer) {
    const currentAppointment = data.sections.appointments?.[0];
    const currentGrants = (data.sections.grants || [])
      .flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.subheading })))
      .filter((entry) => /present/i.test(entry.date || ""))
      .slice(0, 2);
    const work = [];
    if (currentAppointment) {
      work.push({
        label: "Leadership",
        title: currentAppointment.titles.join(" & "),
        detail: [currentAppointment.details[0], currentAppointment.date].filter(Boolean).join(" · "),
      });
    }
    currentGrants.forEach((entry) => work.push({
      label: entry.group === "Independent Research" ? "Research" : "Project",
      title: entry.title,
      detail: [entry.institution, entry.date].filter(Boolean).join(" · "),
    }));
    work.forEach((entry, index) => {
      const details = el("details", "project-item");
      if (index === 0) details.open = true;
      const summary = el("summary");
      summary.appendChild(el("span", "project-label", entry.label));
      summary.appendChild(el("span", "project-title", entry.title));
      summary.appendChild(el("span", "project-toggle", "+"));
      details.appendChild(summary);
      details.appendChild(el("p", "project-detail", entry.detail));
      currentWorkContainer.appendChild(details);
    });
  }

  const timelineContainer = document.querySelector('[data-render="experience-timeline"]');
  if (timelineContainer) {
    (data.sections.appointments || []).forEach((appointment, index) => {
      const article = el("article", `timeline-item${index === 0 ? " current" : ""}`);
      article.appendChild(el("div", "timeline-date", appointment.date));
      const content = el("div", "timeline-content");
      if (index === 0) content.appendChild(el("span", "timeline-status", "Current appointment"));
      content.appendChild(el("h3", "", appointment.titles.join(" · ")));
      content.appendChild(el("p", "", appointment.details.join(" · ")));
      article.appendChild(content);
      timelineContainer.appendChild(article);
    });
  }

  const teachingHighlights = document.querySelector('[data-render="teaching-highlights"]');
  if (teachingHighlights) {
    const teaching = data.sections.teaching || [];
    const teachingTitle = (entry) => typeof entry === "string" ? entry.split(" | ")[0] : entry?.title || "";
    const teachingInstitution = (entry) => typeof entry === "string" ? entry.split(" | ")[1] || "" : entry?.institution || "";
    const instructor = teaching.find((group) => group.subheading === "Instructor of Record");
    const development = teaching.find((group) => /Professional Development/.test(group.subheading));
    const leadershipTitle = data.sections.appointments?.[0]?.titles?.find((title) => /Director/.test(title));
    const highlights = [
      { title: "Program Leadership", text: leadershipTitle || "Academic program leadership" },
      { title: "Instructor of Record", text: (instructor?.entries || []).map(teachingTitle).filter(Boolean).join(" · ") },
      { title: "Professional Development", text: (development?.entries || []).map(teachingTitle).filter(Boolean).join(" · ") },
      { title: "Graduate Teaching", text: teachingInstitution(teaching.find((group) => group.subheading === "Teaching Assistant")?.entries?.[0]) || "Louisiana State University" },
    ];
    highlights.forEach((highlight) => {
      const article = el("article", "teaching-row");
      article.appendChild(el("h3", "", highlight.title));
      article.appendChild(el("p", "", highlight.text));
      teachingHighlights.appendChild(article);
    });
  }

  const renderEducation = (container, entries) => {
    entries.forEach((entry) => {
      const article = el("article", "item education-entry");
      article.appendChild(el("p", "compact-entry", entry.text));
      container.appendChild(article);
    });
  };

  const renderAppointments = (container, entries) => {
    entries.forEach((entry) => {
      const article = el("article", "appointment-entry");
      entry.titles.forEach((title) => article.appendChild(el("p", "appointment-title", title)));
      entry.details.forEach((detail) => article.appendChild(el("p", "appointment-detail", detail)));
      if (entry.date) article.appendChild(el("p", "appointment-date", entry.date));
      container.appendChild(article);
    });
  };

  const renderPublications = (container, groups) => {
    groups.forEach((group, index) => {
      const section = el("section", "publication-group");
      section.dataset.publicationGroup = String(index);
      section.appendChild(el("h4", "group-title", group.subheading));
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
  };

  const renderGrants = (container, groups) => {
    groups.forEach((group) => {
      const section = el("section", "grant-group");
      section.appendChild(el("h4", "group-title", group.subheading));
      const list = el("div", "grant-list");
      group.entries.forEach((entry) => {
        const article = el("article", "grant-entry");
        article.appendChild(el("h5", "grant-title", entry.title));
        article.appendChild(el("p", "grant-meta", [entry.institution, entry.date].filter(Boolean).join(" · ")));
        if (entry.details?.length) article.appendChild(el("p", "grant-details", entry.details.join("; ")));
        list.appendChild(article);
      });
      section.appendChild(list);
      container.appendChild(section);
    });
  };

  const renderTeaching = (container, groups) => {
    groups.forEach((group) => {
      const section = el("section", "teaching-group");
      section.appendChild(el("h4", "group-title", group.subheading));
      const list = el("div", "teaching-list");
      group.entries.forEach((entry) => {
        const article = el("article", "teaching-entry");
        article.appendChild(el("h5", "teaching-title", entry.title));
        if (entry.institution) article.appendChild(el("p", "teaching-institution", entry.institution));
        if (entry.date) article.appendChild(el("p", "teaching-date", entry.date));
        if (entry.details?.length) article.appendChild(el("p", "teaching-details", entry.details.join("; ")));
        list.appendChild(article);
      });
      section.appendChild(list);
      container.appendChild(section);
    });
  };

  const renderService = (container, groups) => {
    groups.forEach((group) => {
      const section = el("section", "service-group");
      section.appendChild(el("h4", "service-subheading", group.subheading));
      const list = el("ul", "service-list");
      group.entries.forEach((entry) => list.appendChild(el("li", "service-entry", [entry.text, entry.date].filter(Boolean).join(" · "))));
      section.appendChild(list);
      container.appendChild(section);
    });
  };

  const renderHonors = (container, entries) => {
    entries.forEach((entry) => {
      const article = el("article", "honor-entry");
      article.appendChild(el("p", "honor-title", [entry.title, entry.label].filter(Boolean).join(" · ")));
      entry.details.forEach((detail) => article.appendChild(el("p", "honor-detail", detail)));
      container.appendChild(article);
    });
  };

  const renderSkills = (container, entries) => {
    const list = el("ul", "skills-list");
    entries.forEach((entry) => {
      const item = el("li", "skills-entry");
      const splitIndex = entry.search(/[:(]/);
      if (splitIndex > -1) {
        item.appendChild(el("strong", "skill-name", entry.slice(0, splitIndex).trim()));
        item.appendChild(el("span", "", ` ${entry.slice(splitIndex)}`));
      } else item.textContent = entry;
      list.appendChild(item);
    });
    container.appendChild(list);
  };

  const renderAffiliations = (container, entries) => {
    const list = el("ul", "affiliations-list");
    entries.forEach((entry) => list.appendChild(el("li", "affiliations-entry", entry)));
    container.appendChild(list);
  };

  document.querySelectorAll("[data-section]").forEach((container) => {
    const key = container.dataset.section;
    const section = data.sections[key];
    if (!Array.isArray(section)) return;
    container.innerHTML = "";
    if (key === "education") renderEducation(container, section);
    else if (key === "appointments") renderAppointments(container, section);
    else if (key === "publications") renderPublications(container, section);
    else if (key === "grants") renderGrants(container, section);
    else if (key === "teaching") renderTeaching(container, section);
    else if (key === "service") renderService(container, section);
    else if (key === "honors") renderHonors(container, section);
    else if (key === "skills") renderSkills(container, section);
    else if (key === "affiliations") renderAffiliations(container, section);
  });

  const publicationFilters = document.querySelector("[data-publication-filters]");
  const publicationGroups = Array.from(document.querySelectorAll("#publications .publication-group"));
  if (publicationFilters && publicationGroups.length) {
    const addFilter = (label, value, pressed = false) => {
      const button = el("button", "filter-button", label);
      button.type = "button";
      button.dataset.filter = value;
      button.setAttribute("aria-pressed", String(pressed));
      publicationFilters.appendChild(button);
    };
    addFilter("All", "all", true);
    publicationGroups.forEach((group, index) => {
      addFilter(group.querySelector(".group-title")?.textContent || `Group ${index + 1}`, String(index));
    });
    publicationFilters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;
      publicationFilters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      const selected = button.dataset.filter;
      publicationGroups.forEach((group) => {
        group.hidden = selected !== "all" && group.dataset.publicationGroup !== selected;
      });
    });
  }

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    navLinks.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
})();

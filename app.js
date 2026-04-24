(function () {
  const data = window.SITE_DATA;

  if (!data) {
    return;
  }

  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node) {
      node.textContent = value || "";
    }
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text) {
      node.textContent = text;
    }
    return node;
  };

  const escapeHtml = (text) => String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatPublication = (text) => escapeHtml(text)
    .replaceAll("Trent W. Dawson", "<strong>Trent W. Dawson</strong>")
    .replaceAll("Dawson, T. W.", "<strong>Dawson, T. W.</strong>")
    .replaceAll("Dawson, T.W.", "<strong>Dawson, T.W.</strong>");

  const renderSimpleItem = (item) => {
    const card = el("article", "item");
    if (typeof item === "string") {
      card.appendChild(el("p", "raw-entry", item));
      return card;
    }

    card.appendChild(el("h3", "", item.title));
    if (item.metadata) {
      card.appendChild(el("p", "entry-meta", item.metadata));
    }
    if (item.date) {
      card.appendChild(el("p", "entry-date", item.date));
    }
    if (item.details && item.details.length) {
      const list = el("ul", "entry-details");
      item.details.forEach((part) => list.appendChild(el("li", "", part)));
      card.appendChild(list);
    }
    return card;
  };

  const renderGrouped = (container, groups, itemClass) => {
    container.innerHTML = "";
    groups.forEach((group) => {
      const groupNode = el("section", "group");
      groupNode.appendChild(el("h3", "group-title", group.title));
      group.items.forEach((item) => {
        const card = el("article", itemClass || "item");
        if (typeof item === "string") {
          card.appendChild(el("p", "raw-entry", item));
        } else {
          card.appendChild(el("h3", "", item.title));
          if (item.metadata) {
            card.appendChild(el("p", "entry-meta", item.metadata));
          }
          if (item.date) {
            card.appendChild(el("p", "entry-date", item.date));
          }
          if (item.details && item.details.length) {
            const list = el("ul", "entry-details");
            item.details.forEach((part) => list.appendChild(el("li", "", part)));
            card.appendChild(list);
          }
        }
        groupNode.appendChild(card);
      });
      container.appendChild(groupNode);
    });
  };

  const renderService = (container, groups) => {
    container.innerHTML = "";
    groups.forEach((group) => {
      const groupNode = el("section", "service-group");
      groupNode.appendChild(el("h3", "service-subheading", group.subheading));

      const list = el("ul", "service-list");
      group.entries.forEach((entry) => {
        const item = el("li", "service-entry");
        item.appendChild(el("span", "service-text", entry.text));
        if (entry.date) {
          item.appendChild(el("span", "service-date", entry.date));
        }
        list.appendChild(item);
      });

      groupNode.appendChild(list);
      container.appendChild(groupNode);
    });
  };

  const renderPublications = (container, groups) => {
    container.innerHTML = "";
    groups.forEach((group) => {
      const groupNode = el("section", "publication-group");
      groupNode.appendChild(el("h3", "group-title", group.subheading));

      const list = el("div", "publication-list");
      group.entries.forEach((entry) => {
        const card = el("article", "publication");
        const citation = el("p", "raw-entry");
        citation.innerHTML = formatPublication(entry);
        card.appendChild(citation);
        list.appendChild(card);
      });

      groupNode.appendChild(list);
      container.appendChild(groupNode);
    });
  };

  const renderEducation = (container, entries) => {
    container.innerHTML = "";
    entries.forEach((entry) => {
      const card = el("article", "item education-entry");
      card.appendChild(el("p", "compact-entry", entry.text));
      container.appendChild(card);
    });
  };

  const renderAppointments = (container, entries) => {
    container.innerHTML = "";
    entries.forEach((entry) => {
      const block = el("article", "appointment-entry");
      if (entry.status) {
        block.appendChild(el("h3", "appointment-status", entry.status));
      }
      entry.titles.forEach((title) => block.appendChild(el("p", "appointment-title", title)));
      entry.details.forEach((detail) => block.appendChild(el("p", "appointment-detail", detail)));
      if (entry.date) {
        block.appendChild(el("p", "appointment-date", entry.date));
      }
      container.appendChild(block);
    });
  };

  const renderSkills = (container, entries) => {
    container.innerHTML = "";
    const list = el("ul", "skills-list");
    entries.forEach((entry) => list.appendChild(el("li", "skills-entry", entry)));
    container.appendChild(list);
  };

  const renderAffiliations = (container, entries) => {
    container.innerHTML = "";
    const list = el("ul", "affiliations-list");
    entries.forEach((entry) => list.appendChild(el("li", "affiliations-entry", entry)));
    container.appendChild(list);
  };

  const renderHonors = (container, entries) => {
    container.innerHTML = "";
    entries.forEach((entry) => {
      const block = el("article", "honor-entry");
      block.appendChild(el("p", "honor-title", entry.title));
      if (entry.label) {
        block.appendChild(el("p", "honor-label", entry.label));
      }
      entry.details.forEach((detail) => block.appendChild(el("p", "honor-detail", detail)));
      container.appendChild(block);
    });
  };

  setText("[data-field='summary']", data.profile.summary);
  setText("[data-field='focus']", data.profile.focus);

  const contact = document.querySelector("[data-render='contact']");
  if (contact) {
    contact.innerHTML = "";
    data.profile.contact.forEach((item) => {
      const row = el("div");
      row.appendChild(el("dt", "", item.label));
      row.appendChild(el("dd", "", item.value));
      contact.appendChild(row);
    });
  }

  document.querySelectorAll("[data-section]").forEach((container) => {
    const key = container.dataset.section;
    const section = data.sections[key];
    if (!section) {
      return;
    }

    if (key === "education" && Array.isArray(section) && section.every((item) => item.text)) {
      renderEducation(container, section);
      return;
    }

    if (key === "appointments" && Array.isArray(section) && section.every((item) => item.titles)) {
      renderAppointments(container, section);
      return;
    }

    if (key === "publications" && Array.isArray(section)) {
      renderPublications(container, section);
      return;
    }

    if (key === "service" && Array.isArray(section)) {
      renderService(container, section);
      return;
    }

    if (key === "skills" && Array.isArray(section)) {
      renderSkills(container, section);
      return;
    }

    if (key === "affiliations" && Array.isArray(section)) {
      renderAffiliations(container, section);
      return;
    }

    if (key === "honors" && Array.isArray(section) && section.every((item) => item.title && item.label)) {
      renderHonors(container, section);
      return;
    }

    if (Array.isArray(section) && section.every((item) => typeof item === "string" || item.title)) {
      container.innerHTML = "";
      section.forEach((item) => container.appendChild(renderSimpleItem(item)));
      return;
    }

    if (Array.isArray(section)) {
      renderGrouped(container, section, key === "publications" ? "publication" : key === "grants" ? "grant" : "item");
    }
  });

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
})();

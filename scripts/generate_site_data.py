#!/usr/bin/env python3
"""Generate static website data from the academic CV.

This parser intentionally prioritizes complete visible content over refined
formatting. It captures every non-empty paragraph under the requested major CV
headings until the next major heading.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
CV_PATH = ROOT / "assets" / "current-cv.docx"
JSON_PATH = ROOT / "assets" / "site-data.generated.json"
JS_PATH = ROOT / "assets" / "site-data.js"

SECTION_ALIASES = {
    "EDUCATION": "education",
    "ACADEMIC APPOINTMENTS": "appointments",
    "PUBLICATIONS": "publications",
    "GRANT EXPERIENCE": "grants",
    "GRANTS": "grants",
    "TEACHING EXPERIENCE": "teaching",
    "TEACHING": "teaching",
    "SERVICE": "service",
    "AWARDS": "honors",
    "HONORS": "honors",
}

KNOWN_MAJOR_HEADINGS = {
    *SECTION_ALIASES.keys(),
    "PROFESSIONAL EXPERIENCE",
    "TECHNICAL SKILLS",
    "ACADEMIC AFFILIATIONS",
}

GRANT_ROLES = {
    "As a Postdoc",
    "As a Grant Writer",
    "As a Graduate Assistant",
    "Independent Research",
}

TEACHING_GROUPS = {
    "Instructor of Record",
    "Teaching Assistant",
    "Professional Development Workshops",
}

PUBLICATION_GROUPS = {
    "Peer-Reviewed Conference Proceedings",
    "Peer-Reviewed Journal Articles in Revision/Review.",
    "Peer-Reviewed Journal Articles in Preparation",
    "Peer-Reviewed Conference Presentations",
}

SERVICE_GROUPS = {
    "Supervision of Graduate Assistants",
    "Service to Organizations",
    "Service to Journals and Conferences",
    "Service to Community",
}

DATE_AT_END = re.compile(
    r"(?P<date>(?:Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|Sep|Sept|Oct|Nov|Dec|Fall|Spring|Summer)?\.?\s*"
    r"\d{4}(?:[–-](?:present|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|June|Jul|July|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s*\d{4}))?"
    r"|(?:\d{4},\s*)+\d{4})$",
    re.IGNORECASE,
)
DEGREE_LINE = re.compile(r"^(?P<degree>Ph\.D\.|M\.Ed\.|B\.B\.A\.),\s*(?P<institution>.+?)\s*\((?P<year>\d{4})\)$")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ")).strip()


def document_paragraphs() -> list[str]:
    document = Document(CV_PATH)
    return [clean(paragraph.text) for paragraph in document.paragraphs if clean(paragraph.text)]


def normalized_heading(text: str) -> str:
    return clean(text).upper().rstrip(":")


def looks_like_major_heading(text: str) -> bool:
    cleaned = clean(text).rstrip(":")
    normalized = normalized_heading(text)
    if normalized in KNOWN_MAJOR_HEADINGS:
        return True
    has_letter = bool(re.search(r"[A-Za-z]", cleaned))
    is_all_caps = cleaned == cleaned.upper()
    return has_letter and is_all_caps and len(cleaned.split()) <= 5


def split_sections(lines: list[str]) -> tuple[list[str], dict[str, list[str]]]:
    header: list[str] = []
    sections: dict[str, list[str]] = {value: [] for value in SECTION_ALIASES.values()}
    current: str | None = None
    seen_first_section = False

    for line in lines:
        normalized = normalized_heading(line)
        if normalized in SECTION_ALIASES:
            current = SECTION_ALIASES[normalized]
            seen_first_section = True
            continue
        if looks_like_major_heading(line):
            current = None
            seen_first_section = True
            continue
        if current:
            sections[current].append(line)
        elif not seen_first_section:
            header.append(line)

    return header, sections


def split_trailing_date(line: str) -> tuple[str, str]:
    paren_match = re.search(r"\((?P<date>(?:Fall|Spring|Summer)?\s*\d{4}(?:[–-](?:present|\d{4}))?)\)$", line)
    if paren_match:
        return line[: paren_match.start()].strip(" ,"), paren_match.group("date").strip()

    match = DATE_AT_END.search(line)
    if not match:
        return line, ""
    return line[: match.start()].strip(" ,"), match.group("date").strip()


def compact_metadata(parts: list[str]) -> str:
    return " | ".join(part for part in parts if part)


def split_labeled_details(text: str) -> tuple[str, list[str]]:
    labels = ("PI:", "PIs:", "Award:", "Awards:", "Status:", "Proposed Budget:", "Notes:")
    positions = sorted((text.find(label), label) for label in labels if text.find(label) != -1)
    if not positions:
        return text.rstrip("."), []

    title = text[: positions[0][0]].strip().rstrip(".")
    details: list[str] = []
    for index, (position, label) in enumerate(positions):
        next_position = positions[index + 1][0] if index + 1 < len(positions) else len(text)
        details.append(text[position:next_position].strip())
    return title, details


def grouped_grants(lines: list[str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    role = ""
    base_role = ""
    institution = ""
    current: dict[str, object] | None = None

    def finish() -> None:
        nonlocal current, role
        if current:
            current["metadata"] = compact_metadata([current.get("institution", ""), current.get("role", ""), current.get("date", "")])
            current.pop("institution", None)
            current.pop("role", None)
            current.pop("date", None)
            entries.append(current)
            if role == "Independent Research":
                role = base_role
            current = None

    for raw_line in lines:
        line = str(raw_line)
        if line in GRANT_ROLES:
            finish()
            role = line
            if line.startswith("As "):
                base_role = line
                institution = ""
            continue

        before_project, marker, after_project = line.partition("Project:")
        if marker:
            finish()
            if before_project.strip():
                institution = before_project.strip()
            title, date = split_trailing_date(after_project.strip())
            title, details = split_labeled_details(title)
            current = {
                "title": title.rstrip(".") or "Project",
                "institution": institution,
                "role": role,
                "date": date,
                "details": details,
            }
            continue

        if current:
            is_labeled_detail = bool(re.match(r"^(PI|PIs|Award|Awards|Status|Proposed Budget|Notes?):", line))
            if current.get("date") and not is_labeled_detail:
                finish()
                institution = line
                continue

            title_part, date = split_trailing_date(line)
            if date and title_part == "":
                current["date"] = date
            elif date and not re.match(r"^(PI|PIs|Award|Awards|Status|Proposed Budget|Notes?):", title_part):
                current["details"].append(title_part)
                current["date"] = date
            else:
                _, labeled_details = split_labeled_details(line)
                current["details"].extend(labeled_details or [line])
            continue

        institution = line

    finish()
    return entries


def grouped_publications(lines: list[str]) -> list[dict[str, object]]:
    groups: list[dict[str, object]] = []
    current: dict[str, object] | None = None

    for line in lines:
        if line in PUBLICATION_GROUPS:
            current = {"subheading": line.rstrip("."), "entries": []}
            groups.append(current)
            continue

        if current is None:
            current = {"subheading": "Publications", "entries": []}
            groups.append(current)
        citation = re.sub(r"^\[\d+\]\s*", "", line).strip()
        if citation:
            current["entries"].append(citation)

    return [group for group in groups if group["entries"]]


def grouped_education(lines: list[str]) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for line in lines:
        match = DEGREE_LINE.match(line)
        if not match:
            continue
        entries.append({
            "degree": match.group("degree"),
            "institution": match.group("institution"),
            "year": match.group("year"),
            "text": f"{match.group('degree')}, {match.group('institution')} ({match.group('year')})",
        })
    return entries


def grouped_appointments(lines: list[str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    pending_roles: list[str] = []
    pending_date = ""
    details: list[str] = []

    def finish() -> None:
        nonlocal pending_roles, pending_date, details
        if not pending_roles and not details:
            return
        status = "Prior Appointment"
        display_date = pending_date
        if pending_date == "June 2026":
            status = "Incoming Appointment"
            display_date = "Begins June 2026"
        elif pending_date == "2025–2026":
            status = "Current Appointment"
        elif len(entries) > 0:
            status = "Prior Appointments"
        entries.append({
            "status": status,
            "titles": pending_roles,
            "details": details,
            "date": display_date,
        })
        pending_roles = []
        pending_date = ""
        details = []

    for line in lines:
        title, date = split_trailing_date(line)
        if date:
            if details:
                finish()
            pending_roles.append(title)
            pending_date = date
            continue

        details.append(line)

    finish()
    return entries


def grouped_teaching(lines: list[str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    group = ""
    index = 0

    while index < len(lines):
        line = lines[index]
        if line in TEACHING_GROUPS:
            group = line
            index += 1
            continue

        if group == "Instructor of Record":
            institution = lines[index + 1] if index + 1 < len(lines) else ""
            institution, date = split_trailing_date(institution)
            entries.append({
                "title": line,
                "metadata": compact_metadata([institution, date]),
                "details": [group],
            })
            index += 2
            continue

        if group == "Teaching Assistant":
            institution, date = split_trailing_date(line)
            details: list[str] = []
            index += 1
            while index < len(lines) and lines[index] not in TEACHING_GROUPS:
                details.append(lines[index])
                index += 1
            entries.append({
                "title": group,
                "metadata": compact_metadata([institution, date]),
                "details": details,
            })
            continue

        title, date = split_trailing_date(line)
        entries.append({
            "title": title,
            "metadata": compact_metadata([group, date]),
            "details": [],
        })
        index += 1

    return entries


def grouped_service(lines: list[str]) -> list[dict[str, object]]:
    groups: list[dict[str, object]] = []
    current: dict[str, object] | None = None

    for line in lines:
        if line in SERVICE_GROUPS:
            current = {"subheading": line, "entries": []}
            groups.append(current)
            continue

        text, date = split_trailing_date(line)
        entry = {"text": text, "date": date}

        if current is None:
            current = {"subheading": "Service", "entries": []}
            groups.append(current)
        current["entries"].append(entry)

    return groups


def section_count(section: list[object]) -> int:
    return len(section)


def profile_from(header: list[str], sections: dict[str, list[str]]) -> dict[str, object]:
    return {
        "name": header[0] if header else "Trent W. Dawson, Ph.D.",
        "affiliation": header[1] if len(header) > 1 else "",
        "location": header[2] if len(header) > 2 else "",
        "summary": (
            "Research examines pathways into computing and teaching, with related strands in community college "
            "computer science and cyber education, equitable participation, and apprenticeship-based teacher "
            "preparation. Currently a Postdoctoral Fellow at the University of Nevada, Las Vegas, where postdoctoral "
            "work focuses on apprenticeship teacher preparation. Independent research focuses on community college "
            "computer science and cyber pathways. Incoming Assistant Professor and Director of the Governors Cyber "
            "Academy at Dakota State University beginning June 2026."
        ),
        "focus": (
            "Research examines pathways into computing and teaching, with related strands in community college "
            "computer science and cyber education, equitable participation, and apprenticeship-based teacher "
            "preparation. Currently a Postdoctoral Fellow at the University of Nevada, Las Vegas, where postdoctoral "
            "work focuses on apprenticeship teacher preparation. Independent research focuses on community college "
            "computer science and cyber pathways. Incoming Assistant Professor and Director of the Governors Cyber "
            "Academy at Dakota State University beginning June 2026."
        ),
        "contact": [
            {"label": "Email", "value": "dtrentonvt [at] gmail [dot] com"},
            {"label": "ORCID", "value": "0000-0003-1845-8696"},
            {"label": "Location", "value": header[2] if len(header) > 2 else "Las Vegas, Nevada"},
        ],
        "stats": [
            {"value": str(sum(len(group["entries"]) for group in sections["publications"])), "label": "publication entries"},
            {"value": str(section_count(sections["grants"])), "label": "grant entries"},
            {"value": str(section_count(sections["teaching"])), "label": "teaching entries"},
            {"value": str(sum(len(group["entries"]) for group in sections["service"])), "label": "service entries"},
        ],
    }


def build_data() -> dict[str, object]:
    header, sections = split_sections(document_paragraphs())
    rendered_sections: dict[str, object] = {
        **sections,
        "education": grouped_education(sections["education"]),
        "appointments": grouped_appointments(sections["appointments"]),
        "publications": grouped_publications(sections["publications"]),
        "grants": grouped_grants(sections["grants"]),
        "teaching": grouped_teaching(sections["teaching"]),
        "service": grouped_service(sections["service"]),
    }
    return {
        "profile": profile_from(header, rendered_sections),
        "sections": rendered_sections,
    }


def main() -> None:
    data = build_data()
    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    JS_PATH.write_text(
        "window.SITE_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

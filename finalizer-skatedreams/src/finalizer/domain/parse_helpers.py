"""Parsing helpers for titles, RRULE, and dates."""

import re
from datetime import datetime

_ID_IN_SUMMARY = re.compile(r"\bid\s*:?\s*(\d+)\b", re.IGNORECASE)
_ID_FOR_CLEAN = re.compile(r"\s*(?:\||-)?\s*\bid\s*:?\s*\d+\b", re.IGNORECASE)
_TRAILING_PUNCT = re.compile(r"[|:\-]+$")
_MULTI_SPACE = re.compile(r"\s{2,}")
_UNTIL = re.compile(r"UNTIL=(\d{8}T\d{6}Z|\d{8})")


def limpa_titulo(s: str | None, fallback: str) -> str:
    if not s:
        return fallback
    cleaned = _ID_FOR_CLEAN.sub("", s)
    cleaned = _MULTI_SPACE.sub(" ", cleaned)
    cleaned = _TRAILING_PUNCT.sub("", cleaned).strip()
    return cleaned or fallback


def parse_id_from_summary(summary: str | None) -> int | None:
    if not summary:
        return None
    m = _ID_IN_SUMMARY.search(summary)
    return int(m.group(1)) if m else None


def parse_until_from_rrule(rrule: str | None) -> datetime | None:
    if not rrule:
        return None
    m = _UNTIL.search(rrule)
    if not m:
        return None
    raw = m.group(1)
    if "T" in raw:
        return datetime.strptime(raw, "%Y%m%dT%H%M%SZ")
    return datetime.strptime(raw, "%Y%m%d")


def parse_dd_mm_yyyy(s: str) -> datetime:
    d, m, y = s.split("/")
    return datetime(int(y), int(m), int(d))


def fmt_yyyymmdd(d: datetime) -> str:
    return d.strftime("%Y%m%d")


def rrule_sem_until(rrule: str) -> str:
    return re.sub(r";UNTIL=[^;]*", "", rrule)

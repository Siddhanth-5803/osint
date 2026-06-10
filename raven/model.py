"""Shared result model. Every finding carries provenance and a confidence score.

Hard rule: collectors only ever record what they actually observe. If nothing is
retrieved, they return no findings — they never fabricate a value.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Finding:
    key: str                 # e.g. "carrier", "profile_url", "gravatar"
    value: Any
    source: str              # where it came from: "offline:libphonenumber", "https://..."
    confidence: int          # 0-100
    note: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Target:
    kind: str                # "phone" | "email" | "username" | "domain"
    value: str
    findings: list[Finding] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def add(self, key: str, value: Any, source: str, confidence: int, note: str = "") -> None:
        if value is None or value == "" or value == []:
            return            # never record an empty/absent value as a finding
        self.findings.append(Finding(key, value, source, confidence, note))

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "value": self.value,
            "findings": [f.to_dict() for f in self.findings],
            "errors": self.errors,
        }

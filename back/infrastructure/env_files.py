from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable


def parse_env_file_content(content: str) -> dict[str, str]:
    normalized_content = content.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized_content.split("\n")
    if lines:
        lines[0] = lines[0].removeprefix("\ufeff")

    parsed: dict[str, str] = {}
    for raw_line in lines:
        if raw_line == "" or raw_line.startswith("#"):
            continue
        key, separator, value = raw_line.partition("=")
        if separator != "=" or not key:
            raise ValueError(f"Invalid env file line: {raw_line!r}")
        parsed[key] = value
    return parsed


def load_env_files(paths: Iterable[str]) -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in paths:
        file_content = Path(path).read_text(encoding="utf-8")
        merged.update(parse_env_file_content(file_content))
    return merged


def apply_env_files(paths: Iterable[str]) -> dict[str, str]:
    loaded = load_env_files(paths)
    os.environ.update(loaded)
    return loaded


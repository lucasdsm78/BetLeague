from __future__ import annotations

import os
import sys

from infrastructure.env_files import apply_env_files


USAGE = "Usage: python scripts/run_with_env_files.py <env-file> [<env-file> ...] -- <command> [args ...]"


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if "--" not in args:
        raise SystemExit(USAGE)

    separator_index = args.index("--")
    env_files = args[:separator_index]
    command = args[separator_index + 1 :]

    if not env_files or not command:
        raise SystemExit(USAGE)

    apply_env_files(env_files)
    os.execvpe(command[0], command, os.environ)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


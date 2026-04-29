from __future__ import annotations

import os
import shutil
import sys

from infrastructure.env_files import apply_env_files


USAGE = "Usage: python scripts/run_with_env_files.py <env-file> [<env-file> ...] -- <command> [args ...]"


def resolve_command_executable(command: list[str]) -> str:
    program = command[0]
    if os.path.sep in program or (os.path.altsep and os.path.altsep in program):
        return program

    resolved = shutil.which(program, path=os.environ.get("PATH"))
    if resolved is None:
        raise SystemExit(f"Command not found: {program}")
    return resolved


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if "--" not in args:
        raise SystemExit(USAGE)

    separator_index = args.index("--")
    env_files = args[:separator_index]
    command = args[separator_index + 1 :]

    if not env_files or not command:
        raise SystemExit(USAGE)

    executable = resolve_command_executable(command)
    apply_env_files(env_files)
    os.execve(executable, command, os.environ)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())



"""Local operator commands. Pairing codes are written to a private file, never stdout."""

import argparse
from contextlib import suppress
from pathlib import Path

from app.auth import issue_pairing_code
from app.config import Settings


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    pair = commands.add_parser("pairing-code")
    pair.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    output: Path = arguments.output
    if not output.is_absolute():
        parser.error("--output must be an absolute local private file path")
    output.parent.mkdir(parents=True, exist_ok=True)
    # Refuse to overwrite an existing code without an explicit new output file.
    with output.open("x", encoding="utf-8") as handle:
        handle.write(issue_pairing_code(Settings()))
    with suppress(OSError):
        output.chmod(0o600)
    print("One-use pairing code written to the selected local file; expires in 10 minutes.")


if __name__ == "__main__":
    main()

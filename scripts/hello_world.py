"""Hello world demo with runtime info."""

from __future__ import annotations

import argparse
import platform
from datetime import datetime, timezone


def main() -> None:
	parser = argparse.ArgumentParser(description="Hello world demo")
	parser.add_argument("--name", default="world", help="Name to greet")
	parser.add_argument("--repeat", type=int, default=1, help="Repeat count")
	args = parser.parse_args()

	utc_now = datetime.now(timezone.utc).isoformat()
	for _ in range(max(1, args.repeat)):
		print(f"Hello, {args.name}!")
	print(f"UTC time: {utc_now}")
	print(f"Python: {platform.python_version()}")


if __name__ == "__main__":
	main()

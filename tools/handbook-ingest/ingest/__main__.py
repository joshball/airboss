"""Entry point so `python -m ingest` works without needing a console script."""

from .cli import main

if __name__ == "__main__":
    main()

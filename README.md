# Hutnik w Górę

An interactive web experience built for the SpaceShield 2026 Hackathon.

## Prerequisites

- [Python 3](https://www.python.org/downloads/) must be installed and available in your PATH.
- [Git](https://git-scm.com/downloads) for cloning the repository.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/igorterechowicz/spaceshield-2026-hackathon.git
cd spaceshield-2026-hackathon
```

### 2. Start the server

The project includes a local server that opens the page automatically in your browser and shuts down when you close the tab.

**Windows** — double-click `start.bat`, or run in a terminal:
```bat
start.bat
```

**Linux / macOS** — run in a terminal:
```bash
chmod +x start.sh
./start.sh
```

The page will open at `http://localhost:8080`. The server stops automatically when you close the browser tab.

## Notes

- No npm, no build step — just Python and a browser.
- If port `8080` is already in use, stop the conflicting process or edit the `PORT` variable at the top of `server.py`.

#!/bin/bash
cd "$(dirname "$0")"

if command -v python3 &>/dev/null; then
    python3 server.py
elif command -v python &>/dev/null; then
    python server.py
else
    echo "Python is not installed. Please install it from https://www.python.org/downloads/"
    exit 1
fi

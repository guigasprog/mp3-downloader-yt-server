#!/usr/bin/env bash
# exit on error
set -o errexit

npm install

# Instala o FFmpeg e o Python (necessário para o pip)
apt-get update && apt-get install -y ffmpeg python3-pip

# Instala o yt-dlp usando o pip do Python
pip install --upgrade yt-dlp
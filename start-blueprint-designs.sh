#!/bin/bash
# Build and launch Markyn as a desktop app (no dev server / hosting required)

cd "$(dirname "$0")"
npm run electron

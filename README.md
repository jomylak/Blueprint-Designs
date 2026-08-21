# Markyn

**[Live demo](https://markyn.vercel.app)**

A desktop tool for taking off material quantities from blueprint PDFs and generating cost estimates.

Upload a PDF blueprint, calibrate the scale against a known real-world distance, trace out regions (rooms/areas) on each page, assign a material and price per square foot to each region, and get a live cost estimate with a CSV export.

## Tech stack

- Vite + React + TypeScript
- shadcn/ui (Radix primitives) + Tailwind CSS
- react-pdf / pdf.js for blueprint rendering
- Electron (via Electron Forge) for the desktop app shell

## Development

```sh
npm install
npm run dev
```

This starts the Vite dev server at http://localhost:8080.

## Running as a desktop app

```sh
npm run electron
```

This builds the app and launches it in Electron, loading the build output directly from disk (no dev server / hosting required).

## Packaging a distributable

```sh
npm run make
```

Uses Electron Forge to produce installers/packages for the current platform (see `forge.config.js`).

## Project data

Projects (including the uploaded PDF) are saved to the browser's/Electron's local storage. You can also export a project to a `.json` file and re-import it later from the header controls.

## Cloud sync (optional)

Signing in unlocks "Save to Cloud" and a Cloud Projects list under the Projects tab, backed by a
Flask REST API + Postgres (see `backend/`). This is entirely optional - the local save/export
flow above works fully without an account.

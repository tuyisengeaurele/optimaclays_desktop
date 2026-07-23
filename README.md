# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 1 of 6: Electron shell scaffold. Boots a window and proves the build/package pipeline works. No business logic yet.

## Development

    npm install
    npm run dev

## Build

    npm run build        # typecheck + compile main/preload/renderer
    npm run build:win     # build + package a Windows installer into release/

## Testing

    npm run test:e2e

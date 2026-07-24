# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 5 of 6: splash screen and polish. The app now shows a splash window
with the company logo while the main window loads, closing the moment
it's ready. The sidebar has a tighter, more native look with a refined
active-page indicator and a small pinned-shortcuts row so people can keep
their most-used pages one click away. Swept the codebase for AI-tell
writing patterns per the project's standing style rule. Verified with the
full Playwright suite against the real packaged app.

## Development

    npm install
    npm run dev

## Build

    npm run build        # typecheck + compile main/preload/renderer
    npm run build:win     # build + package a Windows installer into release/

## Testing

    npm run test:e2e

## Database

    cp .env.example .env   # first time only
    npm run db:migrate     # apply schema to prisma/dev.db
    npm run db:seed        # create the admin account
    npm run test:db        # verify schema + seed with real queries
    npm run db:studio      # browse the database

Default admin login: `admin@optimaclays.rw` / `Admin@1234`

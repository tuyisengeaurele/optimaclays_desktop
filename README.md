# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 3 of 6: IPC backend. All 24 resource domains ported from the source
web app's Express controllers to IPC handlers with session-based auth.
Verified via manual smoke tests through the DevTools console. No renderer
UI wiring yet — the app still shows the Phase 1 placeholder screen.

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

# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 6 of 6: security hardening and packaging. Done. Every window
(main, splash, print) runs with contextIsolation, sandbox, and
nodeIntegration locked down, and the app never opens or navigates to
anything external. The audit log redacts password fields instead of
storing them in the clear. A fresh install now creates its own SQLite
database, applies the bundled migrations, and seeds the admin account
on first launch, since there's no prisma CLI available outside a dev
checkout. The app has a real icon generated from the company logo, and
`npm run build:win` produces a working NSIS installer that's been
smoke-tested end to end on a clean machine profile: install, first
launch, log in, done.

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

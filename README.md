# Optima Clays Desktop

Desktop business management system for Optima Clays Ltd, built with Electron, React, TypeScript, and SQLite. This replaces the web version of the same system with a standalone Windows app.

Design spec: `docs/superpowers/specs/2026-07-23-electron-desktop-migration-design.md`

## Status

Phase 2 of 6: SQLite schema. Prisma schema, migrations, and admin seed exist
and are verified standalone. No IPC/UI wiring to the app yet.

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

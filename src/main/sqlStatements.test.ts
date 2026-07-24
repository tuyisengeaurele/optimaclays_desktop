import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { splitSqlStatements } from './sqlStatements'

test('strips a leading comment line without discarding the statement behind it', () => {
  const statements = splitSqlStatements('-- CreateTable\nCREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);')
  assert.equal(statements.length, 1)
  assert.match(statements[0], /^CREATE TABLE "User"/)
})

test('splits multiple statements, each with its own comment', () => {
  const sql = [
    '-- CreateTable',
    'CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY);',
    '',
    '-- CreateIndex',
    'CREATE UNIQUE INDEX "A_id_key" ON "A"("id");'
  ].join('\n')
  const statements = splitSqlStatements(sql)
  assert.equal(statements.length, 2)
  assert.match(statements[0], /^CREATE TABLE "A"/)
  assert.match(statements[1], /^CREATE UNIQUE INDEX "A_id_key"/)
})

test('drops empty and comment-only fragments', () => {
  assert.deepEqual(splitSqlStatements('-- just a comment\n\n'), [])
})

test('the real init migration splits into CREATE statements covering the User table', () => {
  const migrationPath = join(__dirname, '../../prisma/migrations/20260723180220_init/migration.sql')
  const statements = splitSqlStatements(readFileSync(migrationPath, 'utf-8'))
  assert.ok(statements.length > 10, `expected many statements from the init migration, got ${statements.length}`)
  for (const statement of statements) {
    assert.ok(/^CREATE/i.test(statement), `statement should start with CREATE: ${statement.slice(0, 40)}`)
  }
  assert.ok(statements.some((s) => s.includes('CREATE TABLE "User"')), 'should include the User table statement')
})

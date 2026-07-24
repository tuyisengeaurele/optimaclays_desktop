// Splits a Prisma-generated migration.sql file into individually executable
// statements. Each statement is preceded by a `-- Comment` line with no
// semicolon separating it from the SQL that follows, so comment lines are
// stripped before splitting on `;` - splitting first and then checking
// whether a whole (now multi-line) chunk starts with `--` would discard the
// real SQL bundled in behind the comment.
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')

  return withoutComments
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

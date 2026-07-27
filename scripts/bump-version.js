// Runs as postbuild:win, so it only fires once electron-builder has actually
// produced an installer - a failed build never touches the version.
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const parts = pkg.version.split('.').map(Number)
parts[2] = (parts[2] || 0) + 1
pkg.version = parts.join('.')

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`Bumped version to ${pkg.version} after a successful build.`)

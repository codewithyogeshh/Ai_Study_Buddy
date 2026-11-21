// Bundles the API entry point into api/index.js, the single file Vercel
// deploys as a Node function. Vercel transpiles TypeScript per file and would
// otherwise leave the app's extensionless ESM imports unresolvable at runtime.
// `pg` stays external: it is a CommonJS package and is loaded from
// node_modules at runtime (Vercel traces it from package.json).
import { build } from 'esbuild'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outfile = fileURLToPath(new URL('../api/index.js', import.meta.url))

rmSync(outfile, { force: true })

await build({
  entryPoints: [fileURLToPath(new URL('../server/vercel.ts', import.meta.url))],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['pg'],
  banner: {
    // esbuild's ESM output cannot `require()`; pg is CommonJS and needs it.
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  logLevel: 'warning',
})

console.log(`built ${outfile.replace(root, '')}`)

// Produces Vercel's Build Output API layout (.vercel/output) so the API can be
// a single pre-bundled function. Vercel transpiles TypeScript file by file and
// would leave the app's extensionless ESM imports unresolvable at runtime, and
// files inside /api are collected before the build runs — building the whole
// output here avoids both problems.
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = fileURLToPath(new URL('../.vercel/output', import.meta.url))
const fn = `${out}/functions/api.func`

rmSync(out, { recursive: true, force: true })
mkdirSync(fn, { recursive: true })

await build({
  entryPoints: [fileURLToPath(new URL('../server/vercel.ts', import.meta.url))],
  outfile: `${fn}/index.js`,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  logLevel: 'warning',
})

// The project is "type": "module"; the function is CommonJS (pg is CJS only).
writeFileSync(`${fn}/package.json`, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)

writeFileSync(
  `${fn}/.vc-config.json`,
  `${JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  )}\n`,
)

// The built SPA (vite build + scripts/postbuild.mjs) is served as static files.
cpSync(fileURLToPath(new URL('../dist', import.meta.url)), `${out}/static`, { recursive: true })

writeFileSync(
  `${out}/config.json`,
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/(.*))?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/.*', dest: '/index.html' },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(`built ${out.replace(root, '')}`)

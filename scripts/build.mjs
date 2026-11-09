// 浏览器半边打包：client.js → dist/client.js（单文件 CJS + ModuleLoader 包装）。
// colorSystemMapping.json 被 esbuild 内联进 bundle（291 色号映射，浏览器本地查色号用）。
import { build } from 'esbuild'
import { readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

// 注册包装：只吞掉「duplicate factory registration」，不阻断重新注册。
// 背景：宿主在「预加载 + 延迟加载」或 disable→enable 时会重新执行同一个 bundle，
// client-modules 会以 duplicate factory registration 抛错并让整个 web boot 失败。
// 注意：不能用 `if (!loadedIds.has(id))` 直接跳过——插件被 disable→enable 后宿主会
// 重新执行 bundle，跳过会让面板永久回不来（实测踩过，左侧图标消失）。
// 这里改为：调用 load，若只是重复注册就忽略；若 factory 已被 invalidate，load 会正常
// 重新注册，面板恢复。
const banner =
  `(function () {\n` +
  `  const register = (entry) => {\n` +
  `    try { window.__ModuleLoader__.load(entry) }\n` +
  `    catch (err) { if (!err || !/duplicate factory registration/.test(String((err && err.message) || err))) throw err }\n` +
  `  };\n` +
  `  register({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {\n` +
  ` const module = { exports: {} }; const exports = module.exports;`
const footer = ' return module.exports; } }); })();\n'

const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

function checkBundle() {
  const code = readFileSync(join(root, 'dist/client.js'), 'utf8')
  if (!code.startsWith('(function () {') || !code.includes('duplicate factory registration')) {
    throw new Error('client 产物缺少重复注册容错包装（disable→enable 后需要能重新注册）')
  }
  const requires = [...code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
  const bad = requires.filter((spec) => !CLIENT_EXTERNALS.includes(spec))
  if (bad.length) throw new Error(`client 产物引用了白名单外的模块：${bad.join(', ')}`)
  if (/\bimport\s*\(/.test(code)) throw new Error('client 产物包含动态 import()，禁止')
  const files = readdirSync(join(root, 'dist'))
  if (files.length !== 1 || files[0] !== 'client.js') {
    throw new Error(`dist/ 应只含 client.js，实际：${files.join(', ')}`)
  }
}

rmSync(join(root, 'dist'), { recursive: true, force: true })
await build({
  entryPoints: [join(root, 'client.js')],
  outfile: join(root, 'dist/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  external: CLIENT_EXTERNALS,
  banner: { js: banner },
  footer: { js: footer },
  minify: !process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
  logLevel: 'info',
})

if (!process.argv.includes('--watch')) {
  checkBundle()
  const size = (Buffer.byteLength(readFileSync(join(root, 'dist/client.js'))) / 1024).toFixed(1)
  console.log(`[build] dist/client.js ${size} KB  (id=${PLUGIN_ID})`)
} else {
  console.log(`[build] watching client.js → dist/client.js (id=${PLUGIN_ID})`)
}

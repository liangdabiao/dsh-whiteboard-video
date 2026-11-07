// 离线自检：快照完整 + provider 全链路 + 分镜示例 + 面板 API。零 dsh 依赖零网络。
// 运行：node scripts/selftest.mjs
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILL_DIR = join(ROOT, 'skills', 'whiteboard-teacher-video')
const { createSkillProvider, listStoryboards } = await import('../lib/skills.js')
const { registerApi } = await import('../lib/api.js')

let failed = 0
const step = async (name, fn) => {
  process.stdout.write(`- ${name} … `)
  try {
    await fn()
    console.log('ok')
  } catch (err) {
    failed++
    console.log('失败')
    console.error(`  ${err.message}`)
  }
}

await step('快照完整（SKILL.md/references/scripts/assets/vendor/LICENSE）', () => {
  for (const p of ['SKILL.md', 'LICENSE', 'package.json', 'vendor/ATTRIBUTION.md']) {
    if (!existsSync(join(SKILL_DIR, p))) throw new Error(`缺 ${p}`)
  }
  for (const dir of ['references', 'scripts', 'assets']) {
    if (!existsSync(join(SKILL_DIR, dir))) throw new Error(`缺 ${dir}/`)
  }
  if (existsSync(join(SKILL_DIR, 'engine'))) throw new Error('engine/ 不应进快照（setup 拉取）')
})

const provider = createSkillProvider([join(ROOT, 'skills')])
let candidates
await step('provider：技能注册 + 正文完整 + addendum 三条', async () => {
  candidates = await provider.list()
  if (candidates.length !== 1) throw new Error(`候选 ${candidates.length} ≠ 1`)
  const skill = await provider.get(candidates[0])
  if (skill.content.length < 3000) throw new Error('正文过短')
  for (const pattern of ['cp -r', '读不到插件安装目录', 'setup\\.py']) {
    if (!new RegExp(pattern).test(skill.content)) throw new Error(`addendum 缺 ${pattern}`)
  }
})

await step('分镜示例 ≥ 10', () => {
  const list = listStoryboards([SKILL_DIR])
  if (list.length < 10) throw new Error(`只有 ${list.length} 个`)
})

await step('面板 API 健康与分镜接口（内存 ctx 模拟）', async () => {
  const captured = []
  const fakeRes = { writeHead() { return this }, end(chunk) { captured.push(String(chunk)) } }
  const fakeCtx = {
    get: () => ({ requestRejection: () => false }),
    webServer: { register: async ({ handler }) => { globalThis.__wbHandler = handler } },
  }
  await registerApi(fakeCtx, { skillDirs: [SKILL_DIR] })
  const handler = globalThis.__wbHandler
  if (!handler) throw new Error('路由未注册')
  await handler({ method: 'GET', url: '/whiteboard-video/api/health', headers: {} }, fakeRes)
  if (!JSON.parse(captured.at(-1)).ok) throw new Error('health 语义错误')
  captured.length = 0
  await handler({ method: 'GET', url: '/whiteboard-video/api/storyboards', headers: {} }, fakeRes)
  if (JSON.parse(captured.at(-1)).storyboards.length < 10) throw new Error('分镜接口数量不对')
})

await step('AGPL 引擎声明存在且引擎不入快照', () => {
  const attr = readFileSync(join(SKILL_DIR, 'vendor', 'ATTRIBUTION.md'), 'utf8')
  if (!attr.includes('AGPL')) throw new Error('ATTRIBUTION 应声明引擎 AGPL')
  if (!attr.includes('sitor-ai/frametell')) throw new Error('ATTRIBUTION 应含引擎上游')
})

await step('SKILL.md 引擎契约与人类闸门保留', async () => {
  const skill = await provider.get(candidates[0])
  if (!skill.content.includes('时间的纯函数')) throw new Error('缺引擎契约')
  if (!skill.content.includes('确认')) throw new Error('缺人类闸门')
})

if (failed > 0) {
  console.error(`\n自检失败 ${failed} 项`)
  process.exit(1)
}
console.log('\n全部通过。')

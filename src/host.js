// 手绘讲解视频 · Host 半边（最小宿主：技能提供方 + 面板数据面）。
// 渲染管线由模型在工作区副本里用 bash 驱动（python scripts/ft*.py），Host 不参与重活。
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSkillProvider, listStoryboards } from '../lib/skills.js'
import { registerApi } from '../lib/api.js'

export const name = 'whiteboard-video' // = cordis.patch.yml 的 id

export const inject = ['skills', 'webServer', 'connection']

export function apply(ctx, config) {
  const skillDirs = [join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'whiteboard-teacher-video')]

  ctx.effect(() => ctx.skills.registerProvider(() => createSkillProvider(skillDirs)), `${name}: skills`)
  ctx.effect(() => registerApi(ctx, { skillDirs }), `${name}: routes`)
}

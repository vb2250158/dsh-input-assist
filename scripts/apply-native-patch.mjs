/** 检查配套宿主补丁；已应用时退出，冲突时不写入。 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = process.argv[2]
if (!root) throw new Error('用法：node scripts/apply-native-patch.mjs <宿主目录>')
const patch = fileURLToPath(new URL('../patches/native-completion-0.2.1.patch', import.meta.url))
const run = args => spawnSync('git', ['-C', resolve(root), 'apply', ...args, patch], { encoding: 'utf8' })
if (run(['--reverse', '--check']).status === 0) {
  console.log('补齐接口已经应用')
} else {
  const check = run(['--check'])
  if (check.status !== 0) throw new Error('补丁与当前宿主不兼容；未写入文件。\n' + check.stderr)
  const result = run([])
  if (result.status !== 0) throw new Error(result.stderr)
  if (run(['--reverse', '--check']).status !== 0) throw new Error('补丁写入后核验失败')
  console.log('补齐接口已应用；按 README 构建会话和会话界面包')
}

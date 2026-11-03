import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { toSvg } from './model'

const PANE = {
  plugin: 'gridtalk', component: 'Pane', requestId: 'gridtalk',
  props: { title: 'Gridtalk', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const SAMPLE = {
  nodes: [
    { id: 1, kind: 'area', label: '社内', col: 3, row: 0, w: 6, h: 2 },
    { id: 2, kind: 'box', label: '攻撃者', col: 0, row: 0, color: 'red' },
    { id: 3, kind: 'box', label: 'VPN装置', col: 3, row: 0 },
    { id: 4, kind: 'box', label: '関所', col: 6, row: 0 },
    { id: 5, kind: 'text', label: 'メモ', col: 0, row: 3 },
  ],
  edges: [
    { from: 2, to: 4, arrow: 'both', label: '通る' },
    { from: 3, to: 4, block: true },
  ],
}

test('SVG に、箱・囲み・文字・線・両向きの矢印・遮断×・線のラベルが描かれる', () => {
  const svg = toSvg(SAMPLE as never)
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg.trim().endsWith('</svg>')).toBe(true)
  for (const word of ['攻撃者', 'VPN装置', '関所', '社内', 'メモ', '通る']) expect(svg).toContain(`>${word}</text>`)
  // 赤い箱
  expect(svg).toContain('stroke="#d85a30"')
  // 遮断×（赤い2本の斜線）
  expect(svg).toContain('stroke="#e24b4a"')
  // 両向きの線には矢印が2つ、矢印なしの線には0
  const heads = (arrow: string) => toSvg({ nodes: [{ id: 1, kind: 'box', label: 'A', col: 0, row: 0 }, { id: 2, kind: 'box', label: 'B', col: 4, row: 0 }],
    edges: [{ from: 1, to: 2, arrow }] } as never).match(/Z" fill=/g)?.length ?? 0
  expect(heads('both')).toBe(2)
  expect(heads('one')).toBe(1)
  expect(heads('none')).toBe(0)
})

test('ラベルの記号は XML としてエスケープされ、タグにならない', () => {
  const svg = toSvg({ nodes: [
    { id: 1, kind: 'box', label: '<script>alert(1)</script>', col: 0, row: 0 },
    { id: 2, kind: 'area', label: 'a"b\'c&d', col: 3, row: 0, w: 4, h: 2 },
  ], edges: [] } as never)
  expect(svg).not.toContain('<script')
  expect(svg).toContain('&lt;scri')
  expect(svg).toContain('a&quot;b&apos;c&amp;d')
  // XML に入れられない文字は捨てる（😀 のような正しい組の文字は残す）
  const odd = toSvg({ nodes: [{ id: 1, kind: 'box', label: 'A\uD800B\uFFFE😀', col: 0, row: 0 }], edges: [] } as never)
  expect(odd).toContain('>AB😀</text>')
})

// 書き出しのテストで使う、まわりの仕組みの代わり。png: PNG の変換が成功するか
function stubs(on: Parameters<TestBody>[1], png: boolean) {
  const files: Record<string, string> = {}, runs: string[][] = [], toasts: string[] = []
  on('command.register', () => ({ value: { command: 'gridtalk' } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__gridtalk__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.toast', (_, e) => { toasts.push((e as unknown as { text: string }).text); return { value: undefined } })
  on('store.keys', () => ({ value: [] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.root', () => ({ value: '/proj' }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.write', (_, e) => { const w = e as unknown as { path: string; text: string }; files[w.path] = w.text; return { value: undefined } })
  on('process.run', (_, e) => {
    runs.push([...(e as unknown as { argv: string[] }).argv])
    return { value: { exitCode: png ? 0 : 1, stdout: '', stderr: png ? '' : 'osascript: not found' } } as never
  })
  return { files, runs, toasts }
}

test('EXPORT と export_board で、gridtalk-exports/ に board.svg と board.png を上書きで保存する', async ($, on) => {
  const { files, runs, toasts } = stubs(on, true)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  // 空の図は書き出さない
  const empty = await $.tool.call({ tool: 'mcp__gridtalk__export_board' } as never)
  expect(JSON.stringify(empty)).toContain('empty')
  expect(Object.keys(files).length).toBe(0)
  expect(runs.length).toBe(0)

  await $.tool.call({ tool: 'mcp__gridtalk__write_board', ...SAMPLE } as never)
  const r = JSON.stringify(await $.tool.call({ tool: 'mcp__gridtalk__export_board' } as never))
  expect(Object.keys(files)).toEqual(['/proj/gridtalk-exports/board.svg'])
  expect(files['/proj/gridtalk-exports/board.svg']).toContain('>攻撃者</text>')
  // PNG は、決まった引数だけで Mac の変換を呼んで作る（シェルを通さない）
  expect(runs.length).toBe(1)
  const argv = runs[0]!
  expect(argv.slice(0, 3)).toEqual(['osascript', '-l', 'JavaScript'])
  expect(argv[3]!.endsWith('/scripts/svg-to-png.js')).toBe(true)
  expect(argv.slice(4)).toEqual(['/proj/gridtalk-exports/board.svg', '/proj/gridtalk-exports/board.png', '1.5'])
  expect(r).toContain('PNG: /proj/gridtalk-exports/board.png')
  expect(r).toContain('SVG: /proj/gridtalk-exports/board.svg')
  expect(r).toContain('send the PNG')

  // パネルの EXPORT ボタンでも同じ名前に上書きし、短いお知らせが出る
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'export' } as never)
  expect(Object.keys(files)).toEqual(['/proj/gridtalk-exports/board.svg'])
  expect(runs.length).toBe(2)
  expect(toasts).toContain('Saved gridtalk-exports/board.png and board.svg')
  await ui.unmount()
})

test('PNG が作れないとき（Mac 以外など）は、SVG だけ保存してそう伝える', async ($, on) => {
  const { files, toasts } = stubs(on, false)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__gridtalk__write_board', ...SAMPLE } as never)
  const r = JSON.stringify(await $.tool.call({ tool: 'mcp__gridtalk__export_board' } as never))
  expect(Object.keys(files)).toEqual(['/proj/gridtalk-exports/board.svg'])
  expect(r).toContain('could not be made')
  expect(r).not.toContain('PNG: ')
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'export' } as never)
  expect(toasts).toContain('Saved gridtalk-exports/board.svg')
  await ui.unmount()
})

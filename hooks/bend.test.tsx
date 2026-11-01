import { expect, test } from 'claude-code/testing'
import { ZOOMS, sanitize, scene } from './model'
test('出てすぐ曲がる線も、縦と横の棒だけでつながる', () => {
  // 下の箱の左から出て、すぐ上へ曲がり、上の箱の左に入る形
  const b = sanitize({ nodes: [{ id: 1, kind: 'box', label: 'A', col: 0, row: 0 }, { id: 2, kind: 'box', label: 'B', col: 1, row: 3 }], edges: [{ from: 2, to: 1 }] })
  const sc = scene(b, null, 'x', true, ZOOMS[0])
  for (const g of sc.segs) expect(g.len).toBeGreaterThan(0)
  // 棒の端どうしがつながっている: 縦の棒と横の棒が、同じマスで出会う
  const hs = sc.segs.filter(g => g.dir === 'h'), vs = sc.segs.filter(g => g.dir === 'v')
  for (const v of vs) expect(hs.some(h => (h.t === v.t || h.t === v.t + v.len - 1) && v.l >= h.l && v.l < h.l + h.len)).toBe(true)
})

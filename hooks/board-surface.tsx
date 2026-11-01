// パネルの中の方眼の図。描くことと、ドラッグを受け取ることだけをする
// （図の変更はすべて post で hooks 側に頼む）
import type { ClientSurface } from 'claude-code'

import type { Scene, SceneBox } from './model'

// viewW: パネルの見える幅（文字マス）。図が広いときは、空いたところのドラッグで横に動かす
// ox: 横にずらした量（hooks 側が覚えている）。ドラッグ中だけ、この部品の中で先に動かして見せる
type Props = { scene: Scene; uw: number; uh: number; accent: string; grid: boolean; viewW: number; ox: number; size: 'footnote' | 'body' | 'heading'; linking: number }
// gc, gr: つかんだ位置が、図形の左上から何マス目か
type Drag = { mode: 'node' | 'area' | 'resize'; id: number; gc: number; gr: number; x: number; y: number }
type Pan = { sx: number; ox0: number }
type Local = { drag?: Drag; pan?: Pan; ox?: number }  // ox: ドラッグ中だけ使う

const within = (b: SceneBox, x: number, y: number) => x >= b.l && y >= b.t && x < b.l + b.w && y < b.t + b.h

// model.ts の rectFor と同じ決まり（この部品からは model.ts の関数を呼ばない）
function rectFor(kind: string, col: number, row: number, w: number, h: number, uw: number, uh: number) {
  if (kind === 'area') return { l: col * uw, t: row * uh, w: w * uw, h: h * uh }
  const bh = Math.max(3, h * uh - 2)
  return { l: col * uw + 1, t: row * uh + Math.floor((h * uh - bh) / 2), w: w * uw - 2, h: bh }
}

export default function Board(p: Props, s: ClientSurface<Local>) {
  const { Box, Text } = s.elements
  const { scene, uw, uh, accent } = p
  const st = s.state ?? {}
  const viewW = Math.min(p.viewW, scene.width)
  const maxOx = Math.max(0, scene.width - viewW)
  const ox = Math.min(st.pan && st.ox !== undefined ? st.ox : p.ox, maxOx)
  const all = [...scene.nodes, ...scene.areas]

  const nodeAt = (x: number, y: number) => scene.nodes.find(n => within(n, x, y))
  const edgeAt = (x: number, y: number) => {
    const c = scene.edgeCells
    for (let i = 0; i < c.length; i += 3) if (c[i] === x && c[i + 1] === y) return c[i + 2]
    return undefined
  }
  // 囲みは枠と名前の行でつかむ（中の空いたところは、ふつうの空きマス扱い）
  const areaAt = (x: number, y: number) => [...scene.areas].reverse().find(a =>
    within(a, x, y) && (x === a.l || x === a.l + a.w - 1 || y === a.t || y === a.t + a.h - 1))
  // 選んでいる図形の右下の ◢ が、大きさを変える取っ手
  const isHandle = (b: SceneBox, x: number, y: number) => b.sel && x >= b.l + b.w - 2 && x <= b.l + b.w - 1 && y === b.t + b.h - 1
  const cellOf = (x: number, y: number) => [Math.floor(x / uw), Math.floor(y / uh)]

  // 毎回つけ直す（最新の図で当たり判定するため。後からの呼び出しが前のものを置き換える）
  s.onPointer(ev => {
    const cur = s.state ?? {}
    // 画面の位置を、図の上の位置に直す（横に動かしたぶんを足す）
    const curOx = Math.min(cur.pan && cur.ox !== undefined ? cur.ox : p.ox, maxOx)
    const x = ev.x + curOx, y = ev.y
    const [c, r] = cellOf(x, y)
    if (ev.type === 'down' && p.linking !== 0) {
      // 「線を引く」の途中: クリックした図形（囲みは中のどこでも）を選ぶだけで、ドラッグはしない
      const t = nodeAt(x, y) ?? [...scene.areas].reverse().find(a => within(a, x, y))
      s.post(t ? { op: 'pick', id: t.id } : { op: 'linkCancel' })
      return
    }
    if (ev.type === 'down') {
      const sel = all.find(b => isHandle(b, x, y))
      if (sel) { s.setState({ ...cur, drag: { mode: 'resize', id: sel.id, gc: 0, gr: 0, x, y } }); return }
      const n = nodeAt(x, y)
      if (n) {
        s.post({ op: 'select', kind: 'node', id: n.id })
        s.setState({ ...cur, drag: { mode: 'node', id: n.id, gc: c - n.col, gr: r - n.row, x, y } })
        return
      }
      const e = edgeAt(x, y)
      if (e !== undefined) { s.post({ op: 'select', kind: 'edge', id: e }); return }
      const a = areaAt(x, y)
      if (a) {
        s.post({ op: 'select', kind: 'node', id: a.id })
        s.setState({ ...cur, drag: { mode: 'area', id: a.id, gc: c - a.col, gr: r - a.row, x, y } })
        return
      }
      s.post({ op: 'deselect' })
      if (maxOx > 0) s.setState({ ...cur, pan: { sx: ev.x, ox0: curOx }, ox: curOx })
      return
    }
    if (cur.pan) {
      if (ev.type === 'move') s.setState({ ...cur, ox: Math.max(0, Math.min(maxOx, cur.pan.ox0 - (ev.x - cur.pan.sx))) })
      else if (ev.type === 'up') { s.post({ op: 'pan', ox: cur.ox ?? curOx }); s.setState({ ...cur, pan: undefined }) }
      return
    }
    const d = cur.drag
    if (!d) return
    if (ev.type === 'move') { if (d.x !== x || d.y !== y) s.setState({ ...cur, drag: { ...d, x, y } }); return }
    if (ev.type !== 'up') return
    s.setState({ ...cur, drag: undefined })
    const me = all.find(b => b.id === d.id)
    if (!me) return
    if (d.mode === 'resize') {
      const w = Math.max(1, c - me.col + 1), h = Math.max(1, r - me.row + 1)
      if (w !== me.cw || h !== me.ch) s.post({ op: 'resize', id: d.id, w, h })
      return
    }
    const t = d.mode === 'node' ? nodeAt(x, y) : undefined
    if (t && t.id !== d.id) { s.post({ op: 'connect', from: d.id, to: t.id }); return }
    const col = c - d.gc, row = r - d.gr
    if (col !== me.col || row !== me.row) s.post({ op: d.mode === 'area' ? 'moveArea' : 'move', id: d.id, col, row })
  })

  const kids: unknown[] = []
  const pct = (v: number, of: number) => `${Math.max(0, Math.round((v / of) * 100))}%`
  const hbar = (l: number, t: number, len: number, a: number, b: number, color: string, key?: string) =>
    <Box key={key} position="absolute" left={l} top={t} width={len} height={1} flexDirection="row" alignItems="center">
      <Box width={pct(a, len)} /><Box width={pct(len - a - b, len)} height="10%" backgroundColor={color} />
    </Box>
  const vbar = (l: number, t: number, len: number, a: number, b: number, color: string, key?: string) =>
    <Box key={key} position="absolute" left={l} top={t} width={1} height={len} flexDirection="column" alignItems="center">
      <Box height={pct(a, len)} /><Box height={pct(len - a - b, len)} width="22%" backgroundColor={color} />
    </Box>

  // 方眼の罫線（うすく）。マスの境目は文字マスの境目なので、棒は境目をまたぐ半マスずつで描く
  if (p.grid) {
    const faint = '#88878018'
    for (let i = 1; i < scene.cols; i++) kids.push(<Box position="absolute" left={i * uw - 1} top={0} width={2} height={scene.height} flexDirection="row" justifyContent="center"><Box width="10%" height="100%" backgroundColor={faint} /></Box>)
    for (let j = 1; j < scene.rows; j++) kids.push(<Box position="absolute" left={0} top={j * uh - 1} width={scene.width} height={2} flexDirection="column" justifyContent="center"><Box height="5%" width="100%" backgroundColor={faint} /></Box>)
  }
  for (const a of scene.areas) {
    kids.push(<Box position="absolute" left={a.l} top={a.t} width={a.w} height={a.h} borderStyle={a.sel ? 'bold' : 'single'} borderColor={a.color} />)
    kids.push(<Box position="absolute" left={a.l + 2} top={a.t}><Text color={a.color} mono> {a.label} </Text></Box>)
  }
  // 実線: 1マス幅の入れ物の中に、割合（%）で細い棒を置く（位置は整数のマスでしか指定できないため）
  for (const g of scene.segs) kids.push(g.dir === 'h' ? hbar(g.l, g.t, g.len, g.a, g.b, g.color) : vbar(g.l, g.t, g.len, g.a, g.b, g.color))
  for (const r of scene.runs) kids.push(<Box position="absolute" left={r.l} top={r.t}><Text color={r.color} mono>{r.text}</Text></Box>)
  // 遮断×: 線の文字より大きく、拡大の段階に合わせて大きくする。線のマスを真ん中にした 5×3 マスの中に置く
  const blockSize = p.size === 'footnote' ? 'heading' : 'title'
  for (const k of scene.blocks) kids.push(
    <Box position="absolute" left={Math.max(0, k.x - 2)} top={Math.max(0, k.y - 1)} width={5} height={3} justifyContent="center" alignItems="center">
      <Text color="#e24b4a" bold size={blockSize}>✕</Text>
    </Box>)
  for (const n of scene.nodes) {
    const border = n.kind === 'text' ? (n.sel ? 'dashed' : undefined) : n.sel ? 'bold' : 'single'
    kids.push(
      <Box position="absolute" left={n.l} top={n.t} width={n.w} height={n.h} borderStyle={border} borderColor={n.color} justifyContent="center" alignItems="center">
        <Text color={n.kind === 'text' ? undefined : n.color} bold={n.kind !== 'text'} size={p.size} wrap="truncate-end">{n.label}</Text>
      </Box>,
    )
  }
  for (const b of all) if (b.sel) kids.push(<Box position="absolute" left={b.l + b.w - 2} top={b.t + b.h - 1}><Text color={accent} mono>◢</Text></Box>)

  // 操作中だけ、図の上の1行に短い英語の一言を出す（ふだんの使い方は HELP で開く）
  // ドラッグ中の行き先は、点線の枠で見せる
  let hint = ''
  if (p.linking === -1) hint = 'LINE: click the start shape  ·  click empty space to cancel'
  if (p.linking > 0) {
    hint = 'LINE: click the end shape  ·  click empty space to cancel'
    const f = all.find(b => b.id === p.linking)
    if (f) kids.push(<Box position="absolute" left={f.l} top={f.t} width={f.w} height={f.h} borderStyle="double" borderColor={accent} />)
  }
  const d = st.drag
  if (d) {
    const me = all.find(b => b.id === d.id)
    const [c, r] = cellOf(d.x, d.y)
    const t = d.mode === 'node' ? nodeAt(d.x, d.y) : undefined
    if (t && t.id !== d.id) {
      hint = `Drop to connect to "${t.label}"`
      kids.push(<Box position="absolute" left={t.l} top={t.t} width={t.w} height={t.h} borderStyle="double" borderColor={accent} />)
    } else if (me) {
      const g = d.mode === 'resize'
        ? rectFor(me.kind, me.col, me.row, Math.max(1, c - me.col + 1), Math.max(1, r - me.row + 1), uw, uh)
        : rectFor(me.kind, Math.max(0, c - d.gc), Math.max(0, r - d.gr), me.cw, me.ch, uw, uh)
      hint = d.mode === 'resize' ? 'Drop to resize' : d.mode === 'area' ? 'Drop to move the group with its contents' : 'Drop to move  ·  drop on another shape to connect'
      kids.push(<Box position="absolute" left={g.l} top={g.t} width={g.w} height={g.h} borderStyle="dashed" borderColor={accent} />)
    }
  }

  return (
    <Box flexDirection="column">
      {/* 一言の行は、空のときも1行ぶん取っておく（出たり消えたりで図が上下にずれないように） */}
      <Text color={accent} wrap="truncate-end">{hint || ' '}</Text>
      <Box position="relative" width={viewW} height={scene.height} overflow="hidden">
        <Box position="absolute" left={-ox} top={0} width={scene.width} height={scene.height}>{kids}</Box>
      </Box>
    </Box>
  )
}

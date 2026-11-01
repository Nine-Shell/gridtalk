// Gridtalk（図板）が保存するデータの型

export type Kind = 'box' | 'circle' | 'area' | 'text'
export type Shade = 'gray' | 'red' | 'green' | 'blue' | 'purple'
export type Arrow = 'one' | 'both' | 'none'

// 図形。位置は方眼（列 col・行 row、0から）。左上から w×h マスの範囲を占める
export type ZNode = {
  id: number
  kind: Kind
  label: string
  col: number
  row: number
  w?: number
  h?: number
  color?: Shade
}

// 線。from → to の向き。arrow で双方向・矢印なしにできる
export type ZEdge = {
  id: number
  from: number
  to: number
  label?: string
  arrow?: Arrow
  block?: boolean
  color?: Shade
}

export type Board = { nodes: ZNode[]; edges: ZEdge[] }

export type Selection = { kind: 'node' | 'edge'; id: number } | null

declare module 'claude-code' {
  interface PluginState {
    gridtalk: {
      board: Shaped<Board>
      history: Shaped<Board[]>
      selected: Selection
      // 拡大の段階（0がいちばん小さい）
      zoom: number
      // 横にずらした量（文字マス）
      ox: number
      // 図を前の会話から引き継いだか（Claude に出どころを伝えるため）
      inherited: boolean
      // 「線を引く」の途中: 0=していない、-1=始まりを待っている、それ以外=選んだ始まりの図形の id
      linking: number
      // HELP（使い方）を開いているか
      help: boolean
    }
  }
}

# Gridtalk

A grid board that sits beside the chat in **Claude Code Desktop**, for talking with Claude in pictures instead of words.

Some ideas are hard to put into words. With Gridtalk you place a few boxes on a square grid, group them, and connect them with lines. Claude reads your diagram as short, exact text (not a screenshot), and can redraw the board to show you its own idea. You can undo anything Claude draws.

## Design ideas

1. **Say it without the right words.** Only "what", "where" and "connected to what". No fonts, line widths or pixel nudging.
2. **Few choices, many combinations.** Three shapes (box, group, text), one kind of line (arrow direction and a block mark), five colors, and a square grid so nothing is ever slightly off.
3. **Cheaper and clearer than an image for Claude.** Positions are grid cells such as "columns 2–3, row 1", so the text Claude reads is short and arrow directions can't be misread.

## Install

Gridtalk is a Claude Code mod (a hooks plugin). At the prompt of a Claude Code terminal session:

```
/plugin install gridtalk --marketplace Nine-Shell/gridtalk
```

From a shell:

```
claude plugin install gridtalk --marketplace Nine-Shell/gridtalk
```

In the desktop app: click **+** next to the prompt box → **Plugins** → **Add marketplace** with `Nine-Shell/gridtalk` → **Add plugin**.

Gridtalk draws its panel in the **Claude Code Desktop** app. In a terminal it falls back to plain lines and text.

## Use

- Run `/gridtalk` to open the panel beside the chat.
- **BOX**, **GROUP**, **TEXT** add shapes. Shapes snap to the square grid.
- Drag a shape to move it. Drop it on another shape to connect them, or press **LINE** and click two shapes.
- Select a shape and drag the ◢ corner to resize it. Drag a group by its border to move it with everything inside.
- Select a shape or line to rename it (✎ then ✓), change its **COLOR**, or **DELETE** it. Lines also have **ARROW** (→ ↔ ―) and **BLOCK** (a large ✕ on the line).
- ⊖ ⊕ zoom (3 steps). ◀ ▶ or dragging empty space scrolls sideways. **HELP** shows a short guide. **UNDO** steps back.
- Tell Claude "look at the board". Claude reads it with `read_board`, and may answer by redrawing with `write_board`.
- **EXPORT** saves the diagram as an SVG image in `gridtalk-exports/` of your project. Use it to see the diagram where the panel does not show, such as on your phone through Remote Control: ask Claude to "send me the board as an image".

## Tools for Claude

| Tool | What it does |
|---|---|
| `read_board` | Reads the diagram as text: shapes row by row with their grid ranges, groups and what they contain, and lines |
| `write_board` | Redraws the whole board and shows it (the user can undo) |
| `show_board` | Opens the panel |
| `export_board` | Saves the diagram as an SVG image (same layout as the panel) in `gridtalk-exports/` and returns the file path |

## Storage and safety

- Your diagram is saved on this computer, in Claude Code's own settings folder, **separately for each project**. It is not part of this repository, so sharing the mod never shares your diagrams. Don't put secrets on the board.
- Text on the board reaches Claude as clearly marked **data, not instructions**. Line breaks, control characters and brackets in names are cleaned, so a name can't pose as part of the board's structure.
- Exported images are new files each time (`board-<date>-<time>.svg`); Gridtalk never overwrites or deletes them. Names in the image are escaped, so a name can't add markup to the SVG.
- Up to 60 shapes and 80 lines, so the panel and Claude Code stay responsive.

## Development

- `hooks/model.ts` — the diagram data, the text Claude reads, line routing, the SVG image (no UI)
- `hooks/board-surface.tsx` — draws the grid and handles dragging inside the panel
- `hooks/register.tsx` — panel, buttons, the `/gridtalk` command, Claude's tools
- `types/index.d.ts` — the stored data types

Run the tests with `claude plugin test <folder>` and check the plugin with `claude plugin validate <folder>`.

## License

MIT

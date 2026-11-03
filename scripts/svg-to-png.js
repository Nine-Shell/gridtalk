// SVG を PNG にする（Mac のみ）。Gridtalk の書き出しが osascript -l JavaScript で呼ぶ
// 使い方: osascript -l JavaScript svg-to-png.js <SVGのパス> <PNGのパス> <倍率>
// Mac に入っている AppKit の画像の仕組みで描く（追加のソフトは要らない）
ObjC.import('AppKit')

// PNG の長い辺の上限（大きな図でも、スマホで開ける大きさに収める）
const MAX_SIDE = 6000

function run(argv) {
  const [src, dst, scaleArg] = argv
  if (!src || !dst) throw new Error('usage: svg-to-png.js <svg> <png> [scale]')
  const img = $.NSImage.alloc.initWithContentsOfFile(src)
  if (img.isNil()) throw new Error('cannot read the SVG')
  const size = img.size
  if (!(size.width > 0 && size.height > 0)) throw new Error('the SVG has no size')
  const scale = Math.min(Number(scaleArg) || 1, MAX_SIDE / Math.max(size.width, size.height))
  const w = Math.round(size.width * scale), h = Math.round(size.height * scale)
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    null, w, h, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0)
  // 描く大きさは SVG のまま、画素だけ倍率ぶん細かくする
  rep.size = size
  $.NSGraphicsContext.saveGraphicsState
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep))
  img.drawInRectFromRectOperationFraction($.NSMakeRect(0, 0, size.width, size.height), $.NSZeroRect, $.NSCompositingOperationCopy, 1)
  $.NSGraphicsContext.restoreGraphicsState
  const data = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $())
  if (!data.writeToFileAtomically(dst, true)) throw new Error('cannot write the PNG')
  return `${w}x${h}`
}

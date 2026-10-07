const DEFAULT_MIN_THUMB_SIZE = 32

type ThumbGeometryInput = {
  viewport: number
  content: number
  scroll: number
  minSize?: number
}

type ThumbGeometry = {
  visible: boolean
  size: number
  offset: number
}

type ScrollForOffsetInput = {
  viewport: number
  content: number
  offset: number
  minSize?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Proportional to the visible fraction, never below minSize and never longer
// than the track itself (a viewport shorter than minSize).
function getThumbSize(viewport: number, content: number, minSize: number) {
  const proportional = Math.round((viewport / content) * viewport)

  return clamp(proportional, Math.min(minSize, viewport), viewport)
}

// Size and position of a scrollbar thumb along a track as long as the viewport.
function getThumbGeometry({
  viewport,
  content,
  scroll,
  minSize = DEFAULT_MIN_THUMB_SIZE,
}: ThumbGeometryInput): ThumbGeometry {
  const maxScroll = content - viewport

  if (maxScroll <= 0 || viewport <= 0) {
    return { visible: false, size: 0, offset: 0 }
  }

  const size = getThumbSize(viewport, content, minSize)
  const progress = clamp(scroll / maxScroll, 0, 1)

  return {
    visible: true,
    size,
    offset: Math.round(progress * (viewport - size)),
  }
}

// Inverse of getThumbGeometry: the scroll position that puts the thumb at `offset`.
function getScrollForThumbOffset({
  viewport,
  content,
  offset,
  minSize = DEFAULT_MIN_THUMB_SIZE,
}: ScrollForOffsetInput): number {
  const maxScroll = content - viewport

  if (maxScroll <= 0 || viewport <= 0) {
    return 0
  }

  const travel = viewport - getThumbSize(viewport, content, minSize)

  return travel > 0 ? clamp((offset / travel) * maxScroll, 0, maxScroll) : 0
}

export { getScrollForThumbOffset, getThumbGeometry }
export type { ThumbGeometry }

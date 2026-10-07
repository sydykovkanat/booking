"use client"

import * as React from "react"

import { getScrollForThumbOffset, getThumbGeometry } from "@/lib/scrollbar"

const IDLE_HIDE_MS = 1000

type DragState = {
  pointerId: number
  startY: number
  startOffset: number
}

function getPageMetrics() {
  const root = document.documentElement

  return {
    viewport: root.clientHeight,
    content: root.scrollHeight,
    scroll: window.scrollY,
  }
}

function scrollToThumbOffset(offset: number) {
  const { viewport, content } = getPageMetrics()

  window.scrollTo(0, getScrollForThumbOffset({ viewport, content, offset }))
}

// Overlay scrollbar for the page. The native one is hidden in globals.css so
// it never takes layout space (and scroll locks leave no gutter). The thumb
// floats over the content, shows while scrolling or when hovered, and can be
// dragged. Only the thumb takes pointer events, so the rest of the 12px edge
// strip never eats clicks or text selection. Keyboard, wheel and touch
// scrolling stay native.
function PageScrollbar() {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const thumbRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return

    let frame = 0
    let hideTimeout = 0
    let drag: DragState | null = null

    function render() {
      frame = 0
      if (!track || !thumb) return

      const geometry = getThumbGeometry(getPageMetrics())

      track.hidden = !geometry.visible
      thumb.style.height = `${geometry.size}px`
      thumb.style.transform = `translateY(${geometry.offset}px)`
    }

    function scheduleRender() {
      if (!frame) frame = requestAnimationFrame(render)
    }

    function hideLater() {
      window.clearTimeout(hideTimeout)
      hideTimeout = window.setTimeout(() => {
        if (!drag) delete track?.dataset.active
      }, IDLE_HIDE_MS)
    }

    function onScroll() {
      scheduleRender()
      if (track) track.dataset.active = ""
      hideLater()
    }

    function onPointerDown(event: PointerEvent) {
      if (!track || !thumb || event.button !== 0) return

      event.preventDefault()

      const { offset } = getThumbGeometry(getPageMetrics())

      thumb.setPointerCapture(event.pointerId)
      track.dataset.dragging = ""
      drag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: offset,
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return

      scrollToThumbOffset(drag.startOffset + event.clientY - drag.startY)
    }

    // Covers pointerup, pointercancel and capture lost any other way (the
    // element re-rendered, the window lost focus mid-drag, ...).
    function endDrag(event: PointerEvent) {
      if (!drag || event.pointerId !== drag.pointerId) return

      drag = null
      delete track?.dataset.dragging
      hideLater()
    }

    // body for content changes, documentElement for viewport-driven reflow.
    const resizeObserver = new ResizeObserver(scheduleRender)
    resizeObserver.observe(document.body)
    resizeObserver.observe(document.documentElement)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", scheduleRender)
    thumb.addEventListener("pointerdown", onPointerDown)
    thumb.addEventListener("pointermove", onPointerMove)
    thumb.addEventListener("pointerup", endDrag)
    thumb.addEventListener("pointercancel", endDrag)
    thumb.addEventListener("lostpointercapture", endDrag)
    render()

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(hideTimeout)
      resizeObserver.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", scheduleRender)
      thumb.removeEventListener("pointerdown", onPointerDown)
      thumb.removeEventListener("pointermove", onPointerMove)
      thumb.removeEventListener("pointerup", endDrag)
      thumb.removeEventListener("pointercancel", endDrag)
      thumb.removeEventListener("lostpointercapture", endDrag)
    }
  }, [])

  return (
    <div
      ref={trackRef}
      aria-hidden
      hidden
      data-slot="page-scrollbar"
      className="group/scrollbar pointer-events-none fixed inset-y-0 right-0 z-scrollbar w-3 touch-none"
    >
      <div
        ref={thumbRef}
        className="pointer-events-auto absolute top-0 right-0 w-full px-[3px] py-0.5 opacity-0 transition-opacity duration-slow group-hover/scrollbar:opacity-100 group-hover/scrollbar:duration-fast group-data-dragging/scrollbar:opacity-100 group-data-active/scrollbar:opacity-100 group-data-active/scrollbar:duration-fast pointer-coarse:pointer-events-none"
      >
        <div className="h-full w-full rounded-full bg-(--scrollbar) transition-colors duration-fast group-hover/scrollbar:bg-foreground/35 group-data-dragging/scrollbar:bg-foreground/50" />
      </div>
    </div>
  )
}

export { PageScrollbar }

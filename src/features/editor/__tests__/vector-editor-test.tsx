// @vitest-environment jsdom
import type { FaceMark } from '@bible-strong/avatar-core'
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'

import { readPath } from '@/features/editor/pathGeometry'
import { pathBounds } from '@/features/editor/vectorGeometry'
import type { Editor } from '@/features/editor/useEditor'
import { VectorEditor } from '@/features/editor/VectorEditor'
import { StudioLanguageProvider } from '@/i18n'

const editor = { t: (text: string) => text } as unknown as Editor

/** jsdom lays nothing out: the artboard is read as 1 pixel wide, so a pointer at x/108 is there. */
const at = (x: number, y: number) => ({ clientX: (x + 4) / 108, clientY: (y + 4) / 108 })

function Harness({ start, onMarks }: { start: FaceMark[]; onMarks: (marks: FaceMark[]) => void }) {
  const [marks, setMarks] = useState(start)
  const [selected, setSelected] = useState<number | null>(0)
  return (
    <VectorEditor
      editor={editor}
      marks={marks}
      selected={selected}
      onSelect={setSelected}
      onChange={next => {
        setMarks(next)
        onMarks(next)
      }}
      label="Plan de travail"
    />
  )
}

const setup = (start: FaceMark[]) => {
  const onMarks = vi.fn()
  // Each press comes a second after the last: two presses are a double click only when a test says so.
  let clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1000))
  const view = render(
    <StudioLanguageProvider>
      <Harness start={start} onMarks={onMarks} />
    </StudioLanguageProvider>
  )
  const board = view.container.querySelector('[role="application"]')!
  const last = () => onMarks.mock.lastCall![0] as FaceMark[]
  return { view, board, last, onMarks }
}

const ring: FaceMark = { d: 'M30 50A20 20 0 1 0 70 50A20 20 0 1 0 30 50Z' }

afterEach(() => vi.restoreAllMocks())

describe('the vector editor', () => {
  it('picks a mark whole, with a box to scale it, and moves it by dragging', () => {
    const { view, board, last } = setup([ring])
    expect(view.container.querySelector('[data-transform-box]')).toBeTruthy()
    const markPath = view.container.querySelector('[data-role="mark"]')!
    fireEvent.pointerDown(markPath, { pointerId: 1, ...at(50, 50) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(60, 50) })
    fireEvent.pointerUp(board, { pointerId: 1, ...at(60, 50) })
    expect(pathBounds(readPath(last()[0].d))!.x).toBeCloseTo(40, 0)
    // The handle at the bottom right doubles it from its top left.
    const corner = view.container.querySelector('[data-handle="se"]')!
    fireEvent.pointerDown(corner, { pointerId: 1, ...at(80, 70) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(120, 110) })
    fireEvent.pointerUp(board, { pointerId: 1, ...at(120, 110) })
    const bounds = pathBounds(readPath(last()[0].d))!
    expect(bounds.width).toBeCloseTo(80, 0)
    expect(bounds.height).toBeCloseTo(80, 0)
  })

  it('opens a mark to its points with a double click, and closes them with Escape', () => {
    const { view, board } = setup([ring])
    let clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => (clock += 100))
    const markPath = view.container.querySelector('[data-role="mark"]')!
    fireEvent.pointerDown(markPath, { pointerId: 1, ...at(50, 50) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    fireEvent.pointerDown(markPath, { pointerId: 1, ...at(50, 50) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    expect(board.getAttribute('data-mode')).toBe('points')
    expect(view.container.querySelectorAll('[data-role="point"]')).toHaveLength(4)
    fireEvent.keyDown(board, { key: 'Escape' })
    expect(board.getAttribute('data-mode')).toBe('object')
  })

  it('takes out picked points, makes them corners, and bends a segment pulled by its middle', () => {
    const { view, board, last } = setup([{ d: 'M10 50L50 20L90 50' }])
    fireEvent.keyDown(board, { key: 'Enter' })
    const points = () => [...view.container.querySelectorAll('[data-role="point"]')]
    fireEvent.pointerDown(points()[1], { pointerId: 1, ...at(50, 20) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    fireEvent.click(view.getByRole('button', { name: 'Symétrique' }))
    const curved = readPath(last()[0].d)[0].points[1]
    expect(Math.hypot(...curved.out)).toBeGreaterThan(0)
    fireEvent.keyDown(board, { key: 'Delete' })
    expect(readPath(last()[0].d)[0].points).toHaveLength(2)
    // The straight line left, pulled by its middle, bends through where it is pulled.
    fireEvent.pointerDown(board, { pointerId: 1, ...at(50, 50) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(50, 30) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    const [start, end] = readPath(last()[0].d)[0].points
    const middleY =
      (start.at[1] + 3 * (start.at[1] + start.out[1]) + 3 * (end.at[1] + end.in[1]) + end.at[1]) / 8
    expect(middleY).toBeCloseTo(30, 0)
  })

  it('duplicates and deletes the mark picked from the keyboard', () => {
    const { board, last } = setup([ring])
    fireEvent.keyDown(board, { key: 'd', metaKey: true })
    expect(last()).toHaveLength(2)
    expect(pathBounds(readPath(last()[1].d))!.x).toBeCloseTo(34, 0)
    fireEvent.keyDown(board, { key: 'Delete' })
    expect(last()).toHaveLength(1)
  })

  it('draws shapes by dragging, or a shape of its own size with a click', () => {
    const { board, last } = setup([ring])
    fireEvent.keyDown(board, { key: 'r' })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(10, 10) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(30, 25) })
    fireEvent.pointerUp(board, { pointerId: 1, ...at(30, 25) })
    expect(last()).toHaveLength(2)
    expect(last()[1].d).toBe('M10 25L10 10L30 10L30 25Z')
    fireEvent.keyDown(board, { key: 's' })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(70, 30) })
    fireEvent.pointerUp(board, { pointerId: 1, ...at(70, 30) })
    expect(readPath(last()[2].d)[0].points).toHaveLength(10)
    expect(board.getAttribute('data-tool')).toBe('select')
  })

  it('draws with the pen, a dragged point a curve on both of its sides, and closes on the first point', () => {
    const { board, last } = setup([ring])
    fireEvent.keyDown(board, { key: 'p' })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(10, 90) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(30, 70) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(40, 70) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(50, 90) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    fireEvent.pointerDown(board, { pointerId: 1, ...at(10, 90) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    expect(last()[1].d).toBe('M10 90C10 90 20 70 30 70C40 70 50 90 50 90Z')
  })

  it('draws a curve through the points it is given, with the curve tool', () => {
    const { board, last } = setup([ring])
    fireEvent.keyDown(board, { key: 'c' })
    for (const [x, y] of [
      [20, 60],
      [50, 30],
      [80, 60],
    ]) {
      fireEvent.pointerDown(board, { pointerId: 1, ...at(x, y) })
      fireEvent.pointerUp(board, { pointerId: 1 })
    }
    fireEvent.keyDown(board, { key: 'Enter' })
    const points = readPath(last()[1].d)[0].points
    expect(points.map(point => point.at)).toEqual([
      [20, 60],
      [50, 30],
      [80, 60],
    ])
    expect(Math.hypot(...points[1].out)).toBeGreaterThan(1)
  })

  it('picks several marks, with Shift or a box, and duplicates and deletes them together', () => {
    const { view, board, last } = setup([
      ring,
      { d: 'M10 10H20V20H10Z' },
      { d: 'M80 80H90V90H80Z' },
    ])
    const markPaths = () => [...view.container.querySelectorAll('[data-role="mark"]')]
    fireEvent.pointerDown(markPaths()[1], { pointerId: 1, shiftKey: true, ...at(15, 15) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    expect(view.container.querySelectorAll('[data-picked-mark]')).toHaveLength(2)
    fireEvent.keyDown(board, { key: 'd', metaKey: true })
    expect(last()).toHaveLength(5)
    fireEvent.keyDown(board, { key: 'Delete' })
    expect(last()).toHaveLength(3)
    // A box drawn on nothing picks the marks it touches.
    fireEvent.pointerDown(board, { pointerId: 1, ...at(5, 5) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(95, 95) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    expect(view.container.querySelectorAll('[data-picked-mark]')).toHaveLength(3)
  })

  it('keeps the turn of its box, and scales a turned mark along its own sides', () => {
    const { view, board, last } = setup([{ d: 'M20 45H80V55H20Z' }])
    const knob = view.container.querySelector('[data-role="rotate"]')!
    // The knob is above the middle of the top: turned a quarter clockwise, it points to the right.
    fireEvent.pointerDown(knob, { pointerId: 1, ...at(50, 30) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(70, 50) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    expect(view.container.querySelector('[data-transform-box]')!.getAttribute('data-angle')).toBe(
      '90'
    )
    const turned = pathBounds(readPath(last()[0].d))!
    expect(turned.width).toBeCloseTo(10, 0)
    expect(turned.height).toBeCloseTo(60, 0)
    // Its own right side is now its bottom: pulled further down, it grows longer, not wider.
    const side = view.container.querySelector('[data-handle="e"]')!
    fireEvent.pointerDown(side, { pointerId: 1, ...at(50, 80) })
    fireEvent.pointerMove(board, { pointerId: 1, ...at(50, 90) })
    fireEvent.pointerUp(board, { pointerId: 1 })
    const longer = pathBounds(readPath(last()[0].d))!
    expect(longer.width).toBeCloseTo(10, 0)
    expect(longer.height).toBeCloseTo(70, 0)
  })

  it('lines a mark moved up with the middle of the artboard, and shows the guide', () => {
    const { view, board, last } = setup([{ d: 'M10 10H20V20H10Z' }])
    const markPath = view.container.querySelector('[data-role="mark"]')!
    fireEvent.pointerDown(markPath, { pointerId: 1, ...at(15, 15) })
    // Moved so that its middle comes to 49 across: it lands on 50.
    fireEvent.pointerMove(board, { pointerId: 1, ...at(49, 15) })
    expect(view.container.querySelectorAll('[data-guide]').length).toBeGreaterThan(0)
    fireEvent.pointerUp(board, { pointerId: 1 })
    const moved = pathBounds(readPath(last()[0].d))!
    expect(moved.x + moved.width / 2).toBeCloseTo(50, 6)
    expect(view.container.querySelectorAll('[data-guide]')).toHaveLength(0)
  })

  it('zooms with two fingers moved apart', () => {
    const { view, board } = setup([ring])
    const zoom = () =>
      view.container.querySelector('[data-vector-editor] .tabular-nums')!.textContent
    expect(zoom()).toBe('100 %')
    fireEvent.pointerDown(board, { pointerId: 1, pointerType: 'touch', clientX: 0.4, clientY: 0.5 })
    fireEvent.pointerDown(board, { pointerId: 2, pointerType: 'touch', clientX: 0.6, clientY: 0.5 })
    fireEvent.pointerMove(board, { pointerId: 2, pointerType: 'touch', clientX: 0.8, clientY: 0.5 })
    fireEvent.pointerUp(board, { pointerId: 2, pointerType: 'touch' })
    fireEvent.pointerUp(board, { pointerId: 1, pointerType: 'touch' })
    expect(zoom()).toBe('200 %')
  })
})

// @vitest-environment jsdom
import type { FaceMark } from '@bible-strong/avatar-core'
import { fireEvent, render } from '@testing-library/react'
import { vi } from 'vitest'

import { readPath } from '@/features/editor/pathGeometry'
import { PointEditor } from '@/features/editor/PointEditor'
import type { Editor } from '@/features/editor/useEditor'

const editor = { t: (text: string) => text } as unknown as Editor

const setup = (marks: FaceMark[]) => {
  const onChange = vi.fn()
  const onSelect = vi.fn()
  const view = render(
    <PointEditor
      editor={editor}
      marks={marks}
      selected={0}
      onSelect={onSelect}
      onChange={onChange}
      label="Plan de travail"
    />
  )
  const points = () => [...view.container.querySelectorAll('[data-role="point"]')]
  return {
    view,
    onChange,
    onSelect,
    points,
    board: view.container.querySelector('[role="application"]')!,
  }
}

describe('the point editor', () => {
  it('shows the points of the mark picked, corners square and curves round', () => {
    const { points } = setup([
      { d: 'M22 50A28 28 0 1 0 78 50A28 28 0 1 0 22 50Z' },
      { d: 'M0 0L10 10' },
    ])
    expect(points()).toHaveLength(4)
    expect(points().every(point => point.getAttribute('rx') !== '0')).toBe(true)
    const square = setup([{ d: 'M10 10H90V90H10Z' }])
    expect(square.points().every(point => point.getAttribute('rx') === '0')).toBe(true)
  })

  it('takes out the point picked, and makes a corner a curve on a double click', () => {
    const { points, board, onChange, view } = setup([{ d: 'M10 50L50 20L90 50' }])
    fireEvent.pointerDown(points()[1], { pointerId: 1 })
    expect(view.container.querySelector('[data-picked-point="0-1"]')).toBeTruthy()
    fireEvent.keyDown(board, { key: 'Delete' })
    expect(readPath(onChange.mock.lastCall![0][0].d)[0].points).toHaveLength(2)

    fireEvent.doubleClick(points()[1])
    const curved = readPath(onChange.mock.lastCall![0][0].d)[0].points[1]
    expect(Math.hypot(...curved.out)).toBeGreaterThan(0)
    expect(curved.out[1]).toBeCloseTo(0, 6)
  })

  it('makes the picked point a corner, smooth or symmetric from its buttons', () => {
    const { points, onChange, view } = setup([{ d: 'M10 50L50 20L90 50' }])
    fireEvent.pointerDown(points()[1], { pointerId: 1 })
    fireEvent.click(view.getByRole('button', { name: 'Symétrique' }))
    const point = readPath(onChange.mock.lastCall![0][0].d)[0].points[1]
    expect(Math.hypot(...point.in)).toBeCloseTo(Math.hypot(...point.out), 2)
    fireEvent.click(view.getByRole('button', { name: 'Fermer le tracé' }))
    expect(onChange.mock.lastCall![0][0].d).toMatch(/Z$/)
  })
})

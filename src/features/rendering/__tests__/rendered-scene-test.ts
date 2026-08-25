import { createBodyNode } from '@/features/avatar/body'
import { renderAvatar, poseFromExpression } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import {
  createRenderedColors,
  createRenderedScene,
  findBodyNodePath,
  paintRenderedColors,
  paintRenderedScene,
} from '@/features/rendering/renderedScene'
import { surfacePresets } from '@/features/avatar/surfaces'
import { loadStudioDocument } from '@/features/studio/studioDocument'
import defaultStudioDocument from '@/features/studio/defaultStudioDocument.json'
import type { BodyNode } from '@/features/avatar/body'
import type { Expression } from '@/features/avatar/geometry'
import type { SurfaceConfig } from '@/features/avatar/surfaces'

const pathBounds = (value: string) => {
  const numbers = (value.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const x = numbers.filter((_, index) => index % 2 === 0)
  const y = numbers.filter((_, index) => index % 2 === 1)
  return {
    left: Math.min(...x),
    top: Math.min(...y),
    right: Math.max(...x),
    bottom: Math.max(...y),
  }
}

const overlap = (first: ReturnType<typeof pathBounds>, second: ReturnType<typeof pathBounds>) => ({
  x: Math.min(first.right, second.right) - Math.max(first.left, second.left),
  y: Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
})

describe('rendered avatar scene', () => {
  it('keeps layer identity and hit mapping behind the scene seam', () => {
    const node = createBodyNode('sphere', 0)
    const first = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    const scene = createRenderedScene(first)
    const rotated = renderAvatar(
      poseFromExpression({ ...defaultExpression, headY: 35 }),
      surfacePresets.sphere,
      1,
      { bodyNodes: [node] }
    )

    paintRenderedScene(scene, rotated)

    expect(findBodyNodePath(scene, 'primary')).toBe(scene.headPath)
    expect(findBodyNodePath(scene, node.id)).not.toBeNull()
    expect(scene.headPath.get()).toBe(rotated.headPath)
  })

  it('updates animated colors without replacing their motion values', () => {
    const colors = createRenderedColors({ body: '#5b7fe5', eyes: '#111316' })
    const body = colors.body
    const eyes = colors.eyes

    paintRenderedColors(colors, { body: '#c53b47', eyes: '#ffffff' })

    expect(colors.body).toBe(body)
    expect(colors.eyes).toBe(eyes)
    expect(colors.body.get()).toBe('#c53b47')
    expect(colors.eyes.get()).toBe('#ffffff')
  })

  it('keeps Cloudee accessories behind the eyes at expression position 05', () => {
    const avatar = defaultStudioDocument.library.avatars.find(item => item.name === 'Cloudee')!
    const expression = defaultStudioDocument.expressions[5] as Expression

    const geometry = renderAvatar(
      poseFromExpression(expression),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )

    expect(geometry.frontNodeIds).toEqual([])

    const clearlyTurned = renderAvatar(
      poseFromExpression({ ...expression, headY: -35 }),
      avatar.body.primary as SurfaceConfig,
      1,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )
    expect(clearlyTurned.frontNodeIds).toContain('shape-d4b4e8ad-8625-488d-920c-c497da226f9f')

    const forcedFront = renderAvatar(
      poseFromExpression({ ...expression, headY: 35 }),
      avatar.body.primary as SurfaceConfig,
      1,
      {
        bodyNodes: [{ ...(avatar.body.nodes[0] as unknown as BodyNode), layer: 'front' }],
      }
    )
    expect(forcedFront.frontNodeIds).toContain(avatar.body.nodes[0].id)
  })

  it('moves dog ears between front and back with head depth', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(item => item.id === 'oneworks-dog')!
    const detachedEars: string[] = []

    let splitDepthExpressions = 0

    studio.expressions.forEach(expression => {
      const geometry = renderAvatar(
        poseFromExpression(expression as Expression),
        avatar.body.primary as SurfaceConfig,
        1,
        { bodyNodes: avatar.body.nodes as BodyNode[] }
      )
      const head = pathBounds(geometry.headPath)

      const earIds = ['dog-ear-left', 'dog-ear-right'] as const
      if (
        geometry.frontNodeIds.some(id => earIds.includes(id as (typeof earIds)[number])) &&
        geometry.backNodeIds.some(id => earIds.includes(id as (typeof earIds)[number]))
      ) {
        splitDepthExpressions += 1
      }
      earIds.forEach(nodeId => {
        const frontIndex = geometry.frontNodeIds.indexOf(nodeId)
        const backIndex = geometry.backNodeIds.indexOf(nodeId)
        expect(Number(frontIndex >= 0) + Number(backIndex >= 0)).toBe(1)
        const earPath =
          frontIndex >= 0 ? geometry.frontPaths[frontIndex] : geometry.backPaths[backIndex]
        const ear = pathBounds(earPath)
        const headOverlap = overlap(ear, head)
        if (headOverlap.x <= 0 || headOverlap.y <= 0) {
          detachedEars.push(
            `${expression.id}/${nodeId} (${headOverlap.x.toFixed(2)} × ${headOverlap.y.toFixed(2)})`
          )
        }
      })
    })

    expect(splitDepthExpressions).toBeGreaterThan(0)
    expect(detachedEars, 'detached dog ears').toEqual([])
  })

  it('keeps bear ears attached behind the head across expressions', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(item => item.id === 'oneworks-bear')!
    const detachedEars: string[] = []

    studio.expressions.forEach(expression => {
      const geometry = renderAvatar(
        poseFromExpression(expression as Expression),
        avatar.body.primary as SurfaceConfig,
        1,
        { bodyNodes: avatar.body.nodes as BodyNode[] }
      )
      const head = pathBounds(geometry.headPath)

      ;(['bear-ear-left', 'bear-ear-right'] as const).forEach(nodeId => {
        const earIndex = geometry.backNodeIds.indexOf(nodeId)
        expect(earIndex).toBeGreaterThanOrEqual(0)
        const ear = pathBounds(geometry.backPaths[earIndex])
        const headOverlap = overlap(ear, head)
        if (headOverlap.x <= 0 || headOverlap.y <= 0) {
          detachedEars.push(expression.id + '/' + nodeId)
        }
      })
    })

    expect(detachedEars, 'detached bear ears').toEqual([])
  })
})

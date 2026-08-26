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
import { renderAvatarByStyle } from '@/features/rendering/avatarAccessories'
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
  it('keeps the Memento headset in front of the face and moves it with the pose', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(item => item.id === 'primitive-ghost-headset')!
    const neutralPose = poseFromExpression(defaultExpression)
    const turnedPose = poseFromExpression({ ...defaultExpression, headY: 22, headZ: -8 })
    const neutral = renderAvatarByStyle(
      neutralPose,
      avatar.body.primary as SurfaceConfig,
      1,
      avatar.renderStyle,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )
    const turned = renderAvatarByStyle(
      turnedPose,
      avatar.body.primary as SurfaceConfig,
      1,
      avatar.renderStyle,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )

    expect(avatar.name).toBe('Memento · Headset')
    expect(avatar.colors).toEqual({ body: '#ff9d45', eyes: '#222222' })
    expect(avatar.renderStyle).toEqual({
      type: 'vector',
      filled: true,
      artwork: 'frame-172-colored',
    })
    expect(neutral.headsetFrontIndex).toBe(neutral.frontPaths.length - 1)
    expect(neutral.headsetOcclusion).toEqual({
      side: 'left',
      strokeWidth: 2.4,
      width: 1145,
      height: 936,
      splitX: 573.13,
    })
    expect(neutral.headPath).toContain('M575.918 77.6582')
    expect(neutral.frontPaths.at(-1)).toContain('M573.131 2.5')
    expect(neutral.pathTransforms?.front.at(-1)).not.toBe(turned.pathTransforms?.front.at(-1))

    const scene = createRenderedScene(neutral)
    paintRenderedScene(scene, turned)
    expect(scene.headsetFrontIndex.current).toBe(turned.frontPaths.length - 1)
    expect(scene.headsetOcclusion.current).toEqual(neutral.headsetOcclusion)
    expect(scene.frontTransforms[scene.headsetFrontIndex.current!].get()).toBe(
      turned.pathTransforms?.front.at(-1)
    )
  })

  it('keeps the stroked Frame 172 skin as a separate animated avatar', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(
      item => item.id === 'primitive-ghost-headset-stroke'
    )!
    const geometry = renderAvatarByStyle(
      poseFromExpression(defaultExpression),
      avatar.body.primary as SurfaceConfig,
      1,
      avatar.renderStyle,
      { bodyNodes: avatar.body.nodes as BodyNode[] }
    )

    expect(avatar.name).toBe('Memento · Stroke')
    expect(avatar.colors).toEqual({ body: '#ff9d45', eyes: '#ff9d45' })
    expect(avatar.renderStyle).toEqual({
      type: 'vector',
      strokeOnly: true,
      artwork: 'frame-172-stroke',
    })
    expect(geometry.headsetFrontIndex).toBe(geometry.frontPaths.length - 1)
    expect(geometry.headsetOcclusion).toEqual({
      side: 'left',
      strokeWidth: 1,
      width: 1145,
      height: 1079,
      splitX: 572.13,
    })
    expect(geometry.headPath).toContain('M574.918 77.6582')
    expect(geometry.frontPaths.at(-1)).toContain('M572.131 2.5')
  })

  it('keeps layer identity and hit mapping behind the scene seam', () => {
    const node = createBodyNode('sphere', 0)
    const first = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [node],
    })
    const scene = createRenderedScene(first)
    const initialNodeOrderVersion = scene.nodeOrderVersion.get()
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
    expect(scene.nodeOrderVersion.get()).toBeGreaterThan(initialNodeOrderVersion)

    const stableNodeOrderVersion = scene.nodeOrderVersion.get()
    paintRenderedScene(scene, rotated)
    expect(scene.nodeOrderVersion.get()).toBe(stableNodeOrderVersion)
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

  it('moves a dog ear behind the head only when it strongly overlaps an eye', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(item => item.id === 'oneworks-dog')!
    const detachedEars: string[] = []

    studio.expressions.forEach(expression => {
      const geometry = renderAvatar(
        poseFromExpression(expression as Expression),
        avatar.body.primary as SurfaceConfig,
        1,
        { bodyNodes: avatar.body.nodes as BodyNode[] }
      )
      const head = pathBounds(geometry.headPath)

      const earIds = ['dog-ear-left', 'dog-ear-right'] as const
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

    expect(detachedEars, 'detached dog ears').toEqual([])

    const expressionById = new Map(
      studio.expressions.map(expression => [expression.id, expression])
    )
    const geometryFor = (sequenceId: string) => {
      const sequence = studio.sequences.find(item => item.id === sequenceId)!
      const expression = expressionById.get(sequence.steps[0].expressionId) as Expression
      return renderAvatar(poseFromExpression(expression), avatar.body.primary as SurfaceConfig, 1, {
        bodyNodes: avatar.body.nodes as BodyNode[],
      })
    }

    ;['idle', 'shy', 'proud'].forEach(sequenceId => {
      expect(geometryFor(sequenceId).backNodeIds, sequenceId).toContain('dog-ear-right')
    })
    expect(geometryFor('angry').frontNodeIds).toEqual(
      expect.arrayContaining(['dog-ear-left', 'dog-ear-right'])
    )
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

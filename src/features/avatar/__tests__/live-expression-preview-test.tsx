// @vitest-environment jsdom

import { render } from '@testing-library/react'

import { LiveExpressionPreview } from '@/features/avatar/components/ExpressionWorkspace'
import { poseFromExpression } from '@/features/avatar/geometry'
import { renderAvatarByStyle } from '@/features/rendering/avatarAccessories'
import { createRenderedColors, createRenderedScene } from '@/features/rendering/renderedScene'
import { loadStudioDocument } from '@/features/studio/studioDocument'

it('keeps the headset visible and transformed in a live animation preview', () => {
  const studio = loadStudioDocument({ getItem: () => null })
  const avatar = studio.library.avatars.find(item => item.id === 'primitive-ghost-headset')!
  const expression = studio.expressions.find(item => item.semanticKey === 'front-facing')!
  const geometry = renderAvatarByStyle(
    poseFromExpression(expression),
    avatar.body.primary,
    1,
    avatar.renderStyle,
    { bodyNodes: avatar.body.nodes }
  )
  const scene = createRenderedScene(geometry)

  const view = render(
    <LiveExpressionPreview
      scene={scene}
      colors={createRenderedColors(avatar.colors)}
      baseBodyColor={avatar.colors.body}
      bodyNodes={avatar.body.nodes}
      renderStyle={avatar.renderStyle}
      id="animated-headset"
    />
  )

  const headset = view.container.querySelector('.avatar-headset')
  expect(headset).not.toBeNull()
  expect(headset?.getAttribute('d')).toBe(geometry.frontPaths.at(-1))
  expect(headset?.getAttribute('transform')).toBe(geometry.pathTransforms?.front.at(-1))
})

it('keeps the stroked Frame 172 skin unfilled in a live animation preview', () => {
  const studio = loadStudioDocument({ getItem: () => null })
  const avatar = studio.library.avatars.find(item => item.id === 'primitive-ghost-headset-stroke')!
  const expression = studio.expressions.find(item => item.semanticKey === 'front-facing')!
  const geometry = renderAvatarByStyle(
    poseFromExpression(expression),
    avatar.body.primary,
    1,
    avatar.renderStyle,
    { bodyNodes: avatar.body.nodes }
  )
  const scene = createRenderedScene(geometry)

  const view = render(
    <LiveExpressionPreview
      scene={scene}
      colors={createRenderedColors(avatar.colors)}
      baseBodyColor={avatar.colors.body}
      bodyNodes={avatar.body.nodes}
      renderStyle={avatar.renderStyle}
      id="animated-stroke-headset"
    />
  )

  const bodyPaths = view.container.querySelectorAll<SVGPathElement>('.preview-head')
  const body = bodyPaths.item(0)
  const eyes = view.container.querySelectorAll<SVGPathElement>('.preview-eye')
  const headset = Array.from(bodyPaths).find(
    path => path.getAttribute('d') === geometry.frontPaths.at(-1)
  )!
  expect(body.style.fill).toBe('none')
  expect(Array.from(eyes).every(eye => eye.style.fill === 'none')).toBe(true)
  expect(headset.style.fill).toBe('none')
  expect(headset?.getAttribute('transform')).toBe(geometry.pathTransforms?.front.at(-1))
})

import { poseFromExpression, renderAvatar } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { createRenderedScene, paintRenderedOffset } from '@/features/rendering/renderedScene'
import {
  serializeAvatarSnapshot,
  serializePixelSnapshot,
  snapshotFileName,
} from '@/features/export/snapshotExporter'
import { surfacePresets } from '@/features/avatar/surfaces'
import { renderAvatarByStyle } from '@/features/rendering/avatarAccessories'
import { loadStudioDocument } from '@/features/studio/studioDocument'

describe('avatar snapshot export', () => {
  const geometry = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1)
  const scene = createRenderedScene(geometry)
  const colors = { body: '#5b7fe5', eyes: '#111316' }

  it('exports the currently rendered scene as a transparent SVG', () => {
    paintRenderedOffset(scene, { x: 3, y: -2 })
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'transparent',
      colorFrom: '#ffffff',
      colorTo: '#000000',
      size: 1024,
    })

    expect(svg).toContain('width="1024" height="1024"')
    expect(svg).toContain('transform="translate(3 -2)"')
    expect(svg).toContain(`d="${geometry.headPath}" fill="#5b7fe5"`)
    expect(svg).toContain('fill="#111316"')
    expect(svg).not.toContain('width="300" height="300" fill=')
  })

  it('exports the Memento headset as a transformed translucent front layer', () => {
    const studio = loadStudioDocument({ getItem: () => null })
    const avatar = studio.library.avatars.find(item => item.id === 'primitive-ghost-headset')!
    const headsetGeometry = renderAvatarByStyle(
      poseFromExpression({ ...defaultExpression, headY: 18, headZ: 6 }),
      avatar.body.primary,
      1,
      avatar.renderStyle,
      { bodyNodes: avatar.body.nodes }
    )
    const headsetScene = createRenderedScene(headsetGeometry)
    const svg = serializeAvatarSnapshot('Memento · Headset', headsetScene, avatar.colors, {
      background: 'transparent',
      colorFrom: '#ffffff',
      colorTo: '#000000',
      size: 1024,
    })

    expect(svg).toContain('fill="#111316" opacity="1"')
    expect(svg).toContain(`transform="${headsetGeometry.pathTransforms?.front.at(-1)}"`)
    expect(svg).toContain('mask="url(#snapshot-headset-mask)"')
    expect(svg).toContain('mask="url(#snapshot-headset-head-mask)"')
    expect(svg).toContain('<clipPath id="snapshot-headset-left-half">')
    expect(svg).toContain('width="573.13" height="936"')
    expect(svg).toContain('maskContentUnits="userSpaceOnUse"')
    expect(svg).toContain('stroke-width="2.4"')
  })

  it('applies logo framing without changing the rendered avatar scene', () => {
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'solid',
      colorFrom: '#818181',
      colorTo: '#818181',
      size: 1024,
      composition: { x: 55, y: 65, scale: 1.3, cornerRadius: 18 },
    })

    expect(svg).toContain('<clipPath id="snapshot-frame-clip">')
    expect(svg).toContain('rx="54"')
    expect(svg).toContain('clip-path="url(#snapshot-frame-clip)"')
    expect(svg).toContain('transform="translate(55 65) scale(1.3)"')
    expect(svg).toContain('fill="#818181"')
  })

  it('embeds a radial background without external dependencies', () => {
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'radial',
      colorFrom: '#ffffff',
      colorTo: '#8899aa',
      size: 512,
    })

    expect(svg).toContain('<radialGradient id="snapshot-radial"')
    expect(svg).toContain('fill="url(#snapshot-radial)"')
    expect(snapshotFileName('Étoile du soir')).toBe('etoile-du-soir-snapshot.svg')
    expect(snapshotFileName('Étoile du soir', 'png')).toBe('etoile-du-soir-snapshot.png')
  })

  it('embeds a pixel snapshot as a self-contained raster SVG', () => {
    const svg = serializePixelSnapshot('Pixel & Co', 'data:image/png;base64,AAAA', 256)

    expect(svg).toContain('viewBox="0 0 256 256"')
    expect(svg).toContain('image-rendering="pixelated"')
    expect(svg).toContain('data:image/png;base64,AAAA')
    expect(svg).toContain('aria-label="Pixel &amp; Co"')
  })
})

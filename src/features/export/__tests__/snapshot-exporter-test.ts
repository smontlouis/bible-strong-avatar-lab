import { poseFromExpression, renderAvatar } from '@/features/avatar/geometry'
import { defaultExpression } from '@/features/avatar/presets'
import { createRenderedScene, paintRenderedOffset } from '@/features/rendering/renderedScene'
import {
  serializeAvatarSnapshot,
  serializePixelSnapshot,
  snapshotFileName,
} from '@/features/export/snapshotExporter'
import { surfacePresets } from '@/features/avatar/surfaces'

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

  it('exports the front copy of a coloured node clipped to where it is nearer', () => {
    const hand = {
      id: 'hand',
      name: 'Hand',
      color: '#e5a15b',
      surface: { ...surfacePresets.sphere, width: 70, height: 70, depth: 70 },
      position: [-100, 0, 20] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    }
    const masked = renderAvatar(poseFromExpression(defaultExpression), surfacePresets.sphere, 1, {
      bodyNodes: [hand],
      nodeOcclusion: 'mask',
      bodyColor: colors.body,
    })
    const svg = serializeAvatarSnapshot(
      'Hands',
      createRenderedScene(masked, [hand], colors.body),
      colors,
      { background: 'transparent', colorFrom: '#ffffff', colorTo: '#000000', size: 512 },
      [hand]
    )

    expect(masked.frontClipPaths[0]).toMatch(/^M.*Z$/)
    expect(svg).toContain(
      `<clipPath id="snapshot-front-clip-0"><path d="${masked.frontClipPaths[0]}"/></clipPath>`
    )
    expect(svg).toContain('<g clip-path="url(#snapshot-front-clip-0)"><path')
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

  it('draws the silhouette outline beneath every body fill', () => {
    const svg = serializeAvatarSnapshot('Strobi', scene, colors, {
      background: 'transparent',
      colorFrom: '#ffffff',
      colorTo: '#000000',
      size: 512,
      renderStyle: {
        type: 'vector',
        outline: { enabled: true, color: '#222222', width: 8, opacity: 1 },
      },
    })
    const outlinedHead = `d="${geometry.headPath}" fill="none"`
    const filledHead = `d="${geometry.headPath}" fill="#5b7fe5"`

    expect(svg.indexOf(outlinedHead)).toBeLessThan(svg.indexOf(filledHead))
    expect(svg).not.toContain('paint-order')
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

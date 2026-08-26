import type { AvatarColors } from '../avatar/avatars'
import type { RenderedScene } from '../rendering/renderedScene'
import {
  defaultSnapshotComposition,
  normalizeSnapshotComposition,
  snapshotCornerRadius,
  type SnapshotComposition,
} from './snapshotComposition'

export type SnapshotBackground = 'transparent' | 'solid' | 'linear' | 'radial'

export type SnapshotOptions = {
  background: SnapshotBackground
  colorFrom: string
  colorTo: string
  size: number
  composition?: SnapshotComposition
}

const escapeXml = (value: string) =>
  value.replace(/[&<>"]/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    }
    return entities[character]
  })

const path = (value: string, fill: string, opacity = 1, transform?: string, mask?: string) =>
  value
    ? `<path d="${escapeXml(value)}" fill="${fill}" opacity="${opacity}"${transform ? ` transform="${escapeXml(transform)}"` : ''}${mask ? ` mask="${escapeXml(mask)}"` : ''}/>`
    : ''

const backgroundMarkup = (options: SnapshotOptions) => {
  if (options.background === 'transparent') return ''
  const fill =
    options.background === 'solid'
      ? options.colorFrom
      : options.background === 'linear'
        ? 'url(#snapshot-linear)'
        : 'url(#snapshot-radial)'
  return `<rect x="-150" y="-150" width="300" height="300" fill="${fill}"/>`
}

const gradientMarkup = (options: SnapshotOptions) => {
  if (options.background === 'linear') {
    return `<linearGradient id="snapshot-linear" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></linearGradient>`
  }
  if (options.background === 'radial') {
    return `<radialGradient id="snapshot-radial" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></radialGradient>`
  }
  return ''
}

export const serializeAvatarSnapshot = (
  name: string,
  scene: RenderedScene,
  colors: AvatarColors,
  options: SnapshotOptions
) => {
  const composition = normalizeSnapshotComposition(
    options.composition ?? defaultSnapshotComposition
  )
  const headPath = scene.headPath.get()
  const backPaths = scene.backPaths.flatMap((item, index) => {
    const value = item.get()
    return value ? [{ value, index }] : []
  })
  const frontPaths = scene.frontPaths.flatMap((item, index) => {
    const value = item.get()
    return value ? [{ value, index }] : []
  })
  const offsetX = scene.offsetX.get()
  const offsetY = scene.offsetY.get()
  const headsetOcclusion = scene.headsetOcclusion.current
  const headTransform = scene.headTransform.get()
  const body = [
    ...backPaths.map(({ value, index }) =>
      path(value, colors.body, 1, scene.backTransforms[index].get())
    ),
    path(
      headPath,
      colors.body,
      1,
      headTransform,
      headsetOcclusion ? 'url(#snapshot-headset-head-mask)' : undefined
    ),
    `<g clip-path="url(#snapshot-head-clip)">${path(scene.leftPath.get(), colors.eyes, scene.leftOpacity.get(), scene.leftTransform.get())}${path(scene.rightPath.get(), colors.eyes, scene.rightOpacity.get(), scene.rightTransform.get())}</g>`,
    ...frontPaths.map(({ value, index }) =>
      path(
        value,
        scene.headsetFrontIndex.current === index ? '#111316' : colors.body,
        1,
        scene.frontTransforms[index].get(),
        scene.headsetFrontIndex.current === index && headsetOcclusion
          ? 'url(#snapshot-headset-mask)'
          : undefined
      )
    ),
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300" width="${options.size}" height="${options.size}" role="img" aria-label="${escapeXml(name)}">
  <defs>${gradientMarkup(options)}<clipPath id="snapshot-frame-clip"><rect x="-150" y="-150" width="300" height="300" rx="${snapshotCornerRadius(composition.cornerRadius)}"/></clipPath><clipPath id="snapshot-head-clip"><path d="${escapeXml(headPath)}" transform="${escapeXml(headTransform)}"/></clipPath>${headsetOcclusion ? `<clipPath id="snapshot-headset-left-half"><rect x="0" y="0" width="${headsetOcclusion.splitX}" height="${headsetOcclusion.height}"/></clipPath><mask id="snapshot-headset-mask" x="0" y="0" width="${headsetOcclusion.width}" height="${headsetOcclusion.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect x="0" y="0" width="${headsetOcclusion.width}" height="${headsetOcclusion.height}" fill="white"/><path d="${escapeXml(headPath)}" clip-path="url(#snapshot-headset-left-half)" fill="black" stroke="black" stroke-width="${headsetOcclusion.strokeWidth}" vector-effect="non-scaling-stroke"/></mask><mask id="snapshot-headset-head-mask" x="0" y="0" width="${headsetOcclusion.width}" height="${headsetOcclusion.height}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" style="mask-type:luminance"><rect x="0" y="0" width="${headsetOcclusion.width}" height="${headsetOcclusion.height}" fill="white"/><path d="${escapeXml(frontPaths[scene.headsetFrontIndex.current!].value)}" clip-path="url(#snapshot-headset-left-half)" fill="black" stroke="black" stroke-width="${headsetOcclusion.strokeWidth}" vector-effect="non-scaling-stroke"/></mask>` : ''}</defs>
  <g clip-path="url(#snapshot-frame-clip)">
    ${backgroundMarkup(options)}
    <g transform="translate(${composition.x} ${composition.y}) scale(${composition.scale})"><g transform="translate(${offsetX} ${offsetY})">${body}</g></g>
  </g>
</svg>`
}

export const serializePixelSnapshot = (name: string, imageDataUrl: string, size: number) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(name)}">
  <image href="${escapeXml(imageDataUrl)}" width="${size}" height="${size}" image-rendering="pixelated"/>
</svg>`

export const snapshotFileName = (name: string, extension: 'svg' | 'png' = 'svg') => {
  const slug =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  return `${slug}-snapshot.${extension}`
}

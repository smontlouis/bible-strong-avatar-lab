import {
  engineFrame,
  renderCharacterFrame,
  type AvatarCharacter,
  type AvatarEngine,
} from '@bible-strong/avatar-core'

import {
  normalizeSnapshotComposition,
  snapshotCornerRadius,
  type SnapshotComposition,
} from '@/features/editor/snapshotComposition'

// A picture of the avatar as the engine has it now, as a file. It is written as plain SVG so
// that it stands by itself outside the Studio.

export type PictureOptions = {
  background: 'transparent' | 'solid' | 'linear' | 'radial'
  colorFrom: string
  colorTo: string
  /** Width and height of the file, in pixels. */
  size: number
  composition: SnapshotComposition
}

/** The avatar on the stage as an SVG document, framed and on a background as the photo is. */
export const pictureSvg = (
  character: Readonly<AvatarCharacter>,
  engine: Readonly<AvatarEngine>,
  options: Readonly<PictureOptions>
) => {
  const { geometry, colors, bodyColors, transform, spinner } = renderCharacterFrame(
    character,
    engineFrame(engine)
  )
  const composition = normalizeSnapshotComposition(options.composition)
  const round = spinner?.round ?? 0
  const outline = character.style?.outline?.enabled ? character.style.outline : null
  const stroke = outline
    ? ` stroke="${outline.color}" stroke-width="${outline.width}" stroke-opacity="${outline.opacity}" stroke-linejoin="round"`
    : ''
  const marks = (spinner?.marks ?? [])
    .map(mark =>
      mark.strokeWidth === undefined
        ? `<path d="${mark.d}" fill="${colors.body}" opacity="${mark.opacity}"/>`
        : `<path d="${mark.d}" fill="none" stroke="${colors.body}" stroke-width="${mark.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${mark.opacity}"/>`
    )
    .join('')
  const back = geometry.backPaths
    .map((path, index) => `<path d="${path}" fill="${bodyColors.back[index]}"${stroke}/>`)
    .join('')
  const front = geometry.frontPaths
    .map((path, index) => {
      const clip = geometry.frontClipPaths[index] ? ` clip-path="url(#front-${index})"` : ''
      return `<path d="${path}" fill="${bodyColors.front[index]}"${clip}${stroke}/>`
    })
    .join('')
  const clips = geometry.frontClipPaths
    .map((clip, index) =>
      clip ? `<clipPath id="front-${index}"><path d="${clip}"/></clipPath>` : ''
    )
    .join('')
  const face = [
    geometry.leftVisible ? geometry.leftPath : '',
    geometry.rightVisible ? geometry.rightPath : '',
    geometry.nosePath,
    geometry.mouthPath,
  ]
    .filter(Boolean)
    .map(path => `<path d="${path}"/>`)
    .join('')
  const gradient =
    options.background === 'linear'
      ? `<linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></linearGradient>`
      : options.background === 'radial'
        ? `<radialGradient id="background" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${options.colorFrom}"/><stop offset="1" stop-color="${options.colorTo}"/></radialGradient>`
        : ''
  const fill =
    options.background === 'transparent'
      ? ''
      : `<rect x="-150" y="-150" width="300" height="300" fill="${options.background === 'solid' ? options.colorFrom : 'url(#background)'}"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300" width="${options.size}" height="${options.size}">` +
    `<defs>${gradient}<clipPath id="frame"><rect x="-150" y="-150" width="300" height="300" rx="${snapshotCornerRadius(composition.cornerRadius)}"/></clipPath>` +
    `<clipPath id="head"><path d="${geometry.headPath}"/></clipPath>${clips}</defs>` +
    `<g clip-path="url(#frame)">${fill}` +
    `<g transform="translate(${composition.x} ${composition.y}) scale(${composition.scale})">` +
    marks +
    `<g transform="matrix(${transform.join(' ')})" opacity="${spinner?.opacity ?? 1}">` +
    `<g opacity="${1 - round}">${back}</g>` +
    (round < 0.999 ? `<path d="${geometry.headPath}" fill="${colors.body}"${stroke}/>` : '') +
    `<g clip-path="url(#head)" fill="${colors.eyes}" opacity="${1 - round}">${face}</g>` +
    `<g opacity="${1 - round}">${front}</g>` +
    (spinner && round > 0
      ? `<path d="${spinner.disc}" fill="${colors.body}" opacity="${round}"/>`
      : '') +
    `</g></g></g></svg>`
  )
}

const save = (blob: Blob, name: string) => {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  URL.revokeObjectURL(link.href)
}

/** Save a picture as `.svg`, or as `.png` of a given size when the name ends so. */
export const downloadPicture = async (svg: string, name: string, size = 1024) => {
  if (!name.endsWith('.png')) {
    save(new Blob([svg], { type: 'image/svg+xml' }), name)
    return
  }
  const image = new Image()
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('The picture could not be drawn.'))
      image.src = source
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (blob) save(blob, name)
  } finally {
    URL.revokeObjectURL(source)
  }
}

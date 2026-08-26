import type { PixelRenderStyle } from '@/features/avatar/avatars'

export type PixelAvatarFrame = {
  headPath: string
  backPaths: string[]
  frontPaths: string[]
  leftPath: string
  rightPath: string
  nosePath?: string
  mouthPath?: string
  mouthStrokeWidth?: number
  leftOpacity: number
  rightOpacity: number
  offsetX: number
  offsetY: number
  bodyColor: string
  eyeColor: string
}

const fillPath = (context: CanvasRenderingContext2D, path: string, color: string, opacity = 1) => {
  if (!path || opacity <= 0) return
  context.globalAlpha = opacity
  context.fillStyle = color
  context.fill(new Path2D(path))
}

const strokePath = (
  context: CanvasRenderingContext2D,
  path: string,
  color: string,
  width: number
) => {
  if (!path || width <= 0) return
  context.strokeStyle = color
  context.lineWidth = width
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke(new Path2D(path))
}

const colorChannels = (color: string): readonly [number, number, number] => [
  Number.parseInt(color.slice(1, 3), 16),
  Number.parseInt(color.slice(3, 5), 16),
  Number.parseInt(color.slice(5, 7), 16),
]

const colorDistance = (
  red: number,
  green: number,
  blue: number,
  target: readonly [number, number, number]
) => (red - target[0]) ** 2 + (green - target[1]) ** 2 + (blue - target[2]) ** 2

export const quantizePixelArtPixels = (
  pixels: Uint8ClampedArray,
  bodyColor: string,
  eyeColor: string,
  alphaThreshold = 128
) => {
  const body = colorChannels(bodyColor)
  const eyes = colorChannels(eyeColor)
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < alphaThreshold) {
      pixels[index] = 0
      pixels[index + 1] = 0
      pixels[index + 2] = 0
      pixels[index + 3] = 0
      continue
    }
    const color =
      colorDistance(pixels[index], pixels[index + 1], pixels[index + 2], body) <=
      colorDistance(pixels[index], pixels[index + 1], pixels[index + 2], eyes)
        ? body
        : eyes
    pixels[index] = color[0]
    pixels[index + 1] = color[1]
    pixels[index + 2] = color[2]
    pixels[index + 3] = 255
  }
}

export const paintPixelAvatar = (
  context: CanvasRenderingContext2D,
  frame: PixelAvatarFrame,
  style: PixelRenderStyle
) => {
  const resolution = style.resolution
  const scale = resolution / 300
  context.clearRect(0, 0, resolution, resolution)
  context.imageSmoothingEnabled = false
  context.save()
  context.setTransform(scale, 0, 0, scale, resolution / 2, resolution / 2)
  context.translate(frame.offsetX, frame.offsetY)

  frame.backPaths.forEach(path => fillPath(context, path, frame.bodyColor))
  fillPath(context, frame.headPath, frame.bodyColor)

  context.save()
  context.clip(new Path2D(frame.headPath))
  fillPath(context, frame.leftPath, frame.eyeColor, frame.leftOpacity)
  fillPath(context, frame.rightPath, frame.eyeColor, frame.rightOpacity)
  fillPath(context, frame.nosePath ?? '', frame.eyeColor)
  if ((frame.mouthStrokeWidth ?? 0) > 0) {
    strokePath(context, frame.mouthPath ?? '', frame.eyeColor, frame.mouthStrokeWidth ?? 0)
  } else {
    fillPath(context, frame.mouthPath ?? '', frame.eyeColor)
  }
  context.restore()

  frame.frontPaths.forEach(path => fillPath(context, path, frame.bodyColor))
  context.restore()

  const image = context.getImageData(0, 0, resolution, resolution)
  quantizePixelArtPixels(image.data, frame.bodyColor, frame.eyeColor)
  context.putImageData(image, 0, 0)
}

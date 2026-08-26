import { useEffect, useRef } from 'react'

import type { PixelRenderStyle } from '@/features/avatar/avatars'
import { paintPixelAvatar, type PixelAvatarFrame } from '@/features/rendering/pixelRenderer'
import type { RenderedColors, RenderedScene } from '@/features/rendering/renderedScene'

export function StaticPixelAvatarCanvas({
  frame,
  style,
  className,
}: {
  frame: PixelAvatarFrame
  style: PixelRenderStyle
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    paintPixelAvatar(context, frame, style)
  }, [frame, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

export function LivePixelAvatarCanvas({
  scene,
  colors,
  style,
  className,
}: {
  scene: RenderedScene
  colors: RenderedColors
  style: PixelRenderStyle
  className: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !context) return
    canvas.width = style.resolution
    canvas.height = style.resolution
    let frameRequest: number | null = null
    const readPaths = (paths: RenderedScene['backPaths']) => {
      const values: string[] = []
      paths.forEach(path => {
        const value = path.get()
        if (value) values.push(value)
      })
      return values
    }
    const paint = () => {
      frameRequest = null
      paintPixelAvatar(
        context,
        {
          headPath: scene.headPath.get(),
          backPaths: readPaths(scene.backPaths),
          frontPaths: readPaths(scene.frontPaths),
          leftPath: scene.leftPath.get(),
          rightPath: scene.rightPath.get(),
          nosePath: scene.nosePath.get(),
          mouthPath: scene.mouthPath.get(),
          mouthStrokeWidth: scene.mouthStrokeWidth.get(),
          leftOpacity: scene.leftOpacity.get(),
          rightOpacity: scene.rightOpacity.get(),
          offsetX: scene.offsetX.get(),
          offsetY: scene.offsetY.get(),
          bodyColor: colors.body.get(),
          eyeColor: colors.eyes.get(),
        },
        style
      )
    }
    const schedulePaint = () => {
      if (frameRequest === null) frameRequest = requestAnimationFrame(paint)
    }
    const values = [
      scene.headPath,
      ...scene.backPaths,
      ...scene.frontPaths,
      scene.leftPath,
      scene.rightPath,
      scene.nosePath,
      scene.mouthPath,
      scene.mouthStrokeWidth,
      scene.leftOpacity,
      scene.rightOpacity,
      scene.offsetX,
      scene.offsetY,
      colors.body,
      colors.eyes,
    ]
    const unsubscribers = values.map(value => value.on('change', schedulePaint))
    paint()
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
      if (frameRequest !== null) cancelAnimationFrame(frameRequest)
    }
  }, [colors, scene, style])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

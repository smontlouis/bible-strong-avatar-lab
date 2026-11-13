import type { AvatarCharacter, CharacterScene } from '@bible-strong/avatar-core'
import { useId, type ReactNode, type Ref } from 'react'

/** One picture of a character, as the engine has it. `children` are drawn over it. */
export function Scene({
  scene,
  character,
  svgRef,
  className,
  children,
  viewBox = '-150 -150 300 300',
}: {
  scene: CharacterScene
  character: AvatarCharacter
  svgRef?: Ref<SVGSVGElement>
  className?: string
  children?: ReactNode
  viewBox?: string
}) {
  const id = useId().replace(/:/g, '')
  const { geometry, colors, bodyColors, transform, spinner } = scene
  // A body that turns into a spinner fades its parts and its face as it becomes a disc.
  const round = spinner?.round ?? 0
  const outline = character.style?.outline?.enabled ? character.style.outline : null
  const stroke = outline
    ? {
        stroke: outline.color,
        strokeWidth: outline.width,
        strokeOpacity: outline.opacity,
        strokeLinejoin: 'round' as const,
      }
    : {}
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      className={className}
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {spinner?.marks.map((mark, index) =>
        mark.strokeWidth === undefined ? (
          <path d={mark.d} fill={colors.body} opacity={mark.opacity} key={index} />
        ) : (
          <path
            d={mark.d}
            fill="none"
            stroke={colors.body}
            strokeWidth={mark.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={mark.opacity}
            key={index}
          />
        )
      )}
      <g transform={`matrix(${transform.join(' ')})`} opacity={spinner?.opacity ?? 1}>
        <defs>
          <clipPath id={`${id}-head`}>
            <path d={geometry.headPath} />
          </clipPath>
          {geometry.frontClipPaths.map((clip, index) => (
            <clipPath id={`${id}-front-${index}`} key={index}>
              <path d={clip} />
            </clipPath>
          ))}
        </defs>
        <g opacity={1 - round}>
          {geometry.backPaths.map((path, index) => (
            <path d={path} fill={bodyColors.back[index]} {...stroke} key={index} />
          ))}
        </g>
        {round < 0.999 && <path d={geometry.headPath} fill={colors.body} {...stroke} />}
        <g clipPath={`url(#${id}-head)`} fill={colors.eyes} opacity={1 - round}>
          {geometry.leftVisible && <path d={geometry.leftPath} />}
          {geometry.rightVisible && <path d={geometry.rightPath} />}
          <path d={geometry.nosePath} />
          <path d={geometry.mouthPath} />
        </g>
        <g opacity={1 - round}>
          {geometry.frontPaths.map((path, index) => (
            <path
              d={path}
              fill={bodyColors.front[index]}
              clipPath={geometry.frontClipPaths[index] ? `url(#${id}-front-${index})` : undefined}
              {...stroke}
              key={index}
            />
          ))}
        </g>
        {spinner && round > 0 && <path d={spinner.disc} fill={colors.body} opacity={round} />}
      </g>
      {children}
    </svg>
  )
}

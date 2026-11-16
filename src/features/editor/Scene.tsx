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
  // The outline goes round the whole silhouette, not round each part: every shape is stroked
  // underneath, twice as wide, and the fills drawn over it hide all but the outer half.
  const outline = character.style?.outline?.enabled ? character.style.outline : null
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
      <g transform={`matrix(${transform.join(' ')})`} opacity={scene.opacity}>
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
        {outline && (
          <g
            fill="none"
            stroke={outline.color}
            strokeWidth={outline.width * 2}
            strokeLinejoin="round"
            opacity={outline.opacity * (1 - round)}
            data-outline
          >
            {geometry.backPaths.map((path, index) => (
              <path d={path} key={`back-${index}`} />
            ))}
            {round < 0.999 && <path d={geometry.headPath} />}
            {geometry.frontPaths.map((path, index) => (
              <path d={path} key={`front-${index}`} />
            ))}
          </g>
        )}
        <g opacity={1 - round}>
          {geometry.backPaths.map((path, index) => (
            <path d={path} fill={bodyColors.back[index]} key={index} />
          ))}
        </g>
        {round < 0.999 && <path d={geometry.headPath} fill={colors.body} />}
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

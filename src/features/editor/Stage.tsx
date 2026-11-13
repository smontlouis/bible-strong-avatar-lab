import {
  advanceEngine,
  clips,
  engineFrame,
  pauseEngine,
  playEngineClip,
  poseFromExpression,
  renderCharacterFrame,
  resumeEngine,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEnginePose,
  setEngineRoutine,
  setEngineState,
  type CharacterScene,
} from '@bible-strong/avatar-core'
import { useEffect, useRef, useState } from 'react'

import { Scene } from '@/features/editor/Scene'
import type { Editor } from '@/features/editor/useEditor'
import { BodyNodeGizmo } from '@/features/rendering/components/AvatarCanvas'

/** What the stage tells the panels about the avatar, a few times a second. */
export type StageStatus = {
  clip: string
  duration: number
  time: number
  joining: boolean
  face: string
  state: string | null
  morph: string | null
  routineStep: number
  text: string | null
}

export const emptyStatus: StageStatus = {
  clip: '',
  duration: 0,
  time: 0,
  joining: false,
  face: 'neutral',
  state: null,
  morph: null,
  routineStep: 0,
  text: null,
}

// The pose the body is built in: at rest, facing the viewer, at its own size.
const BUILD_POSE = { rotation: [0, 0, 0], position: [0, 0], zoom: 0.6 } as const
const STATUS_EVERY_FRAMES = 6
// How many units the stage shows across: the avatar's own 300, and room around them.
const STAGE_VIEW = 380

export function Stage({
  editor,
  onStatus,
}: {
  editor: Editor
  onStatus: (status: StageStatus) => void
}) {
  const {
    activeAvatar,
    character,
    commitBodyNode,
    doing,
    engine,
    expression,
    face,
    followsPointer,
    playing,
    pose,
    selectedBodyNode,
    setPose,
    speed,
    t,
    tab,
  } = editor
  const svg = useRef<SVGSVGElement | null>(null)
  const [scene, setScene] = useState<CharacterScene | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const report = useRef(onStatus)
  report.current = onStatus
  const building = tab === 'character'
  const posing = tab === 'pose'

  useEffect(() => {
    if ('routine' in doing) {
      setEngineRoutine(engine.current, doing.routine)
      return
    }
    setEngineRoutine(engine.current, null)
    if ('state' in doing) setEngineState(engine.current, doing.state)
    else if (clips[doing.clip]) playEngineClip(engine.current, clips[doing.clip])
  }, [doing, engine, activeAvatar.id])

  useEffect(() => setEngineFace(engine.current, face), [face, engine])

  // The body is built at rest, and a pose is set by hand on a body that has stopped.
  useEffect(() => {
    if (building)
      setEnginePose(engine.current, { ...BUILD_POSE, rotation: [0, 0, 0], position: [0, 0] })
    else if (posing) setEnginePose(engine.current, pose)
    else setEnginePose(engine.current, null)
    if (playing && !building && !posing) resumeEngine(engine.current)
    else pauseEngine(engine.current)
  }, [building, posing, pose, playing, engine])

  useEffect(() => {
    const follows = followsPointer && !building && !posing
    setEngineGazeAlways(engine.current, follows)
    if (!follows) {
      setEngineGaze(engine.current, null)
      return
    }
    const look = (event: PointerEvent) => {
      const box = svg.current?.getBoundingClientRect()
      if (!box || box.width === 0) return
      setEngineGaze(engine.current, [
        (event.clientX - (box.left + box.width / 2)) / (box.width * 2),
        -(event.clientY - (box.top + box.height / 2)) / (box.width * 2),
      ])
    }
    window.addEventListener('pointermove', look)
    return () => window.removeEventListener('pointermove', look)
  }, [followsPointer, building, posing, engine])

  useEffect(() => {
    if (!character) return
    let request = 0
    let last: number | undefined
    let frames = 0
    const tick = (now: number) => {
      const current = engine.current
      advanceEngine(current, last === undefined ? 0 : ((now - last) / 1000) * speedRef.current)
      last = now
      const frame = engineFrame(current)
      setScene(renderCharacterFrame(character, frame))
      frames += 1
      if (frames % STATUS_EVERY_FRAMES === 0) {
        report.current({
          clip: current.player.clip?.name ?? '',
          duration: current.player.clip?.duration ?? 0,
          time: current.player.time,
          joining: current.player.join !== null,
          face: frame.face,
          state: current.state,
          morph: current.morph,
          routineStep: current.routine?.step ?? 0,
          text: current.routine?.text ?? null,
        })
      }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [character, engine])

  // In the pose tool, dragging the stage turns the avatar.
  const drag = useRef<{ x: number; y: number; rotation: [number, number, number] } | null>(null)
  const startTurn = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!posing) return
    drag.current = { x: event.clientX, y: event.clientY, rotation: pose.rotation }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const turn = (event: React.PointerEvent<SVGSVGElement>) => {
    const from = drag.current
    if (!from) return
    setPose({
      ...pose,
      rotation: [
        from.rotation[0] + (event.clientY - from.y) * 0.4,
        from.rotation[1] + (event.clientX - from.x) * 0.4,
        from.rotation[2],
      ],
    })
  }
  const endTurn = () => {
    drag.current = null
  }

  // The gizmo reads pointer positions against a view 300 units wide. The stage shows more than
  // that, to leave room around the avatar: the gizmo is given the part of the stage that those
  // 300 units cover.
  const gizmoFrame = useRef({
    getBoundingClientRect: () => {
      const box = svg.current!.getBoundingClientRect()
      const side = (Math.min(box.width, box.height) * 300) / STAGE_VIEW
      return new DOMRect(
        box.left + (box.width - side) / 2,
        box.top + (box.height - side) / 2,
        side,
        side
      )
    },
  }) as unknown as React.RefObject<SVGSVGElement | null>

  if (!character || !scene) return <div className="size-full" />
  return (
    <div
      className="size-full touch-none"
      style={{ cursor: posing ? 'grab' : 'default' }}
      aria-label={posing ? t('Glisse pour tourner l’avatar') : undefined}
    >
      <Scene
        scene={scene}
        character={character}
        svgRef={svg}
        className="size-full"
        viewBox={`${-STAGE_VIEW / 2} ${-STAGE_VIEW / 2} ${STAGE_VIEW} ${STAGE_VIEW}`}
      >
        <rect
          x={-190}
          y={-190}
          width={380}
          height={380}
          fill="transparent"
          onPointerDown={startTurn as never}
          onPointerMove={turn as never}
          onPointerUp={endTurn}
          onPointerCancel={endTurn}
        />
        {building && selectedBodyNode && (
          <BodyNodeGizmo
            svgRef={gizmoFrame}
            pose={poseFromExpression({ ...expression, perspective: character.face.perspective })}
            node={selectedBodyNode}
            onPreview={commitBodyNode}
            onCommit={commitBodyNode}
          />
        )}
      </Scene>
    </div>
  )
}

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
  type Expression,
} from '@bible-strong/avatar-core'
import { useEffect, useMemo, useRef, useState } from 'react'

import { PlaybackIdentity } from '@/app/components/common'
import { Scene } from '@/features/editor/Scene'
import type { Editor } from '@/features/editor/useEditor'
import { BodyNodeGizmo, RotationGizmo } from '@/features/rendering/components/AvatarCanvas'
import {
  createRenderedRotationGizmo,
  paintRenderedRotationGizmo,
} from '@/features/rendering/renderedRotationGizmo'

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

export function Stage({
  editor,
  onStatus,
  status,
}: {
  editor: Editor
  onStatus: (status: StageStatus) => void
  /** What the avatar is doing, shown in a corner of the stage. */
  status: string
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
    photoMode,
    playing,
    pose,
    selectedBodyNode,
    setPose,
    speed,
    t,
    tab,
  } = editor
  const svg = useRef<SVGSVGElement>(null)
  const [scene, setScene] = useState<CharacterScene | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const report = useRef(onStatus)
  report.current = onStatus
  const building = editor.building
  const posing = (tab === 'pose' || photoMode) && !building
  // The head's turn as the gizmo has it: a face at rest, turned by the three angles.
  const turned = useMemo(
    () => ({ ...expression, headX: pose.head[0], headY: pose.head[1], headZ: pose.head[2] }),
    [expression, pose.head]
  )
  const rotationGizmo = useMemo(() => createRenderedRotationGizmo(turned), [])
  useEffect(() => paintRenderedRotationGizmo(rotationGizmo, turned), [rotationGizmo, turned])
  const setHead = (next: Expression) =>
    setPose({ ...pose, head: [next.headX, next.headY, next.headZ] })

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
    else if (posing) {
      setEnginePose(engine.current, {
        orientation: poseFromExpression(turned).orientation,
        position: pose.position,
        zoom: pose.zoom,
      })
    } else setEnginePose(engine.current, null)
    if (playing && !building && !posing) resumeEngine(engine.current)
    else pauseEngine(engine.current)
  }, [building, posing, pose, turned, playing, engine])

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
  const drag = useRef<{ x: number; y: number; head: [number, number, number] } | null>(null)
  const startTurn = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!posing) return
    drag.current = { x: event.clientX, y: event.clientY, head: pose.head }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const turn = (event: React.PointerEvent<SVGSVGElement>) => {
    const from = drag.current
    if (!from) return
    setPose({
      ...pose,
      head: [
        from.head[0] - (event.clientY - from.y) * 0.4,
        from.head[1] + (event.clientX - from.x) * 0.4,
        from.head[2],
      ],
    })
  }
  const endTurn = () => {
    drag.current = null
  }

  if (!character || !scene) return <div className="avatar-wrap" />
  return (
    <div
      className="avatar-wrap"
      style={{ cursor: posing ? 'grab' : undefined, touchAction: 'none' }}
    >
      {!building && !posing && status && (
        <div className="stage-playback-status">
          <PlaybackIdentity name={status} status={playing ? 'playing' : 'paused'} />
        </div>
      )}
      <Scene scene={scene} character={character} svgRef={svg} className="avatar">
        <rect
          x={-150}
          y={-150}
          width={300}
          height={300}
          fill="transparent"
          aria-label={posing ? t('Glisse pour tourner l’avatar') : undefined}
          onPointerDown={startTurn as never}
          onPointerMove={turn as never}
          onPointerUp={endTurn}
          onPointerCancel={endTurn}
        />
        {building && selectedBodyNode && (
          <BodyNodeGizmo
            svgRef={svg}
            pose={poseFromExpression({ ...expression, perspective: character.face.perspective })}
            node={selectedBodyNode}
            onPreview={commitBodyNode}
            onCommit={commitBodyNode}
          />
        )}
      </Scene>
      {posing && (
        <>
          <RotationGizmo
            expression={turned}
            rendered={rotationGizmo}
            onPreview={setHead}
            onChange={setHead}
            onActiveChange={() => {}}
            onReset={() => setPose({ ...pose, head: [0, 0, 0] })}
          />
          <div className="axis-key">
            <i className="x" />X <i className="y" />Y <i className="z" />Z
          </div>
        </>
      )}
    </div>
  )
}

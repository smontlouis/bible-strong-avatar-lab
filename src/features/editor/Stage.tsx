import {
  advanceEngine,
  clips,
  engineFrame,
  pauseEngine,
  playEngineClip,
  frameOrientation,
  poseFromExpression,
  quaternionToEuler,
  releaseEnginePose,
  renderCharacterFrame,
  resumeEngine,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEnginePose,
  setEngineState,
  stopEngine,
  type CharacterScene,
  type Expression,
} from '@bible-strong/avatar-core'
import { useEffect, useMemo, useRef, useState } from 'react'

import { PlaybackIdentity } from '@/features/editor/panels'
import { Scene } from '@/features/editor/Scene'
import type { Editor } from '@/features/editor/useEditor'
import { BodyNodeGizmo, RotationGizmo } from '@/features/editor/gizmos'
import {
  createRenderedRotationGizmo,
  paintRenderedRotationGizmo,
} from '@/features/editor/renderedRotationGizmo'

/** What the stage tells the panels about the avatar, a few times a second. */
export type StageStatus = {
  clip: string
  duration: number
  time: number
  joining: boolean
  face: string
  state: string | null
  morph: string | null
}

export const emptyStatus: StageStatus = {
  clip: '',
  duration: 0,
  time: 0,
  joining: false,
  face: 'neutral',
  state: null,
  morph: null,
}

// The pose the body is built in: at rest, facing the viewer, at its own size.
const BUILD_POSE = { rotation: [0, 0, 0], position: [0, 0], zoom: 0.6 } as const
// The turn it is shown with while its perspective is set: from the front, depth does not show.
const DEPTH_TURN = [-12, 38, 0] as const
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
    run,
    stopped,
    held,
    pose,
    selectedBodyNode,
    setPose,
    speed,
    t,
    tab,
    showsDepth,
  } = editor
  const svg = useRef<SVGSVGElement>(null)
  const [scene, setScene] = useState<CharacterScene | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const report = useRef(onStatus)
  report.current = onStatus
  const building = editor.building
  // Posed by hand: in the photo mode, or held, wherever it was taken in hand.
  const posing = (held || photoMode) && !building
  // The head's turn as the gizmo has it: a face at rest, turned by the three angles.
  const turned = useMemo(
    () => ({ ...expression, headX: pose.head[0], headY: pose.head[1], headZ: pose.head[2] }),
    [expression, pose.head]
  )
  const rotationGizmo = useMemo(() => createRenderedRotationGizmo(turned), [])
  useEffect(() => paintRenderedRotationGizmo(rotationGizmo, turned), [rotationGizmo, turned])
  const setHead = (next: Expression) =>
    setPose({ ...pose, head: [next.headX, next.headY, next.headZ] })

  const startedRun = useRef(run)
  useEffect(() => {
    const anew = startedRun.current !== run
    startedRun.current = run
    if ('state' in doing) setEngineState(engine.current, doing.state)
    else if (clips[doing.clip]) {
      // A clip the engine already plays alone is left where it is: it was started by hand, at
      // a time of its own.
      const alone = engine.current.state === null && engine.current.player.clip?.name === doing.clip
      if (!alone || anew)
        playEngineClip(engine.current, clips[doing.clip], { transition: anew ? 'cut' : 'join' })
    }
  }, [doing, run, engine, activeAvatar.id])

  // Stopped, the avatar comes to rest and stays there.
  useEffect(() => {
    if (stopped) stopEngine(engine.current)
  }, [stopped, engine])

  useEffect(() => setEngineFace(engine.current, face), [face, engine])

  // The body is built at rest, and a pose is set by hand on a body that has stopped.
  const wasPosing = useRef(false)
  useEffect(() => {
    if (building)
      setEnginePose(engine.current, {
        ...BUILD_POSE,
        rotation: showsDepth ? [...DEPTH_TURN] : [0, 0, 0],
        position: [0, 0],
      })
    else if (posing) {
      setEnginePose(engine.current, {
        orientation: poseFromExpression(turned).orientation,
        position: pose.position,
        zoom: pose.zoom,
      })
    } else if (wasPosing.current) {
      // Let go, the body goes back to the clip where it waited, without a jump.
      releaseEnginePose(engine.current)
    } else if (engine.current.pose) setEnginePose(engine.current, null)
    wasPosing.current = posing
    if (playing && !stopped && !building && !posing) resumeEngine(engine.current)
    else pauseEngine(engine.current)
  }, [building, showsDepth, posing, pose, turned, playing, stopped, engine])

  useEffect(() => {
    // The gaze is a toy of the pose tool: the avatar turns to the pointer from the pose it has.
    const follows = followsPointer && tab === 'pose' && !building && !photoMode
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
  }, [followsPointer, building, tab, photoMode, engine])

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
        })
      }
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [character, engine])

  // In the pose tool, dragging the stage turns the avatar.
  /**
   * Take the avatar in hand as it is now: the pose starts from the frame on the stage, so that
   * nothing moves when the hand takes over.
   */
  const grab = () => {
    const frame = engineFrame(engine.current)
    const [x, y, z] = quaternionToEuler(frameOrientation(frame)).map(
      angle => (angle * 180) / Math.PI
    )
    const next = {
      head: [x, y, z] as [number, number, number],
      position: [frame.position[0], frame.position[1]] as [number, number],
      zoom: frame.zoom,
    }
    setPose(next)
    return next
  }

  // The Pose tab takes the avatar in hand as soon as it opens.
  useEffect(() => {
    if (tab === 'pose' && !building && !held && !photoMode) grab()
    // Only the opening of the tab takes it.
  }, [tab])

  // Wherever the avatar is, dragging it on the stage takes it in hand, past a few pixels: a
  // click alone leaves it playing.
  const GRAB_PIXELS = 4
  const drag = useRef<{
    x: number
    y: number
    head: [number, number, number] | null
    pose: typeof pose
  } | null>(null)
  const startTurn = (event: React.PointerEvent<SVGSVGElement>) => {
    if (building) return
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      head: posing ? pose.head : null,
      pose,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const turn = (event: React.PointerEvent<SVGSVGElement>) => {
    const from = drag.current
    if (!from) return
    const dx = event.clientX - from.x
    const dy = event.clientY - from.y
    if (!from.head) {
      if (Math.hypot(dx, dy) < GRAB_PIXELS) return
      const taken = grab()
      from.head = taken.head
      from.pose = taken
    }
    setPose({
      ...from.pose,
      head: [from.head[0] - dy * 0.4, from.head[1] + dx * 0.4, from.head[2]],
    })
  }
  const endTurn = () => {
    drag.current = null
  }

  if (!character || !scene) return <div className="avatar-wrap" />
  return (
    <div
      className="avatar-wrap"
      style={{ cursor: building ? undefined : 'grab', touchAction: 'none' }}
    >
      {!building && !posing && status && (
        <div className="stage-playback-status">
          <PlaybackIdentity
            name={status}
            status={stopped ? 'stopped' : playing ? 'playing' : 'paused'}
          />
        </div>
      )}
      <Scene scene={scene} character={character} svgRef={svg} className="avatar">
        <rect
          x={-150}
          y={-150}
          width={300}
          height={300}
          fill="transparent"
          aria-label={building ? undefined : t('Glisse pour tourner l’avatar')}
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

import {
  advanceEngine,
  characterFromLegacyDefinition,
  clipNames,
  clips,
  createAvatarEngine,
  engineFrame,
  faceNames,
  gestureNames,
  pauseEngine,
  playEngineClip,
  pokeEngine,
  renderCharacterFrame,
  resumeEngine,
  setEngineFace,
  setEngineGaze,
  setEngineGazeAlways,
  setEngineState,
  stateGroups,
  type AvatarCharacter,
  type CharacterScene,
} from '@bible-strong/avatar-core'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { createAvatarDefinition } from '@/features/avatar/avatarDefinition'
import { loadStudioDocument } from '@/features/studio/studioDocument'

// A first view of the new engine: one of the Studio's avatars, playing the clips of the
// catalogue. It is a tool to judge the motion while the editor is rebuilt around clips.

const charactersOfStudio = (): AvatarCharacter[] =>
  loadStudioDocument().library.avatars.flatMap(avatar => {
    const definition = createAvatarDefinition({
      avatar,
      behavior: { expressions: [], sequences: [] },
    })
    return definition.ok ? [characterFromLegacyDefinition(definition.value)] : []
  })

function Scene({ scene }: { scene: CharacterScene }) {
  const id = useId().replace(/:/g, '')
  const { geometry, colors, bodyColors, transform } = scene
  return (
    <svg viewBox="-190 -190 380 380" className="size-full" aria-hidden="true">
      <g transform={`matrix(${transform.join(' ')})`}>
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
        {geometry.backPaths.map((path, index) => (
          <path d={path} fill={bodyColors.back[index]} key={index} />
        ))}
        <path d={geometry.headPath} fill={colors.body} />
        <g clipPath={`url(#${id}-head)`} fill={colors.eyes}>
          {geometry.leftVisible && <path d={geometry.leftPath} />}
          {geometry.rightVisible && <path d={geometry.rightPath} />}
          <path d={geometry.nosePath} />
          <path d={geometry.mouthPath} />
        </g>
        {geometry.frontPaths.map((path, index) => (
          <path
            d={path}
            fill={bodyColors.front[index]}
            clipPath={geometry.frontClipPaths[index] ? `url(#${id}-front-${index})` : undefined}
            key={index}
          />
        ))}
      </g>
    </svg>
  )
}

const pill = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors ${
    active
      ? 'border-transparent bg-neutral-900 text-white'
      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'
  }`

const heading = 'mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase'

export function ClipExplorer() {
  const characters = useMemo(charactersOfStudio, [])
  const [characterIndex, setCharacterIndex] = useState(0)
  // What plays: a state of the catalogue, which draws its own clips, or one clip by name.
  const [playingWhat, setPlayingWhat] = useState<{ state: string } | { clip: string }>({
    state: 'idle',
  })
  const [face, setFace] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [follows, setFollows] = useState(false)
  const engine = useRef(createAvatarEngine({ seed: 1 }))
  const stage = useRef<HTMLDivElement | null>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const character = characters[characterIndex]
  const [scene, setScene] = useState<CharacterScene | null>(null)
  const [status, setStatus] = useState({
    clip: '',
    duration: 0,
    time: 0,
    face: 'neutral',
    joining: false,
    state: '' as string | null,
    morph: null as string | null,
  })

  useEffect(() => {
    if ('state' in playingWhat) setEngineState(engine.current, playingWhat.state)
    else playEngineClip(engine.current, clips[playingWhat.clip])
  }, [playingWhat])

  useEffect(() => {
    setEngineFace(engine.current, face)
  }, [face])

  useEffect(() => {
    if (playing) resumeEngine(engine.current)
    else pauseEngine(engine.current)
  }, [playing])

  useEffect(() => {
    setEngineGazeAlways(engine.current, follows)
    if (!follows) {
      setEngineGaze(engine.current, null)
      return
    }
    const look = (event: PointerEvent) => {
      const box = stage.current?.getBoundingClientRect()
      if (!box) return
      // Twice the width of the avatar away is as far as the gaze goes.
      setEngineGaze(engine.current, [
        (event.clientX - (box.left + box.width / 2)) / (box.width * 2),
        -(event.clientY - (box.top + box.height / 2)) / (box.width * 2),
      ])
    }
    window.addEventListener('pointermove', look)
    return () => window.removeEventListener('pointermove', look)
  }, [follows])

  useEffect(() => {
    if (!character) return
    let frameRequest = 0
    let last = performance.now()
    const tick = (now: number) => {
      advanceEngine(engine.current, ((now - last) / 1000) * speedRef.current)
      last = now
      const frame = engineFrame(engine.current)
      const player = engine.current.player
      setScene(renderCharacterFrame(character, frame))
      setStatus({
        clip: player.clip?.name ?? '',
        duration: player.clip?.duration ?? 0,
        time: player.time,
        face: frame.face,
        joining: player.join !== null,
        state: engine.current.state,
        morph: engine.current.morph,
      })
      frameRequest = requestAnimationFrame(tick)
    }
    frameRequest = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRequest)
  }, [character])

  if (!character) return <p className="p-6">Aucun avatar dans le Studio.</p>

  return (
    <main className="grid h-dvh grid-cols-1 bg-neutral-100 text-neutral-900 md:grid-cols-[minmax(0,1fr)_440px]">
      <section className="flex min-h-0 flex-col items-center justify-center gap-3 p-6">
        <div className="aspect-square w-full max-w-[560px]" ref={stage}>
          {scene && <Scene scene={scene} />}
        </div>
        <p className="text-center font-mono text-xs text-neutral-600">
          {status.state ? `état ${status.state} · ` : ''}
          {status.clip} · {status.joining ? 'raccord' : `${status.time.toFixed(2)} s`} /{' '}
          {status.duration} s · visage {status.face}
          {status.morph ? ` · morphing ${status.morph} (pas encore dessiné)` : ''}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button className={pill(false)} type="button" onClick={() => setPlaying(value => !value)}>
            {playing ? 'Pause' : 'Lecture'}
          </button>
          {[0.25, 0.5, 1].map(value => (
            <button
              className={pill(speed === value)}
              type="button"
              key={value}
              onClick={() => setSpeed(value)}
            >
              ×{value}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-neutral-300" />
          {gestureNames.map(name => (
            <button
              className={pill(false)}
              type="button"
              key={name}
              onClick={() => pokeEngine(engine.current, name)}
            >
              {name}
            </button>
          ))}
          <button
            className={pill(follows)}
            type="button"
            onClick={() => setFollows(value => !value)}
          >
            Suit le pointeur
          </button>
        </div>
      </section>
      <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-l border-neutral-200 bg-white p-5">
        <div>
          <h2 className={heading}>Avatar</h2>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((item, index) => (
              <button
                className={pill(index === characterIndex)}
                type="button"
                key={index}
                onClick={() => setCharacterIndex(index)}
              >
                {item.name ?? `Avatar ${index + 1}`}
              </button>
            ))}
          </div>
        </div>
        {stateGroups.map(group => (
          <div key={group.label}>
            <h2 className={heading}>États · {group.label}</h2>
            <div className="flex flex-wrap gap-1.5">
              {group.states.map(name => (
                <button
                  className={pill('state' in playingWhat && playingWhat.state === name)}
                  type="button"
                  key={name}
                  onClick={() => setPlayingWhat({ state: name })}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <h2 className={heading}>Clips</h2>
          <div className="flex flex-wrap gap-1.5">
            {clipNames.map(name => (
              <button
                className={pill(
                  'clip' in playingWhat ? playingWhat.clip === name : status.clip === name
                )}
                type="button"
                key={name}
                onClick={() => setPlayingWhat({ clip: name })}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className={heading}>Visage</h2>
          <div className="flex flex-wrap gap-1.5">
            <button className={pill(face === null)} type="button" onClick={() => setFace(null)}>
              Automatique
            </button>
            {faceNames.map(name => (
              <button
                className={pill(face === name)}
                type="button"
                key={name}
                onClick={() => setFace(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </main>
  )
}

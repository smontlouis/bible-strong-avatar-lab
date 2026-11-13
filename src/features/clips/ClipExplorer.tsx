import {
  advancePlayer,
  characterFromLegacyDefinition,
  clipNames,
  clips,
  createAvatarPlayer,
  faceNames,
  pausePlayer,
  playClip,
  playerFrame,
  renderCharacterFrame,
  resumePlayer,
  setPlayerFace,
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

export function ClipExplorer() {
  const characters = useMemo(charactersOfStudio, [])
  const [characterIndex, setCharacterIndex] = useState(0)
  const [clipName, setClipName] = useState('Idle_B')
  const [face, setFace] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const player = useRef(createAvatarPlayer())
  const speedRef = useRef(speed)
  speedRef.current = speed
  const character = characters[characterIndex]
  const [scene, setScene] = useState<CharacterScene | null>(null)
  const [status, setStatus] = useState({ time: 0, face: 'neutral', joining: false, loops: 0 })

  useEffect(() => {
    playClip(player.current, clips[clipName])
  }, [clipName])

  useEffect(() => {
    setPlayerFace(player.current, face)
  }, [face])

  useEffect(() => {
    if (playing) resumePlayer(player.current)
    else pausePlayer(player.current)
  }, [playing])

  useEffect(() => {
    if (!character) return
    let frameRequest = 0
    let last = performance.now()
    const tick = (now: number) => {
      advancePlayer(player.current, ((now - last) / 1000) * speedRef.current)
      last = now
      const frame = playerFrame(player.current)
      setScene(renderCharacterFrame(character, frame))
      setStatus({
        time: player.current.time,
        face: frame.face,
        joining: player.current.join !== null,
        loops: player.current.loopCount,
      })
      frameRequest = requestAnimationFrame(tick)
    }
    frameRequest = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRequest)
  }, [character])

  if (!character) return <p className="p-6">Aucun avatar dans le Studio.</p>
  const clip = clips[clipName]

  return (
    <main className="grid h-dvh grid-cols-1 bg-neutral-100 text-neutral-900 md:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-h-0 flex-col items-center justify-center gap-3 p-6">
        <div className="aspect-square w-full max-w-[560px]">{scene && <Scene scene={scene} />}</div>
        <p className="font-mono text-xs text-neutral-600">
          {clipName} · {status.joining ? 'raccord' : `${status.time.toFixed(2)} s`} /{' '}
          {clip.duration} s · visage {status.face} · tours {status.loops}
        </p>
        <div className="flex items-center gap-2">
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
        </div>
      </section>
      <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-l border-neutral-200 bg-white p-5">
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Avatar
          </h2>
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
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Clip
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {clipNames.map(name => (
              <button
                className={pill(name === clipName)}
                type="button"
                key={name}
                onClick={() => setClipName(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Visage
          </h2>
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

# Writing a clip for the Bible Strong Avatar Studio

This page is for anyone, person or coding agent, who writes a **clip**: a short piece of motion
that every avatar of the Studio can play. It gives the format, its units, how to hand a clip to
the Studio through a link, and how to look at what you made before you hand it over.

- Studio: https://avatars.bible-strong.app/
- JSON Schema of a clip: https://avatars.bible-strong.app/clip.schema.json
- The 28 clips of the catalogue, to learn from: https://avatars.bible-strong.app/catalogue/clips.json,
  an object of clips by name. Their `workArea.end` is not always their duration and their `body`
  names the shape they were drawn for (`sphere`, `clover`, `cloud`): both are informative. Every
  clip plays on every body, but a clip drawn for another shape may need its amplitudes checked on
  the frame sheet of yours.
  (and the states that play them: https://avatars.bible-strong.app/catalogue/states.json). Read the
  ones closest to what you are asked for before writing.
- Everything else for agents (packages, character files): https://avatars.bible-strong.app/llms.txt

## Handing a clip to the Studio: the link

A clip travels in the fragment of the Studio's address, after `clip=`:

```
https://avatars.bible-strong.app/#clip={"name":"Hop","duration":1.2,"tracks":{...}}
```

- Opening the link opens the Clips tab with the clip as a **draft**, ready to be edited. Nothing
  is saved in the person's browser until they press "Enregistrer dans mes clips" (Save to my
  clips).
- The JSON may be written as it is or percent-encoded. `clip=` must come **last**: everything after
  it is the clip.
- Optional settings come before it, in any order:
  - `avatar=strobi` shows the clip on that avatar, by the name of its file in
    https://avatars.bible-strong.app/llms.txt (`strobi`, `freddy`, `citrus`…). Without it the
    Studio keeps the avatar the person last chose, Strobi in a browser that never chose one.
  - `view=frames` opens the frame sheet instead of the timeline.
  - `fps=12|24|30|60` sets the sheet's rate (30 when left out).

  `https://avatars.bible-strong.app/#avatar=strobi&view=frames&fps=12&clip={...}`

- While the draft is open, **every change made in the Studio rewrites the address** (about 0.3 s
  after the last change), with the avatar shown and the view. The address is always the current
  clip: read it back to see what the person changed, and write a new one to change the clip. In
  the same tab, a new fragment is taken up at once, without reloading.
- Right after opening, the Studio rewrites the address once even if nothing changed: it writes
  the clip in its own key order and encoding, and adds `avatar=`. **Compare clips as parsed JSON,
  never as text**, to tell an edit from this rewrite.

### Checking a clip

Opening the link checks it. A clip that is not valid does not open, and the Clips tab shows the
first problem found, as a path and a message; the element `[data-link-problem]` holds it, for
example `tracks.rotation[2].v: expected 3 numbers`. If you have a JSON Schema validator (draft
2020-12) at hand, the schema above checks the same rules; nothing needs to be installed to use the
Studio's check.

The fragment never reaches a server. A clip of a few seconds is a few kilobytes: links fit.

## Looking at your work: the frame sheet

You cannot watch an animation in a screenshot. The **sheet** (`view=frames`, or "Planche" in the
editor) draws the avatar at every frame of the clip, side by side, numbered with their time, then
the curve of every track. One screenshot shows the whole clip:

- **Poses**: the anticipation before a move, the stretch while it goes, the squash when it lands.
- **Spacing**: frames close together are slow, frames far apart are fast. An ease-out move has
  its frames spread at the start and packed at the end.
- **Faces**: each frame is drawn with the face it shows at that time, blends included.

12 frames per second is enough to judge timing and keeps the sheet small; use 24 or 30 to check a
quick move. The sheet plays the clip from its start as the stage does when the clip goes round:
the clip's first face is already on at frame 1. (Started fresh after another clip, the eyes blend
into that first face over 0.28 s; a loop never shows it.) Dashed lines in every cell mark where
the middle of the body is at rest: a body that rises or slides shows against them.

**Take a screenshot you can read.** The sheet sits in the Studio's side panel, which scrolls, with
a player bar over its bottom edge. A small window gives cells a few pixels wide, and a sheet
taller than the window loses its last rows under the bar. What works, with Playwright:

```python
page = browser.new_page(viewport={"width": 1500, "height": 3200}, device_scale_factor=2)
page.goto(link)  # a link with view=frames
page.wait_for_selector("[data-sheet] [data-frame]")
page.locator("[data-sheet]").screenshot(path="sheet.png")
```

Raise the height for a long clip at a high rate. The cells are `[data-sheet] [data-frame]`; each
carries `data-frame` (its number from 1), `data-time` (seconds) and `data-face`, whatever the
language of the page.

## The format

```json
{
  "name": "Hop",
  "duration": 1.2,
  "squashAnchor": -1,
  "workArea": { "start": 0, "end": 1.2 },
  "tracks": {
    "position": [
      { "t": 0, "v": [0, 0], "ease": [0.42, 0, 0.58, 1] },
      { "t": 0.6, "v": [0, 0.2] }
    ],
    "expression": [{ "t": 0, "v": "neutral" }]
  }
}
```

| Field          | Meaning                                                                                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Any text. It may not be the name of a catalogue clip (`Idle_A`, `Done_B`…); the Studio numbers it if it is taken.                                                                                                                                                                                                           |
| `duration`     | Length in seconds, above 0 (catalogue clips last 1.4 to 10 s).                                                                                                                                                                                                                                                              |
| `squashAnchor` | Which point stays in place when the body is stretched: `0` its centre (default), `-1` its base. Use `-1` for anything that touches the ground.                                                                                                                                                                              |
| `workArea`     | `start` is the time of the clip's **rest pose** (see Joins and loops); it defaults to 0. `end` is not used: a clip goes round at `duration`. Set `end` to the duration, or leave `workArea` out.                                                                                                                            |
| `tracks`       | The tracks the clip moves. A track left out is not moved: the body stays at rest on it (and keeps its zoom).                                                                                                                                                                                                                |
| `body`         | The body the clip was drawn for (`sphere`, `clover`…). Informative: every avatar plays every clip. Catalogue clips carry it; you may leave it out.                                                                                                                                                                          |
| `inspect`      | `{ "bias": -1…1, "follow": true }`. Only matters while the face is `inspecting`, which draws one eye larger than the other: with `follow: true` the larger eye is the one the head turns toward, else `bias` sets it (−1 the eye on the left of the screen, 1 the one on the right). Leave it out unless you use that face. |

### Keys

Every track is a list of keys in time order:

```json
{ "t": 0.4, "v": [0, 12, 0], "ease": [0.34, 1.56, 0.64, 1] }
```

- `t`: the time in seconds, from 0 to `duration`.
- `v`: the value, a list of 1 to 3 numbers depending on the track.
- `ease`: the curve **from this key to the next one**, a CSS-style cubic Bézier `[x1, y1, x2, y2]`.
  `x1` and `x2` must be between 0 and 1; `y1` and `y2` may leave 0…1, which overshoots. Left out,
  the passage is linear. The last key's `ease` is never used.
- Before the first key the first value holds; after the last key the last value holds. A hold is
  two keys with the same value.

### Tracks and units

Axes: **x to the right, y up**, angles in degrees. Ranges are those the catalogue uses: go past
them on purpose, not by accident.

| Track        | `v`                   | Rest        | Unit and direction                                                                                                                                             | Catalogue range                                  |
| ------------ | --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `position`   | `[x, y]`              | `[0, 0]`    | Body radii. +x right, **+y up**.                                                                                                                               | x −0.25…0.16, y −0.22…0.27                       |
| `rotation`   | `[x, y, z]`           | `[0, 0, 0]` | Degrees. +x looks **down** (nod), +y turns toward the **right of the screen**, +z rolls **counterclockwise**. Full turns are kept: 360 is a whole turn, not 0. | x −30…30 (−367 for a flip), y −360…720, z −36…36 |
| `squash`     | `[sx, sy]`            | `[1, 1]`    | Stretch across and up. Keep `sx·sy` near 1 so the body keeps its volume.                                                                                       | 0.88…1.12                                        |
| `scale`      | `[zoom]`              | `[0.6]`     | Drawn size. Clamped to 0.25…2.5. Without a `scale` track the zoom stays as it was.                                                                             | 0.42…0.64                                        |
| `lids`       | `[closed]`            | `[0]`       | 0 open, 1 closed. Only shows on the faces that can blink: `neutral`, `surprised`, `inspecting`.                                                                | 0…1                                              |
| `eyeSize`    | `[size]`              | `[1]`       | The size of both eyes against what the face and the character make them, about their own place. Clamped to 0.2…3. Works on every face.                         | not used (new); 1.3–1.6 pops, 0.7–0.8 shrinks    |
| `opacity`    | `[shown]`             | `[1]`       | 0 gone, 1 whole: the avatar fades as one, parts and spinner included.                                                                                          | not used (new)                                   |
| `expression` | a face name (no list) | `neutral`   | The face from that time on. Keys have no `ease`.                                                                                                               | —                                                |

Faces: `neutral`, `happy`, `surprised`, `sad`, `sleepy`, `squinted`, `calm`, `inspecting`
(also written `inspect`), `confused`. `blink` is not a face: it closes and opens the eyes once
(0.26 s). Only `neutral`, `surprised` and `inspecting` can blink or be closed by `lids`; on
`happy`, `sad`, `sleepy`, `squinted`, `calm` and `confused` the eyes stay as the face draws them.
The engine also reads a few aliases the catalogue uses:
`strange` (inspecting), `thinking` (sad), `angry` and `idle` (neutral), `squint`, `smile`,
`sleep`. Any other name falls back to `neutral`; the schema refuses it.

How faces behave:

- A change of face is a blend of **0.28 s**. Put the key a little before the move it goes with.
- Faces are not part of the loop check: a clip that ends on another face than it starts goes
  round at once, and the eyes blend back to the first face as the clip asks for it again. Put a
  face key at 0 so that every round starts on the face you mean.
- A face change asked during a blink waits for the eyes to open.
- `cut` on a face key is accepted and kept, but the engine does not use it: every change blends.

## Joins and loops

- **Loops.** A clip plays round and round. At its end, if the body is not back near the pose at
  `workArea.start` (within 4° on each axis, counting whole turns as nothing, 0.015 in position,
  0.02 in squash, zoom, opacity and eye size, 0.05 in lids), the engine first leads it back there in 0.35 s, which
  shows as a slide. **End where you started** for a seamless loop; a rotation that ends at 360
  ends where 0 started.
- **Joins.** From another clip, the engine leads the body in 0.35 s to the pose the clip has at
  `workArea.start`, then starts the clip at its beginning. Keep `start` at 0 unless the clip's
  first moment is mid-move.

## Easing presets

| Name        | `ease`                    | Feel                                        |
| ----------- | ------------------------- | ------------------------------------------- |
| Linear      | `[0, 0, 1, 1]`            | Mechanical. Fine for a constant spin.       |
| Ease in-out | `[0.42, 0, 0.58, 1]`      | The catalogue's default for a soft move.    |
| Ease out    | `[0, 0, 0.58, 1]`         | Starts fast, settles. Reactions, landings.  |
| Ease in     | `[0.42, 0, 1, 1]`         | Starts slow, leaves fast. Take-offs, falls. |
| Sine in-out | `[0.37, 0, 0.63, 1]`      | Gentle sway, breathing.                     |
| Cubic out   | `[0.33, 1, 0.68, 1]`      | Snappy start, long settle.                  |
| Cubic in    | `[0.32, 0, 0.67, 0]`      | Gravity: a body falling.                    |
| Quint out   | `[0.22, 1, 0.36, 1]`      | Very snappy pop.                            |
| Expo in-out | `[0.87, 0, 0.13, 1]`      | Holds, then whips across, then holds.       |
| Back out    | `[0.34, 1.56, 0.64, 1]`   | Overshoots its target, then comes back.     |
| Back in     | `[0.36, 0, 0.66, -0.56]`  | Pulls back before it goes: anticipation.    |
| Back in-out | `[0.68, -0.6, 0.32, 1.6]` | Both.                                       |

The Studio also offers the Quad, Quart and Circ families (in, out, in-out) from easings.net.

## Making it feel alive

The principles of animation, on these tracks:

- **Anticipation.** Before a move, a small move the other way: crouch (`squash` `[1.12, 0.86]`
  with `squashAnchor: -1`) before a hop, turn a few degrees left before turning right, lean back
  (`rotation` x −6) before a nod.
- **Squash and stretch.** Stretch along the direction of a fast move (`[0.9, 1.12]` going up),
  squash on impact (`[1.15, 0.85]`), and come back to `[1, 1]` with a little overshoot.
- **Overshoot and settle.** Arrive past the target and come back: `Back out`, or one more key
  just past the value followed by the value.
- **Offset tracks (follow-through).** Do not key everything on the same frames. Let rotation lead
  or trail position by 0.05 to 0.1 s; let the squash recover a beat after the landing.
- **Timing.** Fast parts are short: an impact squash lasts 0.06 to 0.12 s, a blend of face 0.28 s.
  Holds give a move room to read: 0.2 to 0.5 s of stillness between beats.
- **Restraint.** The catalogue's amplitudes are small. A roll of 10 to 20°, a hop of 0.2 radii
  and a squash of 12 % already read strongly.
- **Eyes react before the body.** Pop them (`eyeSize` 1.4 for 0.1 s, then back with Back out) for
  a surprise, squeeze them (0.75) the instant before an impact. A short change reads; a held one
  looks like another character.
- **Fade instead of teleporting.** To leave or come back, ramp `opacity` over 0.15–0.3 s rather
  than jumping the body from one place to another in a single frame. A loop must end at the
  opacity it starts with.
- **Faces carry intent.** Change the face just before the body acts on it: `happy` as the hop
  starts, `surprised` on the impact.

## A complete example: a happy hop

```json
{
  "name": "Happy hop",
  "duration": 1.3,
  "squashAnchor": -1,
  "workArea": { "start": 0, "end": 1.3 },
  "tracks": {
    "position": [
      { "t": 0, "v": [0, 0] },
      { "t": 0.22, "v": [0, 0], "ease": [0.33, 1, 0.68, 1] },
      { "t": 0.52, "v": [0, 0.22], "ease": [0.32, 0, 0.67, 0] },
      { "t": 0.78, "v": [0, 0] }
    ],
    "squash": [
      { "t": 0, "v": [1, 1], "ease": [0.42, 0, 0.58, 1] },
      { "t": 0.22, "v": [1.12, 0.86], "ease": [0.33, 1, 0.68, 1] },
      { "t": 0.32, "v": [0.92, 1.1], "ease": [0.45, 0, 0.55, 1] },
      { "t": 0.52, "v": [1, 1], "ease": [0.45, 0, 0.55, 1] },
      { "t": 0.74, "v": [0.95, 1.06], "ease": [0, 0, 0.58, 1] },
      { "t": 0.82, "v": [1.14, 0.86], "ease": [0.34, 1.56, 0.64, 1] },
      { "t": 1.05, "v": [1, 1] }
    ],
    "rotation": [
      { "t": 0, "v": [0, 0, 0], "ease": [0.45, 0, 0.55, 1] },
      { "t": 0.22, "v": [8, 0, 0], "ease": [0.33, 1, 0.68, 1] },
      { "t": 0.52, "v": [-6, 0, 0], "ease": [0.45, 0, 0.55, 1] },
      { "t": 0.84, "v": [5, 0, 0], "ease": [0.45, 0, 0.55, 1] },
      { "t": 1.1, "v": [0, 0, 0] }
    ],
    "expression": [
      { "t": 0, "v": "neutral" },
      { "t": 0.16, "v": "happy" },
      { "t": 1.08, "v": "neutral" }
    ]
  }
}
```

It crouches and looks down (0–0.22 s), launches fast and slows at the top (Cubic out), falls with
gravity (Cubic in), stretches on the way down, squashes on landing and overshoots back to round
(Back out), nods slightly forward on the impact, and ends at rest, so that it loops cleanly. Its
link, on Strobi, with the sheet at 12 frames per second:

```
https://avatars.bible-strong.app/#avatar=strobi&view=frames&fps=12&clip=<the JSON above>
```

## A working loop with the person

1. Read the clips of the catalogue closest to the request; reuse their amplitudes and timing.
2. Write the clip and open its link with `avatar=…&view=frames`. If it does not open, read
   `[data-link-problem]`, fix and reopen.
3. Capture the sheet (see above) and look: poses, spacing, faces, and whether the last frame
   meets the first. Fix and reopen; two to four rounds are usual.
4. Hand the link to the person. They edit in the Studio; the address follows their changes.
5. To go on from their version, read the clip back from the address (or ask them to paste it),
   change it, and write the new link.

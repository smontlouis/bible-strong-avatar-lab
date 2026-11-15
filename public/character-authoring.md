# Writing a character for the Bible Strong Avatar Studio

A **character** is what an avatar is, apart from what it does: a primary body that carries the
face, up to 16 parts set around it, its colours, an optional outline, the build of its eyes, an
optional nose and mouth, and its perspective. Every character plays the same clips, states and
faces, so a character holds no motion. This page gives the file format with every rule the
Studio and the packages apply, how to hand a character to the Studio through a link, and how to
look at it from every side before you hand it over.

- Studio: https://avatars.bible-strong.app/
- JSON Schema of a character (draft 2020-12):
  https://avatars.bible-strong.app/schema/avatar-character.json
- The Studio's ten characters, to learn from: listed in https://avatars.bible-strong.app/llms.txt
  (`/characters/strobi.avatar.json`, `/characters/freddy.avatar.json`…)
- Showing a character in an app: the package guides listed in llms.txt.

## Handing a character to the Studio: the link

```
https://avatars.bible-strong.app/#character={"name":"Fox","body":{...},"colors":{...},"face":{...}}
```

- Opening the link opens the Avatars tab with the character as a **draft**: a new avatar, marked
  "brouillon", shown on the stage, with its **sheet**. Nothing is saved until the person presses
  "Enregistrer dans mes avatars" (Save to my avatars). The person's other avatars are not touched.
- `character=` must come last: everything after it is the JSON, as it is or percent-encoded.
- While the Avatars tab shows the draft, every change made in the Studio (body, parts, colours,
  face) rewrites the address about 0.3 s later; a new address written in the same tab replaces
  the draft at once.
- A character that does not open shows its first problem in the Avatars tab, in the element
  `[data-link-problem]`, as a JSON Pointer and a message, for example
  `/colors/body: must match pattern "^#[0-9a-f]{6}$"`.
- **The Studio rewrites what it reads.** Right after opening, the address holds the character as
  the Studio keeps it. Compare as parsed JSON, and expect these changes:
  - `face.eyes.height` becomes `face.eyes.width`: the Studio keeps one eye size.
  - `face.eyes.width` and `gap` are brought within 0.6…1.6, and `perspective` within 0…1.5.
  - `face.nose` and `face.mouth` are always written, with `enabled: false` when there is none.
  - Colours are written in lowercase, and node turns within ±360.

Once saved, the avatar plays every clip and state; a clip or a state link with
`avatar=<its name in lowercase, dashes for the rest>` (`avatar=pip`) shows them on it.

## Looking at your work: the character sheet

The Avatars tab shows the **sheet** of the avatar shown (`[data-character-sheet]`): the character
from the front, three quarters right, right profile, back, left profile, three quarters left,
from above and from below (`[data-view="front"]`, `three-quarter-right`, `right`, `back`, `left`,
`three-quarter-left`, `from-above`, `from-below`), its silhouette all in one colour from the
front and three quarters (`silhouette`, `silhouette-three-quarter`), then with each of the nine
faces (`[data-face="happy"]`…). "Right profile" is the character turned a quarter toward the right
of the screen (its face points right); "left profile" toward the left. A dashed square marks the
view box, −150…150: what goes past it may be cut in an app. Nothing checks it for you: look.

Clips turn an avatar all the way round (whole turns about y, and about x), so every side is seen.
Check on the sheet that the parts stay attached from every side, that nothing in front covers the
eyes, that the face reads with every expression, and that the silhouette stays inside the square.
Capture it at a readable size:

```python
page = browser.new_page(viewport={"width": 1500, "height": 2400}, device_scale_factor=2)
page.goto(link)
page.wait_for_selector("[data-character-sheet] [data-view]")
page.locator("[data-character-sheet]").screenshot(path="sheet.png")
```

To see it move, open a clip or state link on it once it is saved, with `view=frames`.

## The file

```json
{
  "name": "Fox",
  "body": {
    "primary": { "type": "sphere", "width": 220, "height": 200, "depth": 200, "roundness": 1 },
    "nodes": []
  },
  "colors": { "body": "#e8742f", "eyes": "#1b1410" },
  "style": { "outline": { "enabled": true, "color": "#3a1d0b", "width": 4, "opacity": 1 } },
  "face": {
    "eyes": { "width": 0.85, "height": 0.85, "gap": 1.15, "shiftY": -0.1 },
    "nose": {
      "enabled": true,
      "shape": "inverted-triangle",
      "roundness": 60,
      "width": 18,
      "height": 13,
      "x": 0,
      "y": 30,
      "angle": 0
    },
    "mouth": {
      "enabled": true,
      "shape": "curve",
      "curve": 45,
      "width": 22,
      "height": 5,
      "x": 0,
      "y": 48,
      "angle": 0
    },
    "perspective": 1
  }
}
```

This file shows every field. The Studio's own characters leave out the outline, the nose and the
mouth (see the house style below).

**Every object refuses keys it does not know.** Nothing is filled in by the reader.

| Path                      | Rule                                                                                                                                | Required           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `name`                    | text, up to 120 characters; in links the avatar is named by it in lowercase, every other character a dash (`Grok bot` → `grok-bot`) | no                 |
| `body.primary`            | a surface (below): the shape that carries the face                                                                                  | yes                |
| `body.nodes`              | a list of parts, at most 16                                                                                                         | **yes, even `[]`** |
| `colors.body`             | the head, every part without its own colour, the spinner                                                                            | yes                |
| `colors.eyes`             | fills the eyes, the nose **and** the mouth                                                                                          | yes                |
| `style.outline`           | `{ enabled, color, width 0…24, opacity 0…1 }`, all four when present                                                                | no                 |
| `face.eyes`               | `{ width 0.1…4, height 0.1…4, gap 0…4, shiftY −1…1 }`, all four                                                                     | yes                |
| `face.nose`, `face.mouth` | below; absent means none                                                                                                            | no                 |
| `face.perspective`        | 0…10 in the file; use 0…1.5                                                                                                         | yes                |

Colours are `#` and six **lowercase** hex digits: `#e8742f`. `#E8742F` and `#fff` are refused.

## The drawing space

- Lengths are drawing units. The view box is −150…150 on both axes, the origin is the middle of
  the primary body at rest.
- **x points right, y points down, z points toward the viewer.** (Clips use y up; characters, like
  SVG, use y down.)
- A surface's `width`, `height` and `depth` are its full extents along x, y and z: a sphere 240
  wide has a radius of 120.
- Keep the resting silhouette within about ±130, a margin inside the ±150 view box that is advice,
  not a rule: clips move the body up to 0.27 body radii, zoom
  it up to 1.07× and stretch it up to 1.12×.

## Surfaces: the primary and the parts

```json
{
  "type": "cone",
  "width": 70,
  "height": 95,
  "depth": 40,
  "roundness": 0,
  "morphRoundness": 0,
  "tipRoundness": 0.6,
  "baseRoundness": 0
}
```

`type`, `width`, `height`, `depth` (each above 0) and `roundness` (0…5) are required. The other
keys are optional, accepted on any type, and read only by the types below.

| type        | shape                                                                         | reads                                                                                                                                                                                                                       | preset (w × h × d, roundness)             |
| ----------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `sphere`    | an ellipsoid; round only when width = height = depth                          | width, height, depth                                                                                                                                                                                                        | 240 × 240 × 240                           |
| `capsule`   | two round caps joined by a straight part                                      | width, height, depth                                                                                                                                                                                                        | 205 × 270 × 205                           |
| `cube`      | a box from sharp (`roundness` 0) to an ellipsoid (2)                          | roundness 0…2                                                                                                                                                                                                               | 220 × 220 × 200, 0                        |
| `diamond`   | an octahedron from sharp (0) to an ellipsoid (2)                              | roundness 0…2                                                                                                                                                                                                               | 235 × 260 × 215, 0                        |
| `cylinder`  | an upright cylinder                                                           | `roundness` rounds the cap edges (keep ≤ 2: above ≈ 2.27 the profile folds); `morphRoundness` 0…2 blends it toward an ellipsoid                                                                                             | 235 × 250 × 215, 0.45, morph 0            |
| `cone`      | **tip up** (at −height/2), base down                                          | `tipRoundness` 0…2, `baseRoundness` 0…2, `morphRoundness` 0…2 blends toward an ellipsoid (0 a cone, about 1 a drop, 2 an egg; with `tipRoundness` and `baseRoundness` near 1–2, a lemon or a rice ball); `roundness` unused | 250 × 265 × 225, all 0                    |
| `trapezoid` | a tapered rounded box                                                         | `topScale` and `bottomScale` 0.05…1.5 (width at the top and the bottom), roundness 0…5 (angular to round)                                                                                                                   | 210 × 205 × 185, 0, top 0.82, bottom 1.08 |
| `mickey`    | an ellipsoid with two round ears, always behind; **primary only**             | width, height, depth                                                                                                                                                                                                        | 220 × 210 × 145                           |
| `cursor`    | a pointer: a cone on a short cylinder that carries the face; **primary only** | width, height, depth, roundness (cylinder edges)                                                                                                                                                                            | 175 × 260 × 145, 0                        |

Sizes the Studio offers: a primary 120…300 wide and high, 100…300 deep; a part 10…300 on each axis.
A part may not be `mickey` or `cursor`.

## Parts (`body.nodes`)

```json
{
  "color": "#fff4e6",
  "followsHead": true,
  "surface": { "type": "sphere", "width": 120, "height": 80, "depth": 90, "roundness": 1 },
  "position": [0, 75, 55],
  "rotation": [0, 0, 0]
}
```

Exactly these five keys; `color` and `followsHead` are optional. No `id` or `name`.

- **`position`** is the part's centre, in drawing units, in the head's own frame (x right, y down,
  z toward the viewer), each −10000…10000. A part follows the head's turns as one object.
- **`rotation`** is in degrees, each −360…360, about the part's own centre, applied y first, then
  x, then z.
  - `+z` tips the part's top to the right: clockwise on screen. A left ear at negative x leans out
    with a negative z (−18); a right ear with a positive z.
  - `+y` swings the part's front to the right of the screen.
  - `+x` tips the part's top away from the viewer.
  - A cone points up: lean it with z, point it at the viewer with x −90.
- **`color`**: the part's own colour; without it, the body's.
- **`followsHead: false`**: the part keeps its place and turn while the head turns (it still moves,
  zooms and stretches with the body). For a stand, a base, a shadow the head spins over.

### In front or behind

- A part **without a colour of its own** (or of the body's colour) is drawn whole, behind the head,
  unless its centre is clearly in front: z above a tenth of its half-depth. z 0 is behind.
- A part **of another colour** is cut where it sinks into the head: a muzzle at z 55 shows only
  the part that sticks out of the face.
- Parts are layered against each other whole, by the depth of their centres: the nearer centre is
  drawn over. Against the head, a part of its own colour behind the head shows only where it
  reaches out of the head's outline.
- **A part laid on another** (an inner ear on an ear, a spot on a tail): same place, a centre a
  few units nearer than the part under it, smaller and thinner so that it stays inside it. Pip's
  inner ears: cones 48 × 62 × 14 at z −8 on ears 84 × 106 × 32 at z −16. At z −4 they vanished, at
  z +4 only a sliver showed: try a few depths and look at the sheet.
- **Parts of the body's colour merge into the head** where they overlap it, since nothing draws
  a line between them unless the character has an outline. Such a part reads only where it sticks
  out of the silhouette: a tail tucked behind the head disappears in profile, and a tip of another
  colour left on it looks like a floating dot. Let it reach out, or give it a colour.
- **Parts in front are drawn over the eyes, the nose and the mouth.** Keep them below the face, or
  behind.
- From behind (clips spin the avatar), parts behind the head come to the front: make them read
  from every side.

## The face

The eyes are not drawn by the character: their shapes come from the nine faces every avatar
shares. The character scales and places them.

- **Unit**: the face radius `r = min(primary width, primary height) / 2`. A wide, low body gets
  small eyes: keep the primary's width and height comparable, or raise the eye size.
- **`face.eyes`**
  - `width`, `height`: the size against the standard eye (0.26 r wide, 0.57 r tall). The Studio
    keeps them equal and within 0.6…1.6.
  - `gap`: the distance between the eyes against the standard one (eyes at ±0.32 r at 1). Studio:
    0.6…1.6.
  - `shiftY`: moves the eyes down by `shiftY · r` (**positive is down**). Eyes are clipped to the
    head: at −1 they are gone. On a cone, whose top narrows, lower them (+0.18 to +0.2).
- **`face.nose`**: `{ "enabled", "shape", "roundness"?, "width", "height", "x", "y", "angle" }`.
  - Shapes: `inverted-triangle` (point down; `roundness` 0…100 rounds its corners, 50 by default),
    `ellipse`, `rounded` (a pill).
  - Defaults when a key is missing at draw time: 14 × 11 at y 22.
- **`face.mouth`**: `{ "enabled", "shape", "curve", "width", "height", "x", "y", "angle" }`, all
  required.
  - Shapes: `curve` (a band; its middle dips by `curve`/100 × width × 0.28, positive is a smile),
    `ellipse` (an "o"), `rounded` (a pill), `rounded-triangle` (drawn sharp, point up: an open "D").
  - Faces bend a `curve` mouth toward a smile or a frown (`happy` up, `sad` down); other shapes
    never bend.
  - Defaults: `curve` 45, 20 × 6 at y 35.
- **Nose and mouth units are fixed**, measured on a head of radius 120 whatever the body's size,
  y down from the middle, `angle` clockwise in degrees: on a smaller head, scale them by hand.
- `colors.eyes` fills the eyes, the nose and the mouth alike.
- **`face.perspective`**: how much nearer things look bigger. 0 draws everything at one size
  (Grok bot); 1 is the usual view (the front of a 240 sphere is shown 1.24× larger). Past 1.5 the
  picture distorts, and at high values it breaks. Use 0…1.5.
- **`style.outline`**: a line around the head and every part, never on the face. The Studio offers
  widths 0.5…12.

## The Studio's characters

All ten keep eyes at width, height and gap 1, no nose, no mouth and no outline, and every part sits
behind the head. Read their files from llms.txt; how they are built:

| Character | Built as                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strobi    | a sphere 240, blue `#5b7fe5`, nothing else                                                                                                         |
| Freddy    | a rounded cube (roundness 0.76) with two flat round ears (spheres 82 wide, 38 deep) at `[±82, −72, −18]` and a cylinder tuft; white eyes on orange |
| Citrus    | a cone rounded into a lemon drop (morph 1.15, tip 0.74, base 1.34), eyes lowered (`shiftY` +0.18)                                                  |
| Nova      | a capsule                                                                                                                                          |
| Grok bot  | a black sphere with white eyes, perspective 0                                                                                                      |
| Sunee     | a flat disc (sphere 183 × 186 × 100) with eight flat round rays on a ring of radius 135                                                            |
| Kirby     | a pink sphere with two flattened-sphere feet at `[±100, 31, −10]`, turned ±15° about z                                                             |
| Cloudee   | a sphere 160 with four overlapping puffs behind it                                                                                                 |
| Cubee     | a rounded cube (0.73)                                                                                                                              |
| Onee      | a cone rounded into a rice ball (morph 1.2, tip 2, base 2), eyes lowered (+0.2)                                                                    |

Lessons: ears, puffs and rays are **flattened spheres** (depth 0.4–0.5 × width) a little
**behind** the head (z −10 to −20), so they read as a silhouette from the front and do not cover
the face. White eyes work on a dark or warm body.

## What breaks a character

| You see                       | Because                                                                                                               | Do                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| The link is refused           | an unknown key, an uppercase colour, a part with `id`, `mickey` as a part, 17 parts, a turn past 360, no `body.nodes` | follow the table above                                           |
| Eyes cut or gone              | `shiftY` too far, eyes too big for the head                                                                           | keep \|shiftY\| + 0.29 × eye height under about 0.75 on a sphere |
| Tiny eyes                     | a primary much wider than high (or the reverse)                                                                       | comparable width and height, or bigger eyes                      |
| Face covered                  | a part in front of the face                                                                                           | move it below the face or behind (negative z)                    |
| A part never comes in front   | no colour of its own and z near 0                                                                                     | give it a clearly positive z, or a colour                        |
| A part floats                 | nothing ties a part to the head                                                                                       | keep it overlapping the head                                     |
| Nose and mouth too big        | they are measured on a head of radius 120                                                                             | scale them with the head                                         |
| Stretched or exploded picture | perspective too high                                                                                                  | 0…1.5                                                            |
| Cut at the edges in an app    | parts past ±150                                                                                                       | keep the silhouette within ±130                                  |

## The house style

The Studio's characters share one look, and "in the style of the other avatars" means it:

- **the standard eyes** (`width`, `height` and `gap` 1), slightly raised or lowered to suit the
  body, which carry every expression;
- **no nose, no mouth, no outline**: flat shapes of solid colour;
- **soft, rounded shapes** and **flattened parts behind the head** that make the silhouette;
- **one body colour and at most one or two accents** (a muzzle, inner ears, a tip), and dark eyes
  on a light body or white eyes on a dark one.

A nose, a mouth and an outline exist for characters that leave the house style on purpose.

## Making a good character

- **Start from a primary that already reads**: a sphere for a face, a rounded cube for a sturdy
  creature, a cone for anything that narrows at the top, a capsule for a tall one.
- **Add the few parts that say what it is**: ears for an animal, a tuft, petals, feet. Two to six
  parts are usually enough; the built-ins use 0 to 8.
- **Silhouette first**: parts behind the head, flattened, reaching out of its outline. Check the
  silhouette cells of the sheet: you should recognise the character in black.
- **Two or three colours**: the body, one accent part (a muzzle, a belly, a tuft), and the eyes.
- **Keep the face clear** and in proportion: the standard eyes, a small nose and mouth if any,
  scaled to the head.
- **Check every side** on the sheet: from behind, from above, and with every face.

## A complete example: a fox in the house style

```json
{
  "name": "Pip",
  "body": {
    "primary": {
      "type": "sphere",
      "width": 214,
      "height": 202,
      "depth": 200,
      "roundness": 1
    },
    "nodes": [
      {
        "surface": {
          "type": "cone",
          "width": 84,
          "height": 106,
          "depth": 32,
          "roundness": 0,
          "morphRoundness": 0.25,
          "tipRoundness": 0.45,
          "baseRoundness": 0.4
        },
        "position": [-62, -86, -16],
        "rotation": [0, 0, -22]
      },
      {
        "surface": {
          "type": "cone",
          "width": 84,
          "height": 106,
          "depth": 32,
          "roundness": 0,
          "morphRoundness": 0.25,
          "tipRoundness": 0.45,
          "baseRoundness": 0.4
        },
        "position": [62, -86, -16],
        "rotation": [0, 0, 22]
      },
      {
        "color": "#ffe9d4",
        "surface": {
          "type": "cone",
          "width": 48,
          "height": 62,
          "depth": 14,
          "roundness": 0,
          "morphRoundness": 0.25,
          "tipRoundness": 0.45,
          "baseRoundness": 0.4
        },
        "position": [-62, -92, -8],
        "rotation": [0, 0, -22]
      },
      {
        "color": "#ffe9d4",
        "surface": {
          "type": "cone",
          "width": 48,
          "height": 62,
          "depth": 14,
          "roundness": 0,
          "morphRoundness": 0.25,
          "tipRoundness": 0.45,
          "baseRoundness": 0.4
        },
        "position": [62, -92, -8],
        "rotation": [0, 0, 22]
      },
      {
        "color": "#ffe9d4",
        "surface": {
          "type": "sphere",
          "width": 78,
          "height": 56,
          "depth": 60,
          "roundness": 1
        },
        "position": [-25, 64, 66],
        "rotation": [0, 0, 8]
      },
      {
        "color": "#ffe9d4",
        "surface": {
          "type": "sphere",
          "width": 78,
          "height": 56,
          "depth": 60,
          "roundness": 1
        },
        "position": [25, 64, 66],
        "rotation": [0, 0, -8]
      },
      {
        "surface": {
          "type": "cone",
          "width": 72,
          "height": 112,
          "depth": 54,
          "roundness": 0,
          "morphRoundness": 1.2,
          "tipRoundness": 1,
          "baseRoundness": 1.4
        },
        "position": [80, 78, -60],
        "rotation": [0, 0, 68]
      },
      {
        "color": "#ffe9d4",
        "surface": {
          "type": "sphere",
          "width": 36,
          "height": 36,
          "depth": 30,
          "roundness": 1
        },
        "position": [118, 62, -62],
        "rotation": [0, 0, 0]
      }
    ]
  },
  "colors": {
    "body": "#f2873f",
    "eyes": "#2b1a12"
  },
  "face": {
    "eyes": {
      "width": 1,
      "height": 1,
      "gap": 1,
      "shiftY": -0.08
    },
    "perspective": 1
  }
}
```

Pip is a sphere a little wider than high, with:

- two cone ears behind the head (z −16), rounded at the tip and the base, leaning out (z −22 /
  +22), each with a smaller cream inner ear laid on it (z −8, see "A part laid on another");
- two overlapping cream cheek patches of their own colour in front (z 66), sunk into the bottom of
  the face, below the eyes: they read as a white muzzle;
- a tail of the body's colour behind the head, low and turned (z 68°), that flicks out at the
  lower right, with a cream tip at the edge of the silhouette;
- the standard eyes raised a little (`shiftY` −0.08), no nose, no mouth, no outline.

It took six looks at the sheet: the ears first hid behind the head, the inner ears vanished, the
cheeks first stuck out like mittens, and the tail disappeared into the head in profile until it
reached out of the silhouette. Its link:

```
https://avatars.bible-strong.app/#character=<the JSON above>
```

## A working loop with the person

1. Read two or three of the Studio's characters closest to the request.
2. Write the character and open its link. If it does not open, read `[data-link-problem]`.
3. Capture the sheet and look at every side and every face. Fix and reopen.
4. Hand the link to the person; they adjust it in the Studio (Avatars → Modifier) and the address
   follows. Once saved, show it moving with a clip or state link and `avatar=pip`.

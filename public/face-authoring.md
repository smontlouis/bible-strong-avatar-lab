# Writing a face for the Bible Strong Avatar Studio

A **face** is the shape of the eyes. Nine faces are built in (`neutral`, `happy`, `surprised`,
`sad`, `sleepy`, `squinted`, `calm`, `inspecting`, `confused`). A **drawn face** is one more,
made the way a designer draws in a vector tool: each eye is a few **marks**, paths that are
filled, stroked, or both. A star with rounded points, crossed eyes for a knocked-out avatar, a
ring, a heart: anything one colour can draw. This page gives the format, how to hand a face to the
Studio through a link, how to check it, and how an app gets it.

- Studio: https://avatars.bible-strong.app/ (tab Visages / Faces). Its artboard is a small vector editor
  (points and handles, corner, smooth or symmetric points, a pen, zoom) for the person; an agent
  writes the JSON or an SVG file instead.
- JSON Schema of a face: https://avatars.bible-strong.app/face.schema.json
- Writing a clip, whose face keys can name a drawn face: https://avatars.bible-strong.app/clip-authoring.md
- Writing a state, which can hold one: https://avatars.bible-strong.app/state-authoring.md
- Everything else for agents: https://avatars.bible-strong.app/llms.txt

## The artboard

Each eye is drawn on an artboard of **100 by 100**, in SVG's coordinates: x to the right, **y
down**. Its middle, **(50, 50), is where the eye sits** on the face. The artboard is 0.6 head
radii wide: the built-in `neutral` eye is about 43 wide and 95 tall on it (a capsule from y 26.5
to 73.5, 43 thick).

- **Size.** An eye about 40 to 60 wide reads like the built-in ones; one that fills the artboard
  (90 or more) is very large, and two of them come close to each other. What passes the artboard
  is drawn, not cut.
- **Which eye.** You draw the eye on the **left of the screen**, as it is seen. The right eye is its
  **mirror**: a shape that points left on the artboard (outward, away from the face's middle)
  points right on the right eye. To draw the right eye differently (a wink), give it too; it is
  drawn as seen as well, not mirrored.
- **One colour.** The eyes take the character's eye colour; colours, opacity and gradients in a
  file are not read.

## The format

```json
{
  "name": "Star",
  "blinks": true,
  "smile": 0.3,
  "eyes": {
    "left": [
      {
        "d": "M50 10L61 38L92 39L68 58L76 88L50 71L24 88L32 58L8 39L39 38Z",
        "stroke": { "width": 9, "join": "round" }
      }
    ]
  }
}
```

| Field        | What it is                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | Required. Clips and states name the face by it, **exactly** (case included). It cannot be a built-in face's name or one of their other names (`blink`, `smile`, `thinking`, `strange`, `angry`, `inspect`, `squint`, `idle`, `sleep`), whatever its case. |
| `blinks`     | Optional, `true` by default. `false` keeps the eyes open when the avatar blinks or a clip closes its lids, as `happy` does.                                                                                                                               |
| `smile`      | Optional, from -1 to 1, 0 by default. What the face asks of a mouth drawn as a line (only characters that have one): -1 corners down, 1 up.                                                                                                               |
| `eyes.left`  | Required. The marks of the eye on the left of the screen, in order.                                                                                                                                                                                       |
| `eyes.right` | Optional. The marks of the right eye, drawn as seen. Left out, the right eye mirrors the left.                                                                                                                                                            |

A **mark**:

| Field      | What it is                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `d`        | Required. SVG path data on the artboard: `M L H V C S Q T A Z`, absolute or relative, several subpaths allowed.                                                                |
| `fill`     | Optional, `true` by default. `false` draws only the stroke. A path that is not closed is filled as if it were, as in SVG.                                                      |
| `fillRule` | Optional: `nonzero` (default) or `evenodd`, as SVG's `fill-rule`. A circle inside a circle drawn the other way round, or any inner path under `evenodd`, is a hole.            |
| `stroke`   | Optional: `{ "width", "cap", "join" }`. `width` in artboard units; `cap` is `round`, `butt` (default) or `square`; `join` is `round`, `miter` (default) or `bevel`, as in SVG. |

How marks combine: they are added together, one shape in one colour. A mark drawn over a hole of
another mark fills it. The packages turn every fill and stroke into filled shapes once, when the
face is read; an eye keeps to **600 points**, and a busier one is simplified (the Studio says so).

## Three faces, ready to copy

Crossed eyes that do not blink, with a little frown:

```json
{
  "name": "knocked-out",
  "blinks": false,
  "smile": -0.3,
  "eyes": {
    "left": [
      { "d": "M28 28L72 72M72 28L28 72", "fill": false, "stroke": { "width": 14, "cap": "round" } }
    ]
  }
}
```

A ring:

```json
{
  "name": "ring",
  "eyes": {
    "left": [
      {
        "d": "M22 50A28 28 0 1 0 78 50A28 28 0 1 0 22 50Z",
        "fill": false,
        "stroke": { "width": 13 }
      }
    ]
  }
}
```

A wink: the left eye open, the right one a curved line.

```json
{
  "name": "wink",
  "blinks": false,
  "smile": 0.6,
  "eyes": {
    "left": [{ "d": "M50 26.5V73.5", "fill": false, "stroke": { "width": 43, "cap": "round" } }],
    "right": [
      { "d": "M26 58Q50 34 74 58", "fill": false, "stroke": { "width": 12, "cap": "round" } }
    ]
  }
}
```

Rounded points, as the star above: fill the shape and stroke it with `"join": "round"`. The stroke
spreads half its width beyond the path; a round join rounds every point by half the width.

## From an SVG file

A face can also be an SVG file of one eye, from Figma, Illustrator or by hand. The Studio imports
it (Faces tab, _Importer un .svg ou .face.json_), and the packages read it in a library as
`{ "name": "Star", "svg": "<svg …>…</svg>" }`.

- The file's `viewBox` (else its `width` and `height`, else what it draws) is fitted to the
  artboard, its middle on the eye's place. Draw on `viewBox="0 0 100 100"` to keep the numbers of
  this page.
- `path`, `line`, `polyline`, `polygon`, `circle`, `ellipse` and `rect` (with `rx`) are read, inside
  groups, with `transform`, `fill`, `fill-rule`, `stroke`, `stroke-width`, `stroke-linecap` and
  `stroke-linejoin`, as attributes or in `style`. `fill` is on by default, as in SVG: give
  `fill="none"` to a line meant as a stroke.
- A group `<g id="right">` is the right eye, drawn as seen; without one the right eye mirrors the
  left.
- Text, images, `<use>`, masks, filters, clip paths and gradients are not read: the Studio lists
  what it left out.

## The link

The Studio opens a face as a **draft** from a link, on the avatar the link names:

```text
https://avatars.bible-strong.app/#avatar=strobi&face={"name":"Star","eyes":{"left":[{"d":"M50 10L61 38L92 39L68 58L76 88L50 71L24 88L32 58L8 39L39 38Z","stroke":{"width":9,"join":"round"}}]}}
```

The JSON comes last and may be written as it is; spaces and `"` may be percent-encoded, and the
Studio reads a link encoded once more on the way. The face opens in the Faces tab and the stage
holds it. While it is shown, every change made by hand rewrites the address a moment later, and a
new link written into the same tab is taken up at once: an agent driving the browser and the
person work on the same draft. Nothing is kept until the person clicks _Enregistrer dans mes
visages_. A link that holds no valid face says what is wrong (`[data-link-problem]`).

## Checking a face: the sheet

Under the editor, the **sheet** of the face (`[data-face-sheet]`) shows, in one screenshot:

- the face from eight sides (`data-view`: `front`, `three-quarter-right`, `right`, `back`, `left`,
  `three-quarter-left`, `from-above`, `from-below`): the eyes lie on the head, and squeeze as it
  turns;
- the face at 40 and 24 px (`data-size`): a detail lost there is lost in an app's lists;
- the blink at 0, 35, 70 and 100 % closed (`data-lids`), or a note that the face does not blink;
- the change of face, a frame every thirtieth of a second (`data-step`, `data-face`, `data-to`):
  from `neutral` to the face, then to `happy`.

Capture it with a window 1500 px wide, after the page has settled:
`page.locator('[data-face-sheet]').screenshot()`.

## How a drawn face behaves

- **It comes and goes with a blink.** Built-in faces morph into each other; a change to or from a
  drawn face shuts the eyes on the face that leaves (0.3 s in all), meets the new shape there, and
  opens on it. A change asked for during a blink waits for the eyes to open.
- **Lids squash it.** A clip's `lids` track, or a `blink` key, closes a drawn eye by squashing it
  towards a line 40 % up its height, down to a bar as the built-in eyes close; `blinks: false`
  keeps it open.
- **`eyeSize` scales it** about the eye's place, like every face.
- **A name the avatar does not know shows `neutral`**: in an app, a clip or state that names a
  face missing from the library shows `neutral` there, and the Studio's key inspector says so.

## How an app gets it

Faces made in the Studio live in the browser of the person who saves them, like clips and states.
An app gets them through a **library**: the Export tab downloads `avatar-library.json`, every
custom clip, state and face, and the renderers take it as the `library` prop (React, React Native)
or option (web):

```tsx
import library from './avatar-library.json'

;<Avatar character={character} library={library} clip="Celebrate_Star" face="Star" />
```

A `.face.json` from the Faces tab (_Exporter_) is one face as this page describes it, to add to a
library's `faces`.

## Good faces

- **Draw on the eye's place.** Centre the eye on (50, 50); a shape drawn in a corner sits off its
  place on the face.
- **Keep it bold.** Strokes under 6 units vanish at 40 px. Check the small cells of the sheet.
- **Round the corners** with a round stroke over the fill: sharp points look cut at small sizes.
- **Mind the turn.** A wide eye reaches the side of the head sooner: check the three-quarter views.
- **Say whether it blinks.** A shape that reads as a closed eye (a curve, crossed lines) should not
  blink: give `"blinks": false`.
- **Pair the smile.** `smile` matters only to characters with a mouth line; give one that matches
  the eyes (a frown under crossed eyes, a smile under a wink).
- **Name faces for what they show**, in English, lowercase, with dashes: `knocked-out`,
  `starry-eyed`, `wink`.

## A working loop with the person

1. Write the face and open its link.
2. Capture the sheet: front, sides, small sizes, blink, the change of face.
3. Adjust the marks; the person adjusts them in the Studio and the address follows.
4. When it is right, the person saves it, names it in a clip key or a state, and exports the
   library for their app.

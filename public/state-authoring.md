# Writing a state for the Bible Strong Avatar Studio

A **state** is what an avatar is in, as an app declares it: `idle`, `thinking`, `finished`. It
says which clips the avatar plays and how (shuffled without end, once in order, or for a time),
what comes next, the face it holds and what it turns the body into. This page gives the format,
how to hand a state to the Studio through a link (with new clips of its own if it needs them),
and how to check what it does over time.

- Studio: https://avatars.bible-strong.app/
- JSON Schema of a state: https://avatars.bible-strong.app/state.schema.json
- The 50 states of the catalogue, to learn from:
  https://avatars.bible-strong.app/catalogue/states.json, an object
  `{ "states": { name: state }, "groups": [{ "label", "states": [names] }], "aliases": { alias: name } }`.
  The groups (Lifecycle, Reactions, Spinners, Product, Showcase) sort the states by use: start
  from the group of what you are asked for.
- The clips they play: https://avatars.bible-strong.app/catalogue/clips.json
- Writing a clip: https://avatars.bible-strong.app/clip-authoring.md
- Everything else for agents: https://avatars.bible-strong.app/llms.txt

## The format

```json
{
  "name": "cheering",
  "clips": ["Done_A", "Done_C", "Done_A"],
  "face": "happy",
  "next": "idle",
  "holdSeconds": 6
}
```

| Field          | Meaning                                                                                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | The name an app asks for. Not a catalogue state's (`idle`, `finished`…) nor one of their aliases (`dots`, `radar`, `orbit`, `loading`). Lowercase words with dashes, like the catalogue's.                                                                                                               |
| `clips`        | The clips the state plays, at least one, by name: a catalogue clip, a clip saved in the person's Studio, or one of `newClips`. A clip listed twice comes out twice as often when the state shuffles.                                                                                                     |
| `compactClips` | Optional. The clips drawn instead when the avatar is shown small (under 48 px in an app). The catalogue's `idle` keeps only its calm clip there.                                                                                                                                                         |
| `face`         | Optional. A face held for as long as the state lasts, over the clips' own faces: `neutral`, `happy`, `surprised`, `sad`, `sleepy`, `squinted`, `calm`, `inspecting`, `confused`, or a drawn face by its exact name (https://avatars.bible-strong.app/face-authoring.md). Without it the clips decide.    |
| `morph`        | Optional. What the body turns into while the state lasts: one of `thinking`, `orbit`, `radar`, `progress`, `spawning`, `dictating`, `sending`, `receiving`, `uploading`, `bouncing`, `writing`, `alerting`, `powering-down`. The face fades out while it shows, and the clips slow to a stop underneath. |
| `next`         | Optional. The state that comes after this one: a catalogue state, a saved custom state, or this one.                                                                                                                                                                                                     |
| `holdSeconds`  | Optional, only with `next`. How long the state lasts before `next` starts, in seconds.                                                                                                                                                                                                                   |
| `newClips`     | Optional, links and files only. Full clips (the format of the clip guide) that come with the state: the state may name them in `clips`. Saving the state saves them among the person's clips.                                                                                                            |

## The three rules

How a state plays its clips follows from `next` and `holdSeconds`:

| Rule                      | Fields                 | What the avatar does                                                                                                                                              | Catalogue examples                 |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Shuffled**              | no `next`              | Draws its clips at random, each once a round, in a new order each round, without end. A round does not start with the clip the last one ended on. One clip loops. | `idle`, `working`, `happy`         |
| **Once, then next**       | `next`                 | Plays each clip once, in the order of the list, then goes to `next`.                                                                                              | `finished` (Done_B, Done_A → idle) |
| **For a time, then next** | `next` + `holdSeconds` | Shuffles its clips for `holdSeconds`, then goes to `next`, wherever the clip is.                                                                                  | `waking` (1.6 s → idle)            |

- A state's clips start at their beginning. Only the very first clip a brand new avatar plays
  starts partway through, at random, so that two avatars started together do not move together;
  the run shows the state as entered from another one, from the beginning of its first clip.
- Between two clips, and when a clip ends away from its rest pose, the body is led to the next
  clip's rest pose in 0.35 s: a **join**. Clips that end where they start join less.
- States that play the same list share their rounds: going from one to another does not start
  the round over.

## Handing a state to the Studio: the link

```
https://avatars.bible-strong.app/#avatar=strobi&state={"name":"cheering","clips":["Done_A"],...}
```

- Opening the link opens the States tab with the state as a **draft** and plays it on the stage.
  Nothing is saved until the person presses "Enregistrer dans mes états" (Save to my states).
- `state=` must come **last**: everything after it is the state's JSON, written as it is or
  percent-encoded. Before it, optionally, `avatar=<file name>` (`strobi`, `freddy`… as listed in
  llms.txt), `view=frames` to open the frame sheet instead of the run, and `fps=2|4|8|12` for the
  sheet (4 when left out).
- While the draft is shown, every change made in the Studio rewrites the address about 0.3 s
  later; a new address written in the same tab changes the draft at once. Right after opening,
  the Studio rewrites the address once in its own order and encoding: compare states as parsed
  JSON, never as text.
- A state that does not open shows its first problem in the States tab, in the element
  `[data-link-problem]`, for example `clips[1]: unknown clip "Hopp": name a catalogue clip, a
saved custom clip, or one of newClips`.

### A state with clips of its own

When the state needs motion the catalogue does not have, write the clips in `newClips`, in the
clip format, and name them in `clips`:

```json
{
  "name": "hopping",
  "clips": ["Happy hop", "Idle_B"],
  "next": "idle",
  "holdSeconds": 5,
  "newClips": [
    { "name": "Happy hop", "duration": 1.3, "squashAnchor": -1, "tracks": { "...": [] } }
  ]
}
```

A new clip may not take a catalogue clip's name. If the person already has a different clip of
that name, saving keeps yours under a numbered name and the state follows it.

## Checking what a state does: the run

The States tab shows the **run** of the state (`[data-state-run]`): what an engine does from the
moment it enters the state, played with a fixed seed, over long enough to see its rounds, its
hand-over and what follows (up to 60 s). It always hands over as an app would, whatever the
Studio's "Enchaîner" switch does on the stage.

- A band over time, one colour per clip, joins hatched, what follows the hand-over dimmed.
- A list of segments, one per play of a clip and one per join. Each `li[data-run-segment]` carries
  `data-from` and `data-to` (seconds), `data-state` (the state that plays: it changes at the
  hand-over), `data-clip`, `data-joining` (`true` for a join) and `data-morph`.

Times are read every sixtieth of a second and given to the hundredth: a clip of 4 s may show as
ending at 4.02. Read the segments to check the rule: the order of a sequence, the time of the hand-over, how often
each clip comes out of a shuffle, and that nothing is missing (a clip that is not known shows as
"introuvable" in the list of clips and never plays).

`view=frames` shows the run as a **sheet** instead: the avatar at 2, 4, 8 or 12 frames per second
over the same time, each cell labelled with its time and the clip that plays
(`[data-sheet] [data-frame]`, with `data-time`, `data-face`, `data-clip`). Use it to see the spinner,
the face the state holds, and how the clips look one after the other. Capture it as the clip guide
says (a window 1500 px wide and tall enough, `page.locator('[data-sheet]').screenshot()`).

## Good states

- **Reuse before you make.** Most states only change the face or the mix of existing clips:
  `listening` is `Idle_D` with `calm`, `curious` is `Working_B` with `inspecting`.
- **A shuffled state needs variety.** Two to six clips of similar energy; list the calmest one
  twice so that it comes out more often, as `idle` does with `Idle_B`.
- **A reaction is short.** Use _once, then next_ back to `idle` for a reaction (`finished`,
  `approving`), and _for a time, then next_ when the reaction is a mood that fades (`waking`).
- **"For about N seconds, then idle"**: _for a time_ cuts the clip that plays when the time is up,
  wherever it is. For a reaction that must play whole, make a clip of N seconds that ends at rest
  and use _once, then next_.
- **Hold a face that matches the clips.** A held face is laid over every clip; a `happy` face on a
  clip that slumps reads wrong.
- **A spinner says the avatar is busy.** Use `morph` with `Idle_B` underneath, as the catalogue's
  spinner states do; the clips barely show while it turns.
- **Name states for what the app is doing or feeling**, in English, lowercase, with dashes. A name
  near a catalogue state's (`celebrating` beside `celebrate`) is allowed; say why it differs.
- **Mind the link's length.** A state that brings a clip of a few seconds makes a link of a few
  kilobytes (7 KB for a 4 s dance with about 80 keys): fine in a browser, long for some chat apps.
  Hand over a `.state.json` file instead when it grows (the Studio imports it from the States tab).

## A working loop with the person

1. Read the catalogue states closest to the request, and the clips they play.
2. Write the state (and its `newClips` if the catalogue lacks the motion) and open its link.
3. Read the run: order, timing, hand-over. Capture the sheet if the faces or the spinner matter.
4. Hand the link to the person; they adjust it in the Studio and the address follows.

# Stand mode

Choose an avatar in the studio, select **Stand mode**, then **Enable camera and start**.
The browser requests camera access and fullscreen. If fullscreen is unavailable, the
experience fills the application window. Escape, leaving fullscreen, or Back to studio
stops the camera and terminates its inference worker.

The avatar notices passers-by, starts wary, then becomes curious. Large, optional invitations
make the interaction legible from 1–2 metres. A wave, sustained smile, thumbs-up or head tilt
breaks the ice. A wave is an open,
raised palm moving sideways through at least two direction reversals. A stationary hand
does not trigger a greeting. Greetings have a 4.5-second cooldown. After losing a visitor
for 1.4 seconds, the avatar returns to its idle behavior and greets the next visitor warily.

The settings button at the top left reveals the camera preview, horizontal mirroring and
the proximity threshold. **Calibrate gaze** sets the neutral viewing axis: stand in front of
the center of the screen at the usual interaction distance, then press the button while
your face is tracked. Calibration lasts for this camera session and survives visitor
changes. Adjust these with the actual camera and screen placement. The
welcome-distance slider defaults to approximately 2.2 metres (adjustable from 1–3 metres).
The avatar gently enlarges as a visitor approaches, reaching +14% around 65 cm. This is
computed from estimated distance, not a calibrated depth sensor. Invitations can be hidden.
Settings and temporary poses are session-only. Saved avatars, expressions and animations
are not edited by the director. Opening stand mode pauses studio animation playback.

## Encounter choreography

- Arrival: a small startle, an asymmetric wary glance, then an invitation to wave or smile.
- Open-palm wave: an animated greeting. Real sideways reversals are required; holding a
  hand still does not count. At least 4.5 seconds separate wave greetings.
- Smile: both mouth-corner coefficients average at least 0.5 for 600 ms. Strobi smiles
  with its eyes, so avatars without a mouth still react visibly.
- Thumbs-up: a nearby hand with a classifier score of at least 0.65 for 500 ms earns a
  bounce and wink. A different hand cannot finish the previous hand's hold.
- Head tilt: an eye-line roll of at least 12° for 650 ms receives a playful response;
  while friendly, the avatar also gently follows the visitor's tilt.
- Replies last 2.2 seconds without being interrupted. Held gestures need a release
  before retriggering; the director does not queue gestures during a reply.
- Invitations rotate every nine seconds in friendly mode, without a failure screen or
  timer. After three different interactions, Strobi invites the visitor to ask the stand
  team about its story. Free play remains available, and other recognized gestures are
  accepted even when a different activity is suggested.
- Without a visitor, Strobi looks around, breathes and occasionally gets sleepy. Losing
  the face briefly produces a searching invitation; a new encounter clears all progress.

There is no audio or microphone capture. Optional movement respects reduced motion, and
frame-by-frame pose changes stay in Motion values; React only receives mood/cue changes.

## Camera diagnostics

Stand settings opens a large operator console alongside the avatar. It shows the live
camera feed with facial landmarks/contours, face boxes and hand connections. Green marks
the attended visitor, blue other faces, and orange an open palm. Overlays share the video's
contain-fit and mirror transform. Face numbers are frame-local, not persistent identities.

The console reports the attended face's approximate distance, target head/eye offsets,
face and hand counts, input resolution, camera label, analysis time, measured tracking
frequency, gaze calibration, and greeting cooldown. It also shows the current invitation,
number of distinct interactions, face roll, and held-gesture progress. Facial blendshape coefficients and
hand gesture classifier scores are displayed without interpreting emotions. These are
raw observations and requested gaze values, not the final smoothed animation pose.

Diagnostic text updates at 4 Hz and overlays at up to 10 Hz while settings is visible;
no diagnostic rendering runs while it is hidden. Stale observations clear after one
second. Nothing is persisted or recorded.

## Implementation

- The camera and module-worker approach is adapted from the `testing` capture lab.
- MediaPipe Face Landmarker observes up to four faces. Spatial continuity keeps attention
  on one visitor; this is not identity recognition and crossing visitors can be ambiguous.
- Gesture Recognizer supplies palm shape and hand landmarks. A temporal detector finds
  waves and associates a nearby hand with the attended face.
- Capture requests 960 × 720 (ideal, not mandatory), keeping small faces clearer at a
  distance. Camera inference is capped at 15 frames per second with one bitmap in flight. Rendering
  runs separately at up to 30 frames per second through Motion values, with time-based
  smoothing. React state holds only settings and coarse session/mood status.
- Gaze uses an approximate pinhole projection (assumed 60° horizontal field of view and
  16 cm face width), plus 85 cm of artistic virtual depth behind the screen. These are
  defaults, not measured physical dimensions. Head rotation and eye offsets share one
  bounded angular target; eyes no longer add another full movement on top of the head.
  Calibration compensates for camera offset in estimated space, including depth changes.
  Real distance remains approximate, especially with different face sizes or turned heads.
- Frames are neither recorded nor uploaded. Pinned MediaPipe 1.0.1 WASM and versioned
  model files load from jsDelivr and Google Storage. A network connection is needed when
  these assets are not cached. Camera access requires HTTPS or localhost.
- The module-worker WASM loader uses a distinct URL for the second task because MediaPipe
  clears its global factory after initialization and dynamic imports otherwise stay cached.

## On-site checks

1. Start with the selected avatar, including its colors, secondary shapes, mouth and outline.
2. Calibrate from the center, then move slightly left/right and approach the screen. Check
   that eye contact stays subtle. Correct mirroring and proximity in settings.
3. Hold an open palm still, then wave: only the wave should trigger the playful response.
4. Smile, hold a thumbs-up, and tilt your head. Each should receive its own response.
   Hold the pose: it should not retrigger until you release and repeat it. Try a gesture
   different from the invitation, and let an invitation time out: neither should block play.
5. Introduce a second visitor and briefly obscure the first visitor. Attention should remain
   stable, then transfer after the first visitor leaves.
6. Leave the scene empty, then return. The avatar should idle, then become wary again.
7. Exit during initialization and while running. Confirm the camera indicator turns off.
8. Test camera denial, camera disconnection, and unavailable model downloads; retry should
   recover without reloading the studio.

Automated tests cover attention, the encounter sequence, signal holds/releases, hand
association, distance response, finite rendering inputs, cooldowns,
mirroring and camera cleanup. Browser validation with a simulated camera covers actual
model loading, fullscreen and exit. Recognition accuracy still needs a real-camera check
under the stand's lighting, framing and visitor distances.

## Hand exploration and petting

With **Show resources and the virtual hand** enabled (the default), six illustrated cards
surround the avatar: lexicon, dictionaries and comparisons on the left; cross references,
topics and commentaries on the right. Each opens a large, scrollable discovery reader.
These are editorial introductions adapted from Bible Strong World's six discovery journeys,
not live queries against the resource libraries. Illustrations are copied from
`bible-strong-app/apps/world/public/assets/discovery` to `public/stand/resources`. The
French and English examples have been adapted for this screen, with Simplified Chinese
copy added to the existing translation dictionaries. All reader text and images are local.

- Raise an open or relaxed hand for 300 ms to acquire the virtual hand. A comfort-sized mapping is
  fixed relative to the visitor at acquisition; head movements do not move the pointer.
  The pointer has 1.4× gain on both axes, requiring 28.6% less physical travel while
  preserving the resting hand position.
- Close the fist over a card or navigation control to
  activate it. The fist is confirmed for 120 ms across more than one observation.
  The highlighted control shows the target. Hovering alone never activates it.
  A new fist click requires reopening the hand first.
  Context changes have a short guard interval, and a held fist cannot click again in
  the newly opened reader.
- Close the fist inside the text, then move vertically to drag the content. Opening
  the hand, losing tracking, or closing the reader stops dragging. Each grip keeps its
  original action: a click cannot become a drag, and dragging over a button cannot
  click it. Full-width up/down bars sit above and below the scrollable text; both support
  fist clicks, mouse, touch and keyboard. Hovering alone never activates a control.
- With an open hand, stroke the upper part of the avatar's head. Gentle movement for
  at least 320 ms triggers relaxed eyes, a small lean and hearts by the hand. A stationary
  palm, a fist, a fast sweep, or a resource control does not count as a caress. The hit
  region is an ellipse fitted to the rendered primary head bounds, excluding its lower
  part; it approximates unusual custom body shapes.
- The hand stays associated with the attended visitor using proximity and continuity.
  It does not switch hands immediately and actions stop on missing/stale hand observations.
  Spatial association can still be ambiguous when people overlap; this is not identity
  recognition or a body-pose tracker.
- New visitor ownership closes an open resource. After eight seconds without a visitor,
  the stand returns to the six cards. Putting the arm down alone leaves the reader open.
- Settings disable gesture actions but keep showing hand tracking status. Reading,
  selecting and petting suspend competing encounter responses; idle hand movement can
  still produce a wave. Camera inference is unchanged and cursor animation uses Motion
  values independently from React state.

Additional on-site checks: reach all six cards at 1 m and 2 m without leaning; hold on a
card and close the fist; close and reopen; drag up/down and release; lower the arm to read; introduce a
second person; stroke, pause and quickly sweep across the head; open settings while a
hand is present. Validate with the actual display, framing and lighting. The automated
suite covers hand acquisition/ownership, fist-only activation, stale frames, scrolling and pet strokes;
browser QA uses synthetic observations and does not establish recognition accuracy.

### Diagnostic pendant l’expérience

Ajouter `?debug` à l’URL pour afficher la caméra et les repères en bas à droite du stand, avec l’état de la main virtuelle. L’aperçu utilise le flux déjà ouvert et ne capture pas une seconde caméra. Il disparaît quand les réglages sont ouverts. Une main détectée sans geste reconnu peut désormais acquérir le curseur ; le survol seul ne valide rien ; le poing reste soumis à sa reconnaissance et les caresses nécessitent une paume ouverte.

### Accès direct et préférences

`/stand` ouvre le stand avec l’avatar actif enregistré dans le studio. `/stand?debug` ajoute l’aperçu de diagnostic. Le bouton du studio met l’URL à jour ; Quitter revient à `/`, et les boutons précédent/suivant du navigateur suivent le mode affiché. Le démarrage de la caméra et du plein écran reste déclenché par le bouton de démarrage.

Les préférences sont enregistrées sous `avatar-stand-settings` dans le local storage : caméra, miroir, distance d’accueil, invitations, ressources/main virtuelle et repères de diagnostic. Les données invalides utilisent les valeurs par défaut. Le calibrage du regard reste propre à chaque session et doit être refait si nécessaire. Une caméra enregistrée mais débranchée peut être remplacée dans les réglages.

Fermer le poing sur Strobi permet de le saisir et de le faire pivoter avec le même calcul de rotation arcball que dans l’Avatar Lab. La prise reste active hors de sa silhouette tant que la main est suivie et fermée. Ouvrir la main, perdre le suivi ou ouvrir les réglages relâche la rotation ; Strobi reprend progressivement son comportement. Les boutons restent prioritaires lorsqu’ils recouvrent l’avatar.

Le visage sert à attribuer une main au visiteur lors de l’acquisition. Ensuite, la continuité de la main (côté et proximité entre images) maintient le contrôle même sans visage visible, notamment lorsqu’elle le masque. Une perte réelle de la main suspend immédiatement les actions ; après une perte prolongée, une nouvelle acquisition requiert le visage. Le retour du même visage à proximité de la position initiale conserve la prise, même si son identifiant temporaire a expiré.

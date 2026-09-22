import { FaceLandmarker, FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import type { StandObservation } from './standDirector'

export type VisionRequest =
  { type: 'initialize' } | { type: 'frame'; image: ImageBitmap; timestamp: number }
export type VisionResponse =
  { type: 'ready' } | { type: 'observation'; observation: StandObservation } | { type: 'error' }

// Same module-worker setup as the capture lab on testing. Only models/code are downloaded;
// camera frames stay inside this worker and are closed immediately after inference.
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_ROOT = 'https://storage.googleapis.com/mediapipe-models'
let face: FaceLandmarker
let gesture: GestureRecognizer

self.addEventListener('message', async (event: MessageEvent<VisionRequest>) => {
  const request = event.data
  try {
    if (request.type === 'initialize') {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT, true)
      face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `${MODEL_ROOT}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        },
        runningMode: 'VIDEO',
        numFaces: 4,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55,
      })
      // MediaPipe clears global ModuleFactory after creating a task. Module workers cache
      // imports, so the second task needs its own module URL to run the loader again.
      const gestureVision = { ...vision, wasmLoaderPath: `${vision.wasmLoaderPath}?task=gesture` }
      gesture = await GestureRecognizer.createFromOptions(gestureVision, {
        baseOptions: {
          modelAssetPath: `${MODEL_ROOT}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
        },
        runningMode: 'VIDEO',
        numHands: 4,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      self.postMessage({ type: 'ready' } satisfies VisionResponse)
      return
    }
    const startedAt = performance.now()
    const faces = face.detectForVideo(request.image, request.timestamp)
    const hands = gesture.recognizeForVideo(request.image, request.timestamp)
    self.postMessage({
      type: 'observation',
      observation: {
        timestamp: request.timestamp,
        frameWidth: request.image.width,
        frameHeight: request.image.height,
        inferenceMs: performance.now() - startedAt,
        faceConnections: FaceLandmarker.FACE_LANDMARKS_CONTOURS,
        handConnections: GestureRecognizer.HAND_CONNECTIONS,
        faces: faces.faceLandmarks.map((points, index) => {
          const xs = points.map(point => point.x)
          const ys = points.map(point => point.y)
          const left = Math.min(...xs),
            right = Math.max(...xs)
          const top = Math.min(...ys),
            bottom = Math.max(...ys)
          return {
            x: (left + right) / 2,
            y: (top + bottom) / 2,
            width: right - left,
            height: bottom - top,
            frameAspectRatio: request.image.width / request.image.height,
            landmarks: points.map(({ x, y }) => ({ x, y })),
            signals: Object.fromEntries(
              (faces.faceBlendshapes[index]?.categories ?? []).map(category => [
                category.categoryName,
                category.score,
              ])
            ),
          }
        }),
        hands: hands.landmarks.map((points, index) => ({
          x: points[9].x,
          y: points[9].y,
          side: hands.handedness[index]?.[0]?.categoryName ?? String(index),
          landmarks: points.map(({ x, y }) => ({ x, y })),
          gesture: hands.gestures[index]?.[0]?.categoryName,
          confidence: hands.gestures[index]?.[0]?.score,
          open:
            hands.gestures[index]?.[0]?.categoryName === 'Open_Palm' &&
            hands.gestures[index][0].score > 0.55,
        })),
      },
    } satisfies VisionResponse)
  } catch (error) {
    console.error('Stand vision initialization or inference failed', error)
    self.postMessage({ type: 'error' } satisfies VisionResponse)
  } finally {
    if (request.type === 'frame') request.image.close()
  }
})

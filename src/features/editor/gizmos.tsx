import {
  poseFromExpression,
  renderBodyNodeEditor,
  rotateBodyNodeAroundLocalAxis,
  rotateExpressionAroundAxis,
  rotateExpressionAroundCamera,
  rotateExpressionWithArcball,
  rotationRing,
  translateBodyNodeAlongLocalAxis,
  translateBodyNodeInCameraPlane,
  type AvatarPose,
  type BodyNode,
  type Expression,
  type Point3,
} from '@bible-strong/avatar-core'
import { RotateCcw } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  beginManipulation,
  beginManipulationFromRenderedValue,
  finishManipulation,
  previewManipulation,
  type ManipulationSession,
} from '@/features/editor/manipulationSession'
import { type RenderedRotationGizmo } from '@/features/editor/renderedRotationGizmo'
import { bounded, useEscapeToCancel } from '@/features/editor/utils'
import { useStudioLanguage } from '@/i18n'

export function RotationGizmo({
  expression,
  rendered,
  onPreview,
  onChange,
  onActiveChange,
  onReset,
}: {
  expression: Expression
  rendered: RenderedRotationGizmo
  onPreview: (next: Expression) => void
  onChange: (next: Expression) => void
  onActiveChange: (active: boolean) => void
  onReset: () => void
}) {
  const { t } = useStudioLanguage()
  const drag = useRef<
    | {
        type: 'axis'
        axis: 'x' | 'y' | 'z'
        startPoint: readonly [number, number]
        tangent: readonly [number, number]
        expression: Expression
      }
    | { type: 'view'; startAngle: number; expression: Expression }
    | null
  >(null)
  const latestExpression = useRef(expression)
  const pose = poseFromExpression(expression)
  const rings = {
    x: rotationRing(pose, 'x'),
    y: rotationRing(pose, 'y'),
    z: rotationRing(pose, 'z'),
  }
  const toLocal = (event: React.PointerEvent<SVGElement>): readonly [number, number] => {
    const rectangle = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    return [
      ((event.clientX - rectangle.left) / rectangle.width) * 86 - 43,
      ((event.clientY - rectangle.top) / rectangle.height) * 86 - 43,
    ]
  }
  const unitVector = (from: Point3, to: Point3): readonly [number, number] => {
    const x = to[0] - from[0]
    const y = to[1] - from[1]
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
  }
  const startAxis = (axis: 'x' | 'y' | 'z', event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    onActiveChange(true)
    const point = toLocal(event)
    const ring = rings[axis]
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY
    ring.slice(0, -1).forEach((ringPoint, index) => {
      const distance = Math.hypot(ringPoint[0] - point[0], ringPoint[1] - point[1])
      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })
    const previous = ring[(closestIndex - 1 + ring.length - 1) % (ring.length - 1)]
    const next = ring[(closestIndex + 1) % (ring.length - 1)]
    drag.current = {
      type: 'axis',
      axis,
      startPoint: point,
      tangent: unitVector(previous, next),
      expression,
    }
    latestExpression.current = expression
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startView = (event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    onActiveChange(true)
    const point = toLocal(event)
    drag.current = { type: 'view', startAngle: Math.atan2(point[1], point[0]), expression }
    latestExpression.current = expression
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return
    const point = toLocal(event)
    if (drag.current.type === 'view') {
      const currentAngle = Math.atan2(point[1], point[0])
      const delta = Math.atan2(
        Math.sin(currentAngle - drag.current.startAngle),
        Math.cos(currentAngle - drag.current.startAngle)
      )
      const next = rotateExpressionAroundCamera(drag.current.expression, delta)
      latestExpression.current = next
      onPreview(next)
      return
    }
    const signedDistance =
      (point[0] - drag.current.startPoint[0]) * drag.current.tangent[0] +
      (point[1] - drag.current.startPoint[1]) * drag.current.tangent[1]
    const next = rotateExpressionAroundAxis(
      drag.current.expression,
      drag.current.axis,
      signedDistance * 1.5
    )
    latestExpression.current = next
    onPreview(next)
  }
  const stop = () => {
    if (drag.current) onChange(latestExpression.current)
    drag.current = null
    onActiveChange(false)
  }
  const cancel = () => {
    if (drag.current) {
      onPreview(drag.current.expression)
      onChange(drag.current.expression)
    }
    drag.current = null
    onActiveChange(false)
  }
  useEscapeToCancel(cancel)
  return (
    <motion.div
      className="gizmo-cluster"
      initial={{ opacity: 0, scale: 0.88, x: 10, y: -8 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 12, y: -6 }}
      transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
    >
      <svg className="gizmo" viewBox="-43 -43 86 86" aria-label={t('Gizmo de rotation')}>
        <circle
          className="gizmo-orbit gizmo-camera"
          cx="0"
          cy="0"
          r="38"
          onPointerDown={startView}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
        <motion.path
          className="gizmo-orbit gizmo-y"
          d={rendered.yPath}
          onPointerDown={event => startAxis('y', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
        <motion.path
          className="gizmo-orbit gizmo-x"
          d={rendered.xPath}
          onPointerDown={event => startAxis('x', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
        <motion.path
          className="gizmo-orbit gizmo-z"
          d={rendered.zPath}
          onPointerDown={event => startAxis('z', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
      </svg>
      <Button
        className="gizmo-reset"
        variant="secondary"
        size="icon-sm"
        aria-label={t('Réinitialiser la rotation de la tête')}
        onClick={onReset}
      >
        <RotateCcw />
      </Button>
    </motion.div>
  )
}

type TransformAxis = 'x' | 'y' | 'z'

export function BodyNodeGizmo({
  svgRef,
  pose,
  node,
  onPreview,
  onCommit,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>
  pose: AvatarPose
  node: BodyNode
  onPreview: (next: BodyNode) => void
  onCommit: (next: BodyNode) => void
}) {
  const { t } = useStudioLanguage()
  const geometry = renderBodyNodeEditor(pose, node)
  const [activeControl, setActiveControl] = useState<
    { mode: 'translate' | 'rotate'; axis: TransformAxis } | { mode: 'plane' } | undefined
  >(undefined)
  const drag = useRef<
    | {
        mode: 'translate' | 'rotate'
        axis: TransformAxis
        startPoint: readonly [number, number]
        direction: readonly [number, number]
        scale: number
        node: BodyNode
      }
    | {
        mode: 'plane'
        startPoint: readonly [number, number]
        node: BodyNode
      }
    | undefined
  >(undefined)
  const latestNode = useRef(node)
  const manipulation = useRef<ManipulationSession<BodyNode> | null>(null)
  const previewFrame = useRef<number | undefined>(undefined)
  const axes: TransformAxis[] = ['x', 'y', 'z']
  const toSvg = (event: React.PointerEvent<SVGElement>): readonly [number, number] => {
    const rectangle = svgRef.current!.getBoundingClientRect()
    return [
      ((event.clientX - rectangle.left) / rectangle.width) * 300 - 150,
      ((event.clientY - rectangle.top) / rectangle.height) * 300 - 150,
    ]
  }
  const directionBetween = (from: Point3, to: Point3): readonly [number, number] => {
    const x = to[0] - from[0]
    const y = to[1] - from[1]
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
  }
  const ringPath = (points: Point3[]) =>
    `M${points.map(point => `${point[0]} ${point[1]}`).join('L')}Z`
  const startTranslate = (axis: TransformAxis, event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    const endpoint = geometry.axes[axis]
    const length = Math.max(
      Math.hypot(endpoint[0] - geometry.center[0], endpoint[1] - geometry.center[1]),
      1
    )
    drag.current = {
      mode: 'translate',
      axis,
      startPoint: toSvg(event),
      direction: directionBetween(geometry.center, endpoint),
      scale: 34 / length,
      node,
    }
    setActiveControl({ mode: 'translate', axis })
    latestNode.current = node
    manipulation.current = beginManipulation(node)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startRotate = (axis: TransformAxis, event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    const point = toSvg(event)
    const ring = geometry.rings[axis]
    let closestIndex = 0
    let closestDistance = Infinity
    ring.slice(0, -1).forEach((ringPoint, index) => {
      const distance = Math.hypot(ringPoint[0] - point[0], ringPoint[1] - point[1])
      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })
    const previous = ring[(closestIndex - 1 + ring.length - 1) % (ring.length - 1)]
    const next = ring[(closestIndex + 1) % (ring.length - 1)]
    const radius = Math.max(
      Math.hypot(
        ring[closestIndex][0] - geometry.center[0],
        ring[closestIndex][1] - geometry.center[1]
      ),
      8
    )
    drag.current = {
      mode: 'rotate',
      axis,
      startPoint: point,
      direction: directionBetween(previous, next),
      scale: 180 / Math.PI / radius,
      node,
    }
    setActiveControl({ mode: 'rotate', axis })
    latestNode.current = node
    manipulation.current = beginManipulation(node)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startPlaneTranslate = (event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    drag.current = { mode: 'plane', startPoint: toSvg(event), node }
    setActiveControl({ mode: 'plane' })
    latestNode.current = node
    manipulation.current = beginManipulation(node)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return
    const interaction = drag.current
    const point = toSvg(event)
    const deltaX = point[0] - interaction.startPoint[0]
    const deltaY = point[1] - interaction.startPoint[1]
    const next = (() => {
      if (interaction.mode === 'plane') {
        return translateBodyNodeInCameraPlane(interaction.node, pose, deltaX, deltaY)
      }
      const delta =
        (deltaX * interaction.direction[0] + deltaY * interaction.direction[1]) * interaction.scale
      return interaction.mode === 'translate'
        ? translateBodyNodeAlongLocalAxis(interaction.node, interaction.axis, delta)
        : rotateBodyNodeAroundLocalAxis(interaction.node, interaction.axis, delta)
    })()
    latestNode.current = next
    if (manipulation.current) {
      previewManipulation(manipulation.current, next)
    }
    if (previewFrame.current !== undefined) return
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = undefined
      onPreview(latestNode.current)
    })
  }
  const stop = () => {
    if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    previewFrame.current = undefined
    if (manipulation.current) {
      finishManipulation(manipulation.current, 'commit', { preview: onPreview, commit: onCommit })
    }
    manipulation.current = null
    drag.current = undefined
    setActiveControl(undefined)
  }
  const cancel = () => {
    if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    previewFrame.current = undefined
    if (manipulation.current) {
      finishManipulation(manipulation.current, 'cancel', { preview: onPreview, commit: onCommit })
    }
    manipulation.current = null
    drag.current = undefined
    setActiveControl(undefined)
  }
  useEscapeToCancel(cancel)
  const resetTransform = (event: React.MouseEvent<SVGGElement>) => {
    event.stopPropagation()
    const resetNode: BodyNode = { ...node, position: [0, 0, 0], rotation: [0, 0, 0] }
    latestNode.current = resetNode
    onCommit(resetNode)
  }

  useEffect(
    () => () => {
      if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    },
    []
  )

  return (
    <g className="body-node-gizmo" aria-label={`${t('Transformer')} ${t(node.name)}`}>
      {axes.map(axis => (
        <g key={`ring-${axis}`}>
          <path
            className="body-gizmo-hitbox body-gizmo-ring-hitbox"
            d={ringPath(geometry.rings[axis])}
            onPointerDown={event => startRotate(axis, event)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={cancel}
          />
          <path
            className={`body-gizmo-ring gizmo-${axis}${activeControl?.mode === 'rotate' && activeControl.axis === axis ? ' is-active' : ''}`}
            d={ringPath(geometry.rings[axis])}
            pointerEvents="none"
          />
        </g>
      ))}
      {axes.map(axis => (
        <g key={`axis-${axis}`}>
          <path
            className="body-gizmo-hitbox body-gizmo-axis-hitbox"
            d={`M${geometry.center[0]} ${geometry.center[1]}L${geometry.axes[axis][0]} ${geometry.axes[axis][1]}`}
            onPointerDown={event => startTranslate(axis, event)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={cancel}
          />
          <path
            className={`body-gizmo-axis gizmo-${axis}${activeControl?.mode === 'translate' && activeControl.axis === axis ? ' is-active' : ''}`}
            d={`M${geometry.center[0]} ${geometry.center[1]}L${geometry.axes[axis][0]} ${geometry.axes[axis][1]}`}
            pointerEvents="none"
          />
          <circle
            className={`body-gizmo-handle gizmo-${axis}`}
            cx={geometry.axes[axis][0]}
            cy={geometry.axes[axis][1]}
            r="3.5"
            pointerEvents="none"
          />
          <text
            className={`body-gizmo-label body-gizmo-label-${axis}`}
            x={geometry.axes[axis][0]}
            y={geometry.axes[axis][1] - 5}
          >
            {axis.toUpperCase()}
          </text>
        </g>
      ))}
      <circle
        className="body-gizmo-plane-hitbox"
        cx={geometry.center[0]}
        cy={geometry.center[1]}
        r="11"
        aria-label={t('Déplacer dans le plan de la caméra')}
        onPointerDown={startPlaneTranslate}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={cancel}
      />
      <circle
        className={`body-gizmo-origin${activeControl?.mode === 'plane' ? ' is-active' : ''}`}
        cx={geometry.center[0]}
        cy={geometry.center[1]}
        r="4"
        pointerEvents="none"
      />
      <g
        className="body-gizmo-reset"
        role="button"
        tabIndex={0}
        aria-label={t(`Réinitialiser la position et la rotation de ${node.name}`)}
        transform={`translate(${bounded(geometry.center[0] + 32, -140, 140)} ${bounded(geometry.center[1] - 32, -140, 140)})`}
        onClick={resetTransform}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          const resetNode: BodyNode = { ...node, position: [0, 0, 0], rotation: [0, 0, 0] }
          latestNode.current = resetNode
          onCommit(resetNode)
        }}
      >
        <circle r="6.5" />
        <text y="2.5">↺</text>
      </g>
    </g>
  )
}

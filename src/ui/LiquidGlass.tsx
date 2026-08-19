import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'

function smoothStep(a: number, b: number, t: number) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

function roundedRectSDF(x: number, y: number, width: number, height: number, radius: number) {
  const qx = Math.abs(x) - width + radius
  const qy = Math.abs(y) - height + radius
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return Math.min(Math.max(qx, qy), 0) + outside - radius
}

type Props = {
  children: ReactNode
  className?: string
  radius?: number
}

export function LiquidGlass({ children, className = '', radius = 28 }: Props) {
  const reactId = useId().replace(/:/g, '')
  const filterId = `lg-${reactId}`
  const wrapRef = useRef<HTMLDivElement>(null)
  const feImageRef = useRef<SVGFEImageElement>(null)
  const feMapRef = useRef<SVGFEDisplacementMapElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const feImage = feImageRef.current
    const feMap = feMapRef.current
    if (!wrap || !feImage || !feMap) return

    const paint = () => {
      const width = Math.max(1, Math.round(wrap.clientWidth))
      const height = Math.max(1, Math.round(wrap.clientHeight))
      const dpi = 0.5
      const w = Math.max(1, Math.floor(width * dpi))
      const h = Math.max(1, Math.floor(height * dpi))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const data = new Uint8ClampedArray(w * h * 4)
      const raw: number[] = []
      let maxScale = 0
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % w
        const y = Math.floor(i / 4 / w)
        const ix = x / w - 0.5
        const iy = y / h - 0.5
        const distanceToEdge = roundedRectSDF(ix, iy, 0.32, 0.22, 0.55)
        const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15)
        const scaled = smoothStep(0, 1, displacement)
        const dx = (ix * scaled + 0.5) * w - x
        const dy = (iy * scaled + 0.5) * h - y
        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
        raw.push(dx, dy)
      }
      maxScale *= 0.5
      let index = 0
      for (let i = 0; i < data.length; i += 4) {
        data[i] = (raw[index++] / maxScale + 0.5) * 255
        data[i + 1] = (raw[index++] / maxScale + 0.5) * 255
        data[i + 2] = 0
        data[i + 3] = 255
      }
      ctx.putImageData(new ImageData(data, w, h), 0, 0)
      feImage.setAttribute('width', String(width))
      feImage.setAttribute('height', String(height))
      feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL())
      feMap.setAttribute('scale', String(maxScale / dpi))
    }

    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const glassStyle = {
    borderRadius: radius,
    backdropFilter: `url(#${filterId}) blur(0.25px) contrast(1.16) brightness(1.06) saturate(1.2)`,
    WebkitBackdropFilter: `url(#${filterId}) blur(0.25px) contrast(1.16) brightness(1.06) saturate(1.2)`,
  } as CSSProperties

  return (
    <div className={`relative ${className}`}>
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden>
        <defs>
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
            x="0"
            y="0"
            width="100%"
            height="100%"
          >
            <feImage ref={feImageRef} id={`${filterId}_map`} />
            <feDisplacementMap
              ref={feMapRef}
              in="SourceGraphic"
              in2={`${filterId}_map`}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div ref={wrapRef} className="relative overflow-hidden" style={glassStyle}>
        {children}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

/** Conta do valor exibido até o novo valor, respeitando quem prefere menos movimento. */
export function useAnimatedNumber(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = target
      setValue(target)
      return
    }
    const from = current.current
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      current.current = from + (target - from) * eased
      setValue(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

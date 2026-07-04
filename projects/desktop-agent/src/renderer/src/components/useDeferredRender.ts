import { useState, useEffect, useRef } from 'react'

// 延迟渲染 hook：来自 Kun useDeferredRender
// 非活跃段展开时延迟渲染详情内容，避免大量折叠内容一次性 mount 卡顿
// 用 IntersectionObserver 检测是否在视口内，在视口内才渲染
export function useDeferredRender<T extends HTMLElement>(options?: {
  enabled?: boolean
  rootMargin?: string
}): {
  ref: React.RefObject<T | null>
  shouldRender: boolean
} {
  const enabled = options?.enabled ?? true
  const rootMargin = options?.rootMargin ?? '200px'
  const ref = useRef<T>(null)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (!enabled || shouldRender) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, shouldRender, rootMargin])

  return { ref, shouldRender }
}

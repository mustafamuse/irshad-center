import { createClientLogger } from '@/lib/logger-client'

const logger = createClientLogger('scroll')

export function scrollToElement(elementId: string, offset: number = 0) {
  if (typeof window === 'undefined') return

  // Add retry mechanism for dynamic content
  const maxAttempts = 10
  let attempts = 0

  const tryScroll = () => {
    const element = document.getElementById(elementId)
    if (element) {
      // Get the element's position relative to the viewport
      const elementPosition = element.getBoundingClientRect().top
      // Add current scroll position to get absolute position
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })

      logger.debug(`Scrolled to ${elementId} at position ${offsetPosition}`)
      return true
    }
    return false
  }

  const attemptScroll = () => {
    if (attempts >= maxAttempts) {
      logger.warn(
        `Failed to find element #${elementId} after ${maxAttempts} attempts`
      )
      return
    }

    if (!tryScroll()) {
      attempts++
      // Exponential backoff
      setTimeout(attemptScroll, Math.min(100 * Math.pow(2, attempts), 1000))
    }
  }

  attemptScroll()
}

export function handleHashScroll(offset: number = 0) {
  if (typeof window === 'undefined') return

  const scrollOnLoad = () => {
    const hash = window.location.hash
    if (hash) {
      const elementId = hash.slice(1) // Remove the '#' symbol
      logger.debug(`Attempting to scroll to #${elementId}`)
      scrollToElement(elementId, offset)
    }
  }

  // Try immediately
  scrollOnLoad()

  // Also try after a short delay to handle dynamic content
  setTimeout(scrollOnLoad, 500)

  // Handle dynamic navigation
  window.addEventListener('hashchange', scrollOnLoad)

  // Cleanup
  return () => window.removeEventListener('hashchange', scrollOnLoad)
}

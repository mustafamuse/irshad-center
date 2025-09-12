export function scrollToElement(elementId: string, offset: number = 0) {
  const element = document.getElementById(elementId)
  if (element) {
    const elementPosition = element.getBoundingClientRect().top
    const offsetPosition = elementPosition + window.pageYOffset - offset

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    })
  }
}

export function handleHashScroll(offset: number = 0) {
  if (typeof window === 'undefined') return

  // Get the hash from the URL
  const hash = window.location.hash
  if (hash) {
    // Remove the '#' symbol
    const elementId = hash.slice(1)

    // Wait for the page to load/hydrate
    setTimeout(() => {
      scrollToElement(elementId, offset)
    }, 100)
  }
}

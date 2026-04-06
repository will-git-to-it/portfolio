import { prepareWithSegments, measureLineStats } from 'https://esm.sh/@chenglou/pretext'

/**
 * Uses Pretext to find the narrowest container width that still produces
 * the same number of lines, resulting in visually balanced text wrapping
 * (lines are roughly equal length instead of one long + one short orphan).
 */
function balanceText(element) {
  const text = element.textContent
  if (!text || !text.trim()) return

  const style = getComputedStyle(element)
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const containerWidth = element.offsetWidth

  if (containerWidth <= 0) return

  const prepared = prepareWithSegments(text, font)
  const { lineCount } = measureLineStats(prepared, containerWidth)

  // Single line or empty — nothing to balance
  if (lineCount <= 1) return

  // Binary search for the narrowest width that keeps the same line count
  let lo = 0
  let hi = containerWidth

  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    const { lineCount: testLines } = measureLineStats(prepared, mid)
    if (testLines <= lineCount) {
      hi = mid
    } else {
      lo = mid
    }
  }

  element.style.maxWidth = `${hi}px`
}

const SELECTORS = [
  '.project-info p',
  '.section-text',
  '.feature-description',
  '.about-text p',
  '.project-subtitle',
  'footer p',
].join(', ')

function balanceAll() {
  document.querySelectorAll(SELECTORS).forEach(el => {
    // Reset before re-measuring so we get the true container width
    el.style.maxWidth = ''
  })
  document.querySelectorAll(SELECTORS).forEach(balanceText)
}

// Wait for custom fonts to finish loading before measuring
if (document.fonts) {
  document.fonts.ready.then(balanceAll)
} else {
  window.addEventListener('load', balanceAll)
}

// Re-balance on resize
let resizeTimer
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(balanceAll, 200)
})

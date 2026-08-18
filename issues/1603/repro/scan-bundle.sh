#!/usr/bin/env bash
# Scan the production app bundle (apps/app/dist/assets) for JS APIs and CSS
# features that are NOT available in iOS 16 Safari (the newest iOS an
# iPhone 8 Plus can run is 16.7.x). Prints "<pattern> -> <n> files".
# Usage: scan-bundle.sh <path-to-apps/app/dist/assets>
cd "$1" || exit 1
JS_PATTERNS=(
  'Object.groupBy' 'Map.groupBy' 'Promise.withResolvers' 'Array.fromAsync'
  'AbortSignal.any' 'URL.canParse' 'URL.parse(' 'checkVisibility' 'showPopover'
  'requestIdleCallback' 'userAgentData' '.union(' '.symmetricDifference('
  '.isSubsetOf(' '.isDisjointFrom(' 'Iterator.prototype' 'Iterator.from' 'structuredClone'
  'navigator.locks' 'scheduler.postTask' 'scheduler.yield' 'Intl.DurationFormat'
  'Promise.try' 'toWellFormed' 'isWellFormed' 'Symbol.dispose' 'startViewTransition'
  'window.navigation' 'CSS.registerProperty' 'adoptedStyleSheets' 'CompressionStream'
  'DecompressionStream' 'ReadableStream.from' 'randomUUID' 'RegExp(' 'toSorted(' 'toReversed('
  'findLast(' '.at(' 'Object.hasOwn' 'Array.prototype.group' 'Intl.Segmenter'
  'navigator.clipboard' 'ClipboardItem' 'BroadcastChannel' 'SharedWorker' 'OffscreenCanvas'
  'requestAnimationFrame' 'IdleDeadline' 'PerformanceObserver' 'ReportingError'
  'Temporal.' 'Float16Array' 'Error.isError' 'Math.sumPrecise' 'Uint8Array.fromBase64'
  'toBase64(' 'RegExp.escape' 'Iterator.concat' 'ReadableStream.prototype[Symbol.asyncIterator]'
  'Symbol.asyncIterator' 'getSetCookie' 'Headers.prototype' 'AbortSignal.timeout'
  'onUncaughtError' 'onCaughtError'
)
CSS_PATTERNS=(
  'oklch(from' 'rgb(from' 'hsl(from' 'light-dark(' '@starting-style' 'text-wrap' 'field-sizing'
  'anchor-name' 'position-anchor' 'position-area' 'scrollbar-gutter' 'scrollbar-width' 'scrollbar-color'
  'content-visibility' 'interpolate-size' '@container' 'container-type' 'dvh' 'svh' 'lvh'
  ':has(' 'inert' 'popover' 'text-box-trim' 'view-transition' 'animation-timeline'
  '@property' 'color-mix(' 'oklab(' 'oklch(' 'overflow:clip' 'overflow: clip' 'overflow-clip-margin'
  '-webkit-fill-available' 'width:stretch' 'height:stretch' 'cqw' 'cqi' 'cqh' 'lh)' 'rlh)'
  'white-space-collapse' 'text-spacing-trim' 'contrast-color(' 'if(' 'round(' 'mod(' 'rem('
  'sign(' 'abs(' 'pow(' 'sqrt(' 'attr(' 'calc-size(' 'anchor(' 'anchor-size(' 'env(safe-area'
  'AccentColor' 'accent-color' 'corner-shape' 'reading-flow' 'sibling-index' 'display:contents'
  '@layer' 'inset:' 'inset-inline' 'inset-block' 'translate:' 'rotate:' 'scale:' 'backdrop-filter'
  '@supports' 'user-select' 'appearance:base' 'transition-behavior' 'allow-discrete'
  'overlay' 'text-underline-offset' 'text-decoration-thickness' 'font-optical-sizing'
  'contain:' 'contain-intrinsic' 'hanging-punctuation' 'math-depth' 'font-variant-emoji'
  '@scope' 'color(display-p3' 'color(srgb' 'text-autospace' 'line-clamp:' '-webkit-line-clamp'
  'field-sizing:content' 'scroll-marker' 'scroll-button' '::details-content' 'interactivity:'
  '&:' 'is(' 'where(' 'nth-child(' 'focus-visible' 'user-invalid' 'placeholder-shown'
  'shape()' 'clip-path:shape' 'view-timeline' 'reading-order' 'text-wrap:balance' 'text-wrap:pretty'
  'text-wrap:stable' 'contain-intrinsic-size' 'display:grid' 'subgrid' 'masonry' 'display:flow-root'
)
echo "== JS =="
for pat in "${JS_PATTERNS[@]}"; do
  c=$(grep -l -F -- "$pat" *.js 2>/dev/null | wc -l)
  [ "$c" -gt 0 ] && echo "$pat -> $c files"
done
echo "== CSS =="
for pat in "${CSS_PATTERNS[@]}"; do
  c=$(grep -l -F -- "$pat" *.css 2>/dev/null | wc -l)
  [ "$c" -gt 0 ] && echo "$pat -> $c files"
done

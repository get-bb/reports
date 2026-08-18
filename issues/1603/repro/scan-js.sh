#!/bin/bash
# Scan a built bb app bundle for JS APIs that iOS 16.7 Safari (last iOS for iPhone 8 Plus) lacks.
cd "$1"
pats=(
 'Object\.groupBy' 'Map\.groupBy' 'Promise\.withResolvers' 'Promise\.try\b' 'URL\.canParse' 'URL\.parse\b'
 '\.union\(' '\.intersection\(' '\.symmetricDifference\(' '\.isSubsetOf\(' '\.isSupersetOf\(' '\.isDisjointFrom\('
 'checkVisibility\(' 'AbortSignal\.any' 'Iterator\.from' 'Iterator\.prototype' 'startViewTransition' 'showPopover' 'hidePopover' 'togglePopover'
 'Symbol\.dispose' 'Symbol\.asyncDispose' 'RegExp\.escape' 'Float16Array' 'toBase64\(' 'fromBase64\(' 'setHTMLUnsafe' 'parseHTMLUnsafe' 'moveBefore\('
 'caretPositionFromPoint' 'new Highlight\(' 'CSS\.highlights' 'getComposedRanges' 'requestIdleCallback' 'adoptedStyleSheets' 'navigator\.userActivation'
 'Intl\.DurationFormat' 'isWellFormed\(' 'toWellFormed\(' 'toSorted\(' 'toReversed\(' 'toSpliced\(' '\.with\(' 'Array\.fromAsync' 'findLastIndex\(' 'findLast\('
 '\.values\(\)\.(map|filter|find|some|every|flatMap|reduce|forEach|take|drop|toArray)\(' '\.keys\(\)\.(map|filter|find|some|every|flatMap|reduce|forEach|take|drop|toArray)\(' '\.entries\(\)\.(map|filter|find|some|every|flatMap|reduce|forEach|take|drop|toArray)\('
 '\(\?<[=!]' 'static\s*\{' 'for await' 'scrollend' 'navigator\.wakeLock' 'screen\.orientation' 'structuredClone' 'URLSearchParams.*\.size' 'hasIndices' 'unicodeSets' '/[gimsuyd]*v[gimsuyd]*[,;)\.\s]'
 'contentVisibilityAutoStateChange' 'ResizeObserver' 'IntersectionObserver' 'BroadcastChannel' 'navigator\.locks' 'showModal\(' 'popover=' 'inert'
 'Intl\.Segmenter' 'Array\.prototype\.at' 'Object\.hasOwn' 'AbortSignal\.timeout' 'reportError\(' 'crypto\.randomUUID' 'TextDecoderStream' 'CompressionStream' 'DecompressionStream'
 'scheduler\.postTask' 'navigator\.scheduling' 'PerformanceObserver' 'largest-contentful-paint' 'navigation\.' 'window\.navigation'
 'CSSStyleSheet\(' 'CSS\.registerProperty' 'computedStyleMap' 'attributeStyleMap' 'CSS\.px'
)
for f in dist/assets/*.js; do
  hits=""
  for p in "${pats[@]}"; do
    c=$(grep -oE -- "$p" "$f" | wc -l)
    [ "$c" != 0 ] && hits="$hits\n    $p: $c"
  done
  [ -n "$hits" ] && echo -e "== $f ($(wc -c <"$f") bytes)$hits"
done

/**
 * Self-scrape parser verification — run with:
 *   node --experimental-strip-types scripts/self-scrape.test.ts
 */
import {
  extractInstagramUrls,
  parseAbbreviatedNumber,
  parseInstagramProfile,
} from '../src/lib/discovery/self-scrape.ts'

let failures = 0
function assert(name: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${name}`)
  if (!cond) failures += 1
}

// ── parseAbbreviatedNumber ──────────────────────────────────────
assert('plain number "1,234" → 1234', parseAbbreviatedNumber('1,234') === 1234)
assert('"1.2M" → 1200000', parseAbbreviatedNumber('1.2M') === 1_200_000)
assert('"12.3K" → 12300', parseAbbreviatedNumber('12.3K') === 12_300)
assert('"500" → 500', parseAbbreviatedNumber('500') === 500)
assert('garbage → undefined', parseAbbreviatedNumber('abc') === undefined)

// ── extractInstagramUrls ────────────────────────────────────────
const searchHtml = `
  <a href="https://www.instagram.com/sara.style/">Sara</a>
  bare display text instagram.com/noura_food without a scheme
  encoded redirect //duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.instagram.com%2Friyadhfoodguide
  <a href="https://www.instagram.com/p/Cabc123/">a post (reserved)</a>
  <a href="https://www.instagram.com/explore/tags/riyadh/">tag (reserved)</a>
  duplicate https://www.instagram.com/sara.style/
`
const urls = extractInstagramUrls(searchHtml)
assert('extracts full profile URL', urls.includes('https://www.instagram.com/sara.style/'))
assert('extracts scheme-less display text', urls.includes('https://www.instagram.com/noura_food/'))
assert('extracts percent-encoded URL', urls.includes('https://www.instagram.com/riyadhfoodguide/'))
assert('skips /p/ and /explore/ reserved paths', !urls.some((u) => u.includes('/p/') || u.includes('explore')))
assert('dedupes profiles', urls.filter((u) => u.includes('sara.style')).length === 1)

// ── parseInstagramProfile ───────────────────────────────────────
const profileHtml = `
<html><head>
<meta property="og:title" content="Sara Style (@sara.style) • Instagram photos and videos" />
<meta property="og:description" content="1.2M Followers, 800 Following, 350 Posts - See Instagram photos and videos from Sara Style" />
<meta name="description" content="1.2M Followers, 800 Following, 350 Posts - Sara Style (@sara.style) on Instagram: &quot;مدوّنة موضة من الرياض 🇸🇦 للتعاون sara@example.com&quot;" />
<meta property="og:image" content="https://cdn.example.com/sara.jpg" />
</head><body>{"is_verified": true}</body></html>
`
const profile = parseInstagramProfile('https://www.instagram.com/sara.style/', profileHtml)
console.log('\nparsed profile:', JSON.stringify(profile, null, 2))

assert('profile parsed (not null)', profile !== null)
assert('username extracted', profile?.username === 'sara.style')
assert('display name extracted', profile?.displayName === 'Sara Style')
assert('followers parsed (1.2M)', profile?.followers === 1_200_000)
assert('following parsed (800)', profile?.following === 800)
assert('posts parsed (350)', profile?.posts === 350)
assert('verified detected from html', profile?.verified === true)
assert('bio extracted from description quote', Boolean(profile?.bio && profile.bio.includes('موضة')))
assert('bio excludes counts/boilerplate', Boolean(profile?.bio && !profile.bio.includes('Posts') && !profile.bio.includes('on Instagram')))
assert('image extracted', profile?.profileImageUrl === 'https://cdn.example.com/sara.jpg')

// Profile with no usable follower signal → skipped.
const emptyHtml = '<html><head><meta property="og:title" content="Login • Instagram"></head></html>'
assert('profile with no follower signal → null', parseInstagramProfile('https://www.instagram.com/locked/', emptyHtml) === null)

console.log(`\n${failures === 0 ? '🎉 ALL PASSED' : `💥 ${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)

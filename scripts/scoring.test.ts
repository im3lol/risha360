/**
 * Scoring engine verification — run with:
 *   node --experimental-strip-types scripts/scoring.test.ts
 */
import { scoreCandidate } from '../src/lib/discovery/scoring.ts'
import type { DiscoveredCandidate, SearchPlan } from '../src/lib/discovery/types.ts'

const plan: SearchPlan = {
  version: 1,
  category: 'fashion',
  city: 'Riyadh',
  platforms: ['instagram'],
  minFollowers: 1000,
  targetCount: 50,
  queries: [],
  hashtags: [],
  createdAt: new Date().toISOString(),
}

// A) Clean macro creator — real Saudi fashion influencer with good engagement.
const cleanMacro: DiscoveredCandidate = {
  platform: 'instagram',
  username: 'sara.style.riyadh',
  displayName: 'سارة | موضة الرياض',
  bio: 'مدونة موضة وأناقة من الرياض 🇸🇦 للتعاون: sara@example.com',
  profileUrl: 'https://instagram.com/sara.style.riyadh',
  followers: 80_000,
  following: 800,
  posts: 350,
  verified: false,
  website: 'https://sarastyle.com',
  contactEmail: 'sara@example.com',
  sourceMetadata: { avgLikes: 3200, avgComments: 90 }, // → ~4.1% ER
}

// B) Obvious fake — bought followers, almost no posts, near-zero engagement.
const fakeAccount: DiscoveredCandidate = {
  platform: 'instagram',
  username: 'lux_deals_2026',
  displayName: 'Lux Deals',
  bio: '',
  profileUrl: 'https://instagram.com/lux_deals_2026',
  followers: 500_000,
  following: 6_000,
  posts: 2,
  verified: false,
  sourceMetadata: { engagementRate: 0.1 }, // far below the floor for 500k
}

// C) Clean micro — smaller but authentic with solid engagement and contact.
const cleanMicro: DiscoveredCandidate = {
  platform: 'instagram',
  username: 'noura.food.jeddah',
  displayName: 'نورة | أكل جدة',
  bio: 'وصفات ومطاعم جدة 🍽️ تواصل: noura@example.com',
  profileUrl: 'https://instagram.com/noura.food.jeddah',
  followers: 15_000,
  following: 400,
  posts: 200,
  verified: false,
  contactEmail: 'noura@example.com',
  sourceMetadata: { engagementRate: 2.8 },
}

const A = scoreCandidate(cleanMacro, plan)
const B = scoreCandidate(fakeAccount, plan)
const C = scoreCandidate(cleanMicro, plan)

function show(label: string, r: ReturnType<typeof scoreCandidate>) {
  console.log(`\n── ${label} ──`)
  console.log(`  total=${r.totalScore}  tier=${r.tier}  ER=${r.engagementRate}%`)
  console.log(
    `  sub: followers=${r.followersScore} engagement=${r.engagementScore} saudi=${r.saudiRelevanceScore} ` +
      `commercial=${r.commercialValueScore} contact=${r.contactAvailabilityScore} ` +
      `brandSafety=${r.brandSafetyScore} signup=${r.signupProbabilityScore}`
  )
  console.log(
    `  authenticity: fake=${r.authenticity.isFakeFollowersSuspected} ` +
      `fakePct=${r.authenticity.fakeFollowersPercentage}% authScore=${r.authenticity.authenticityScore}`
  )
  if (r.authenticity.signals.length) console.log(`  signals: ${r.authenticity.signals.join(' | ')}`)
}

show('A  clean macro (80k)', A)
show('B  fake account (500k)', B)
show('C  clean micro (15k)', C)

// ── Assertions ──────────────────────────────────────────────────
let failures = 0
function assert(name: string, cond: boolean) {
  console.log(`${cond ? '✅' : '❌'} ${name}`)
  if (!cond) failures += 1
}

console.log('\n── Assertions ──')
assert('Fake account is flagged as fake followers', B.authenticity.isFakeFollowersSuspected === true)
assert('Fake account fakePct is high (>= 50)', B.authenticity.fakeFollowersPercentage >= 50)
assert('Clean macro is NOT flagged', A.authenticity.isFakeFollowersSuspected === false)
assert('Clean micro is NOT flagged', C.authenticity.isFakeFollowersSuspected === false)
assert('Clean macro outscores the fake account', A.totalScore > B.totalScore)
assert('Fake account brand-safety score is penalised (< 8)', B.brandSafetyScore < 8)
assert('Clean macro reaches gold tier (>= 60)', A.totalScore >= 60)
assert('Clean micro qualifies at silver+ (>= 40)', C.totalScore >= 40)
assert('Saudi relevance maxed for clean macro', A.saudiRelevanceScore === 15)
assert('Engagement rate derived from likes/comments for macro (~4.1%)', A.engagementRate > 3.5 && A.engagementRate < 4.5)

console.log(`\n${failures === 0 ? '🎉 ALL PASSED' : `💥 ${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)

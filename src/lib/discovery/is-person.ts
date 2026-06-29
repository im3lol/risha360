// ============================================================================
// Risha 360 — "is this a real person/creator?" classifier (shared).
// ----------------------------------------------------------------------------
// Used to (a) keep only individual creators/celebrities/artists at ingestion
// and (b) purge existing non-person rows (restaurants, places, shops, guides,
// news/aggregator pages). Heuristic over username + name + bio + IG category,
// in English AND Arabic. Conservative: only rejects when there's a clear
// business/place signal, so real creators are never dropped.
// ============================================================================

// Clear business / place / page markers (reject). English + Arabic.
// Only STRONG, unambiguous business/place tokens. Deliberately excludes
// false-positive-prone words ("official", "est", "co", "cars", "auto",
// "media", "studio", "brand", "content", "services") that real creators use.
const BUSINESS_RE = new RegExp(
  [
    // English — word-bounded to avoid substring hits (e.g. "best", "disco").
    '\\brestaurants?\\b', '\\bcafe\\b', '\\bbakery\\b', '\\beatery\\b',
    '\\bstore\\b', '\\bshop\\b', '\\bshops\\b', '\\bmarket\\b', '\\bmarkets\\b',
    '\\bmart\\b', '\\bmall\\b', '\\bboutique\\b', '\\bwholesale\\b',
    '\\bllc\\b', '\\btrading\\b', '\\bfactory\\b', '\\bagency\\b',
    '\\bclinic\\b', '\\bhospital\\b', '\\bpharmacy\\b', '\\bhotel\\b',
    '\\bresort\\b', '\\bsalon\\b', '\\bgym\\b', '\\bacademy\\b',
    '\\binstitute\\b', '\\bmagazine\\b', '\\bnews\\b', '\\bguide\\b',
    '\\btoday\\b', '\\bdirectory\\b', '\\breal estate\\b', '\\brealestate\\b',
    '\\bjewelry\\b', '\\bjewellery\\b', '\\bcatering\\b', '\\bclub\\b',
    // Arabic
    'مطعم', 'مطاعم', 'كافيه', 'مقهى', 'مخبز', 'حلويات',
    'متجر', 'متاجر', 'سوق', 'مول', 'بوتيك', 'ماركت',
    'شركة', 'مؤسسة', 'مصنع', 'وكالة', 'عيادة', 'مستشفى', 'صيدلية',
    'فندق', 'منتجع', 'صالون', 'نادي', 'أكاديمية', 'معهد',
    'مجلة', 'وكالة أنباء', 'دليل', 'عقارات', 'سيارات',
    'مجوهرات', 'عطور', 'توصيل', 'فعاليات', 'زفاف', 'مناسبات',
  ].join('|'),
  'i'
)

// Positive creator markers (keep, overrides a weak business hit).
const PERSON_RE = new RegExp(
  [
    'creator', 'public figure', 'blogger', 'vlogger', 'influencer', 'artist',
    'musician', 'singer', 'actor', 'actress', 'model', 'author', 'poet',
    'photographer', 'comedian', 'athlete', 'player', 'coach', 'chef',
    'youtuber', 'streamer', 'presenter', 'host', 'content',
    'مؤثر', 'مؤثرة', 'فنان', 'فنانة', 'مطرب', 'مطربة', 'ممثل', 'ممثلة',
    'مذيع', 'مذيعة', 'لاعب', 'لاعبة', 'مدرب', 'شاعر', 'كاتب', 'مصور',
    'يوتيوبر', 'صانع محتوى', 'مشهور', 'نجم', 'كوميدي',
  ].join('|'),
  'i'
)

export interface PersonInput {
  username?: string | null
  fullName?: string | null
  bio?: string | null
  category?: string | null
  isBusiness?: boolean | null
  isVerified?: boolean | null
}

export interface PersonVerdict {
  isPerson: boolean
  reason: string
}

export function classifyPerson(p: PersonInput): PersonVerdict {
  const cat = (p.category || '').toLowerCase()
  const text = `${p.fullName || ''} ${p.username || ''} ${p.bio || ''}`.toLowerCase()

  // Verified + an explicit creator category/marker → definitely a person.
  if (PERSON_RE.test(cat)) return { isPerson: true, reason: `creator category: ${p.category}` }
  if (p.isVerified && PERSON_RE.test(text)) return { isPerson: true, reason: 'verified creator marker' }

  // Explicit business category → reject.
  if (cat && BUSINESS_RE.test(cat)) return { isPerson: false, reason: `business category: ${p.category}` }

  // Business/place markers in name/username/bio → reject.
  if (BUSINESS_RE.test(text)) {
    const hit = (text.match(BUSINESS_RE) || [])[0]
    return { isPerson: false, reason: `business/place marker: "${hit}"` }
  }

  // Business account flag with no creator signal → reject.
  if (p.isBusiness && !PERSON_RE.test(text) && !PERSON_RE.test(cat)) {
    return { isPerson: false, reason: 'business account, no creator signal' }
  }

  // Default: keep (avoid dropping real creators with sparse data).
  return { isPerson: true, reason: 'no business signal' }
}

export function isPerson(p: PersonInput): boolean {
  return classifyPerson(p).isPerson
}

// ============================================================================
// Risha 360 — Saudi creator name seeds.
// ----------------------------------------------------------------------------
// Instagram's top-search only returns diverse REAL creators when queried by a
// specific person's NAME (generic keywords return a tiny fixed brand-heavy set,
// and the similar-accounts graph is disabled). So autonomous discovery searches
// real Saudi creator names. This is the reliable, free baseline pool; when a
// Gemini key is configured the planner expands it with fresh AI-generated names.
//
// Names (not handles) are used on purpose: top-search resolves a name to the
// real verified account, and a wrong/unknown name simply returns nothing.
// ============================================================================

export const SAUDI_CREATOR_NAMES: string[] = [
  // ── TV / media / public figures ──────────────────────────────
  'أحمد الشقيري', 'ناصر القصبي', 'عبدالله السدحان', 'فايز المالكي',
  'إبراهيم الحجاج', 'يعقوب الفرحان', 'براء عالم', 'خلف الحربي',
  'علي الكلثمي', 'محمد القس',
  // ── Singers / musicians ──────────────────────────────────────
  'عبدالمجيد عبدالله', 'محمد عبده', 'راشد الماجد', 'ماجد المهندس',
  'عايض', 'عبادي الجوهر', 'رابح صقر', 'أصيل أبو بكر', 'وعد',
  'دلال أبو آمنة', 'عبدالله آل فروان', 'حكيم',
  // ── Comedy / YouTube / content ───────────────────────────────
  'تركي العلي', 'عبدالله الشهري', 'مشهور الدبيان', 'خالد ماجد',
  'بدر صالح', 'عمر حسين', 'فهد البتيري', 'سعد الرشيدي',
  'عبدالرحمن الخضيري', 'محمد الرخيص', 'تركي آل الشيخ',
  // ── Fashion / beauty / lifestyle ─────────────────────────────
  'نجود الشمري', 'أسيل عمران', 'رزان مقبل', 'لميس الحمدان',
  'مشاعل الشحي', 'نوف السلطان', 'لمى الغامدي', 'هند القحطاني',
  'سارة الودعاني', 'مودل روز', 'دانة الطويرش', 'ريم العبدالله',
  // ── Food / chefs ─────────────────────────────────────────────
  'منيرة المشخص', 'بدور سعودي شيف', 'شيف سعودي', 'مطبخ منال العالم',
  // ── Sports / athletes ────────────────────────────────────────
  'سالم الدوسري', 'ياسر القحطاني', 'سلمان الفرج', 'فراس البريكان',
  'عبدالله المعيوف', 'محمد البريك', 'سامي الجابر', 'ماجد عبدالله',
  // ── Travel / tech / niche creators ──────────────────────────
  'مسافر سعودي', 'مراجعات تقنية سعودي', 'صانع محتوى سفر',
  // ── Broad fallbacks (used only when the named pool is exhausted)
  'فنان سعودي', 'ممثل سعودي', 'مذيع سعودي', 'لاعب سعودي',
  'مطرب سعودي', 'يوتيوبر سعودي', 'مؤثرة سعودية', 'كوميدي سعودي',
]

/**
 * A rotating slice of the names pool so each autonomous run searches DIFFERENT
 * creators (avoids re-hitting the same accounts — the old "90% duplicates"
 * problem). `offset` is typically the agent's total_runs counter.
 */
export function pickCreatorNames(count: number, offset: number): string[] {
  const pool = SAUDI_CREATOR_NAMES
  const n = pool.length
  if (n === 0) return []
  const take = Math.min(Math.max(count, 1), n)
  const start = ((offset % n) + n) % n
  const out: string[] = []
  for (let i = 0; i < take; i++) out.push(pool[(start + i) % n])
  return out
}

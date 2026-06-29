# Risha 360 — خطة التنفيذ (محدّثة على الكود الفعلي)

> مرجع عمل لفريق التطوير. **اتعمل بعد مراجعة الكود الموجود فعلاً**، مش افتراضات.
> النظام: discovery agent بيبحث عن مؤثرين سعوديين، يسحب بياناتهم، ينضّفها ويقيّمها،
> يسجّلها Leads، ثم يوزّعها على sales agents للتواصل (بمراجعة بشرية).

**آخر تحديث:** يونيو 2026 — v2 (post-review)

---

## 0. المعمارية الفعلية (مش المقترحة)

التطبيق الأساسي = **Next.js 16 + Supabase**. مفيش backend منفصل في الإنتاج.

```
discovery agent (worker بيعمل tick كل دقيقة؛ بحث جديد يبدأ كل interval_minutes)  →  /api/agent/tick
        │
        ▼
  Query Planner (Gemini أو fallback deterministic)  ← src/lib/discovery/query-planner.ts
        │
        ▼
  Discovery Source (مُبدِّل)  ← src/lib/discovery/source.ts
    ├─ self_scrape (افتراضي): Crawl4AI/Scrapling  ← src/lib/discovery/self-scrape.ts   (بدون API مدفوع)
    └─ apify (legacy اختياري): Apify Search       ← src/lib/discovery/apify.ts          (يحتاج APIFY_TOKEN)
        │
        ▼
  Enrichment (Scrapling → Crawl4AI → Browser-use)  ← src/lib/discovery/enrichment.ts
        │
        ▼
  Scoring & Authenticity Engine  ← src/lib/discovery/scoring.ts   ★ جديد
        │
        ▼
  Storage (Supabase RPC save_discovered_candidate)  ← src/lib/discovery/storage.ts
        │
        ▼
  routing للـ sales agent + مسودة دعوة عربية (مراجعة بشرية قبل الإرسال)
```

| الطبقة | الأداة الفعلية | الملف |
|---|---|---|
| Frontend / Dashboard | Next.js 16 + Radix UI | `src/components/dashboard/*` |
| قاعدة البيانات | Supabase (Postgres) | `supabase-migration.sql` |
| بحث/اكتشاف | **self-scrape (Crawl4AI/Scrapling)** افتراضياً، أو Apify (legacy) | `src/lib/discovery/source.ts` + `self-scrape.ts` / `apify.ts` |
| تخطيط البحث | **Gemini / OpenRouter** (أو fallback deterministic) | `src/lib/discovery/query-planner.ts` |
| إثراء | Scrapling / Crawl4AI / Browser-use | `integrations/` |
| تقييم + كشف وهمي | TypeScript engine | `src/lib/discovery/scoring.ts` |
| الوكيل المستقل | tick endpoint + worker | `scripts/discovery-worker.mjs` |

> ⚠️ **`reesha/backend` (Python/FastAPI) = legacy ومش موصول.** راجع `reesha/DEPRECATED.md`.

---

## 1. حالة التنفيذ (Done vs Pending)

### ✅ متنفّذ وشغّال
- Dashboard كامل (overview, discovery, leads, outreach, agent, analytics, settings).
- Discovery orchestrator + query planner (OpenAI + fallback) + Apify search.
- Enrichment pipeline (Scrapling → Crawl4AI → Browser-use) مع سقف ٢٥ موقع/دفعة.
- Supabase schema (١٠ جداول) + RPCs للحفظ والتوزيع.
- Autonomous agent بـ tick كل دقيقة + قفل ذري لمنع التداخل.

### ✅ اتعمل في الجولة دي (post-review)
- **Scoring & Authenticity Engine حقيقي** (`src/lib/discovery/scoring.ts`):
  إطار ١٠٠ نقطة + **كشف فولوورز وهميين** (مكنش موجود — كان scoring ثابت).
- توصيله بالـ storage + بعت كل الحقول للـ Supabase.
- **Migration 003** (`migrations/003_scoring_authenticity.sql`) يخزّن الـ sub-scores
  والـ engagement_rate و is_fake_followers_suspected / fake_followers_percentage في
  أعمدتها (كانت موجودة وفاضية).
- اختبارات (`scripts/scoring.test.ts`) — كلها ناجحة.
- ملاحظة deprecation على `reesha/backend` القديم (Python). *(الكود ده مقطوع ومش هيتصلّح — بس متعلَّم عليه إنه legacy.)*

### ⛔ Blocker حالي — لازم يتظبط
- **خدمات الـ self-scraping لازم تشتغل.** المصدر الافتراضي بقى `self_scrape` (مفيش Apify).
  شغّل `bun run enrichment:up` (Crawl4AI + Scrapling) واضبط `CRAWL4AI_BASE_URL` /
  `SCRAPLING_SERVICE_URL` في `.env`. من غير أي خدمة منهم الـ agent هيطبع
  `waiting_for_provider`.
- لازم تتشغّل **Migration 003** في Supabase SQL Editor عشان الحقول الجديدة تتخزّن.
- (اختياري) `GEMINI_API_KEY` للتخطيط الذكي — من غيره بيشتغل بالـ deterministic templates.

### 🔜 Pending (الخطوات الجاية)
- تشغيل خدمات الإثراء (Scrapling/Crawl4AI) وضبط URLs في `.env`.
- جمع بيانات posts (likes/comments) عشان الـ engagement يتحسب حقيقي مش conservative.
- منصات إضافية (تيك توك/سناب شات/يوتيوب) — السكيمة بتدعم، الـ search لإنستجرام بس.
- تحسين معادلات كشف الوهمي بالبيانات الحقيقية (calibration).

---

## 2. الـ Scoring & Authenticity Engine (الجديد)

إطار ١٠٠ نقطة (أوزان قابلة للتعديل في `DEFAULT_WEIGHTS`):

| البُعد | النقاط |
|---|---|
| Followers | 25 |
| Engagement | 25 |
| Saudi Relevance | 15 |
| Commercial Value | 10 |
| Contact Availability | 10 |
| Brand Safety | 10 |
| Signup Probability | 5 |

**كشف الفولوورز الوهميين** (`detectFakeFollowers`) بيستخدم الإشارات المتاحة فعلاً:
- following >> followers على حساب كبير → نمط bot.
- engagement أقل بكتير من المتوقع لحجم الجمهور.
- جمهور ضخم بدون بوستات (حساب مشترى).
- حساب كبير بدون bio ولا website (إشارة مساندة).
- الحسابات الموثّقة بياخدوا تخفيف في العقوبة.

المخرجات: `fakeFollowersPercentage`, `isFakeFollowersSuspected`, `authenticityScore`,
+ إشارات نصية للشفافية. التصنيف: platinum/gold/silver/bronze/unqualified.

> ملاحظة مهمة: لما مفيش بيانات engagement حقيقية، الـ engine بيدي درجة **متحفظة**
> (مش رقم ثابت مضلِّل) ويقلّل `data_completeness` — ده تصحيح للسلوك القديم.

---

## 3. أولويات الخطوة الجاية (مرتّبة)

1. **شغّل خدمات الـ self-scraping** (`bun run enrichment:up`) واضبط `CRAWL4AI_BASE_URL`/`SCRAPLING_SERVICE_URL` → يفكّ الـ blocker ويشغّل الـ pipeline بدون أي API مدفوع.
2. **شغّل `migrations/003_scoring_authenticity.sql`** في Supabase.
3. **شغّل خدمات الإثراء فعلياً** (الـ URLs زي `SCRAPLING_SERVICE_URL` و `BROWSER_USE_SERVICE_URL` مضبوطة في `.env` بالفعل — الناقص تشغيل الخدمات نفسها؛ `CRAWL4AI_BASE_URL` لسه مش مضاف).
4. اعمل دفعة discovery تجريبية صغيرة وتأكد إن الـ Leads بتتخزّن بـ scores + authenticity.
5. ابدأ جمع بيانات posts عشان الـ engagement يبقى حقيقي 100%.

---

## 4. ملاحظات تقنية

- نظّف القرص: احذف مجلد `reesha/backend/venv` (متسطّب بالغلط). ⚠️ المشروع **مش git repo** أصلاً (مفيش `.git`) — فالكلام عن "شيله من git" مش منطبق؛ المطلوب حذفه من القرص.
- وحّد على codebase واحد (Next.js) واحذف الـ legacy بعد تأكيد إنه مش مستخدم.
- كل أوزان وعتبات الـ scoring في الكود كـ constants — سهل تعايرها بدون DB.

### ✅ اتعمل في جولة "Docker + OpenRouter"
- **المشروع كله اتدوكَر.** `Dockerfile` (multi-stage: build بـ Bun → standalone server بـ Node،
  + هدف `worker` منفصل) و `docker-compose.yml` في الجذر بيشغّل المنظومة كلها على شبكة واحدة:
  `app` + `worker` + `scrapling` + `crawl4ai` (و `browser-use` خلف profile اختياري لأنه تقيل).
  - أوامر التشغيل: `docker compose up -d --build` (الأساسي)، أو
    `docker compose --profile browser-use up -d --build` لتضمين browser-use.
  - الـ URLs الداخلية بتتظبط تلقائياً على أسماء شبكة compose
    (`http://scrapling:8011`, `http://crawl4ai:11235`, الـ worker → `http://app:3000`).
  - `NEXT_PUBLIC_*` بتتمرّر كـ build args (لأنها بتتحقن في الـ bundle وقت البناء).
  - الـ worker اتعدّل (`scripts/discovery-worker.mjs`) يقرا `process.env` لو مفيش ملف `.env` (Docker-friendly).
  - `.dockerignore` بيستبعد node_modules/.next/vendor/logs عشان الـ build context يفضل خفيف.
- **اتضاف OpenRouter كمزوّد LLM** للمخطّط (OpenAI-compatible). مُبدِّل `PLANNER_PROVIDER`
  (`auto` افتراضي → OpenRouter ثم Gemini ثم deterministic، أو فرض مزوّد بعينه). متغيّرات:
  `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` (افتراضي `google/gemini-2.0-flash-exp:free` — **تأكد من صلاحيته**).
- التحقق: `next build` كامل ناجح + صورة الـ worker اتبنت في Docker + `docker compose config` صحيح
  + `tsc`/`eslint`/الاختبارات نضافة.

### ✅ تشغيل فعلي على Docker + إصلاح الاكتشاف (end-to-end)
- **المنظومة اشتغلت فعلياً** بـ `docker compose up -d --build`: `app` + `worker` + `scrapling` +
  `crawl4ai` كلهم running/healthy. الـ worker بيوصل `app` (200) والمصادقة وSupabase شغّالين.
- **منفذ 3000:** لو خادم محلي ماسكه، استخدم `APP_PORT` (مثلاً `APP_PORT=3001 docker compose up -d`).
  الحاوية بتسمع داخلياً على 3000 دايماً، فالـ worker→app ما بيتأثرش.
- **🐞 إصلاح حرج في الاكتشاف الذاتي:** أول تشغيل رجّع `found:0`. السبب: محرّك البحث بيعرض روابط
  إنستجرام **بدون `https://`** أو **مُرمّزة (`%2F`)**، و `extractInstagramUrls` كان بيشترط بادئة
  `https://` حرفياً. الـ regex اتعدّل ليلتقط الصيغ الثلاث (`src/lib/discovery/self-scrape.ts`).
  كمان اتحسّن استخراج الـ bio من وسم `description` (النص الحقيقي بين علامتي اقتباس).
- **النتيجة بعد الإصلاح:** دفعة Fashion/Riyadh رجّعت **`found:26, created:26, errors:0`** —
  26 lead اتحفظوا فعلاً في Supabase من زحف حيّ (DuckDuckGo → crawl4ai → بروفايلات → scoring → حفظ).
  الزحف بياخد ~٣-٤ دقايق للدفعة (متصفّح headless لكل بروفايل) — متوقّع.
- ملاحظة: `routed:0 to sales` طبيعي — التوزيع للمبيعات بيحتاج leads مؤهّلة (score عالي) + وجود
  sales agents؛ مش خطأ.

### ✅ جولة "Browser Session Agent" (اكتشاف بمتصفح stealth)
مصدر اكتشاف جديد **أقوى وأقل عرضة للحظر** + بيانات engagement حقيقية:
- **خدمة `instagram-agent`** (`integrations/instagram-agent/`): FastAPI + **Camoufox**
  (فايرفوكس مضاد-بصمة عبر Playwright) بيتصفّح إنستجرام **كإنسان** (إيقاع عشوائي، حدود).
- **التقاط الـ API الداخلي:** بينادي `web_profile_info` من داخل الصفحة → followers + following +
  posts + **likes/comments للبوستات الأخيرة** → **engagement rate حقيقي** (يحل P4).
  الاكتشاف عبر بحث إنستجرام الداخلي (لو فيه جلسة) أو محرّكات بحث.
- **التكامل:** `DISCOVERY_SOURCE=browser_session` عبر المُبدِّل (`src/lib/discovery/source.ts`
  + `browser-session.ts`). الـ candidate بيمرّر avgLikes/avgComments في `sourceMetadata`
  فالـ scoring بياخد الـ engagement الحقيقي تلقائياً.
- **التشغيل:** `docker compose --profile browser-agent up -d` (الخدمة تقيلة فبتشتغل opt-in).
- **مضاد الحظر (إعدادات `.env`):** `IG_PROXY` (بروكسي سكني/موبايل — **الأهم**)،
  `IG_STORAGE_STATE`/`IG_COOKIES` (جلسة بحساب **burner** مش البراند)، `IG_MAX_PROFILES`/الـ delays.
- ⚠️ **مهم:** بدون بروكسي سكني وجلسة، إنستجرام هيحظر بسرعة. ده best-effort لـ lead-gen مصرّح به.

### ✅ جولة "تنفيذ خطة المراجعة" (أمان + أداء + تنظيف)
- **P2 أداء:** جلب البروفايلات بقى **متوازي** (pool=5) بدل تسلسلي، واكتشاف الروابط متوازي (pool=3)
  عبر `runPool` (`src/lib/discovery/self-scrape.ts`) → تسريع الدفعة بشكل كبير.
- **P3 صلابة:** محرّكات بحث احتياطية (DuckDuckGo ثم Bing) + **retry مع backoff** على الزحف.
- **P7 رصد:** الـ pipeline بيكتب في `activity_log` عند بدء/اكتمال الدفعة (`orchestrator.ts`) →
  قسم "النشاط الأخير" في الـ dashboard بقى بيشتغل.
- **S5 أمان:** مقارنة سر الـ tick بقت **constant-time** (`crypto.timingSafeEqual`) في
  `src/app/api/agent/tick/route.ts`.
- **S4+S8 أمان:** تحقّق مدخلات بـ **zod** على مسارات الكتابة (leads/tasks/outreach) +
  **تعقيم رسائل الأخطاء** (مفيش تسريب أخطاء Postgres للعميل) عبر `src/lib/api-validation.ts`.
- **S6 أمان:** حاويات Docker بتشتغل كمستخدم **non-root** (`USER node`) + `HEALTHCHECK` داخل الـ Dockerfile.
- **P8 تنظيف:** سكربتات `enrichment:*` اتحوّلت لـ `docker:up/down/logs` (تشير للـ compose الجذري)؛
  حُذف `integrations/docker-compose.yml` المكرّر ومجلد `reesha/` القديم.

#### ⏳ بنود تحتاج إجراءك (مش كود)
- **S1 (الأهم):** عطّل **public signup** في Supabase Auth (أو allow-list) — وإلا أي مستخدم يسجّل
  يقدر يقرأ كل الـ leads. الكود بيتحقق من المصادقة لكن مش من التفويض.
- **S2:** اضبط `AGENT_CRON_SECRET` منفصلاً في `.env` بدل الاعتماد على `SUPABASE_SERVICE_ROLE_KEY`.
- **P6:** تحقّق إن `OPENROUTER_MODEL` اسم نموذج صالح في حسابك.

### ✅ اتعمل في جولة "إزالة Apify + Gemini"
- **شِيل الاعتماد على Apify كمصدر افتراضي.** اتعمل مُبدِّل مصدر (`src/lib/discovery/source.ts`)
  بيختار `DISCOVERY_SOURCE`: `self_scrape` (افتراضي) أو `apify` (legacy لسه موجود).
- **اكتشاف ذاتي بدون API مدفوع** (`src/lib/discovery/self-scrape.ts`): Crawl4AI بيزحف صفحة
  نتائج بحث (DuckDuckGo HTML) → يستخرج روابط إنستجرام → يجلب كل بروفايل ويحلّل `og:description`
  (Followers/Following/Posts) و `og:title` (الاسم). نفس دورة حياة Apify (start→poll→collect)
  فالـ orchestrator ما اتغيّرش جوهرياً.
- **بدّلنا OpenAI بـ Gemini** في التخطيط (`query-planner.ts`) — `GEMINI_API_KEY` +
  `GEMINI_DISCOVERY_MODEL` (افتراضي `gemini-2.0-flash`)، مع نفس الـ fallback deterministic.
- اختبارات parsers جديدة (`scripts/self-scrape.test.ts`) — 19 assertion كلها ناجحة.
  `tsc --noEmit` و `eslint src` نضافين.
- **حوّلنا browser-use كمان لـ Gemini** (`integrations/browser-use-api/app.py` → `ChatGoogle`
  + `GEMINI_API_KEY`، و `docker-compose.yml` اتحدّث). دلوقتي **مفيش أي اعتماد على OpenAI** في
  كل المشروع.
- اتأكدنا بـ `next build` كامل (Next 16 / Turbopack) — تجميع + TypeScript + 14 route كلها نجحت.
- ⚠️ **هشاشة متوقّعة:** الاكتشاف الذاتي بيعتمد على markup محرّكات البحث وإنستجرام (ممكن rate-limit
  أو login wall). أي بروفايل ما يتقريش بيتـ skip بدل ما يفشّل الدفعة. ده best-effort مش API مضمون.

### ✅ اتصلّح في جولة الإصلاح دي
- **تضخّم درجة Brand Safety — اتصلّح.** `scoreBrandSafety` كان بيدّي ثابت ~7 نقاط لكل حساب (5 افتراضي + 2 "no flags") قبل أي إشارة محتوى حقيقية. دلوقتي بيرتكز على إشارة الـ authenticity الحقيقية: حساب نظيف ياخد درجة محايدة (0.5×max)، والمشبوه بفولوورز وهميين بيتعاقب بالتناسب (لحد 0.1×max). الاختبارات العشرة في `scripts/scoring.test.ts` **كلها ناجحة بعد التعديل** و `tsc --noEmit` نضيف.

### ⚠️ مشاكل مرصودة لسه مش متعالجة
- **lockfile مزدوج:** `bun.lock` + `package-lock.json` موجودين مع بعض → تعارض محتمل في الإصدارات. المشروع بيستخدم bun فعلياً، فالمفروض يتحذف `package-lock.json`. ⚠️ **محتاج صلاحية admin** — الملف مملوك لـ `BUILTIN\Administrators` ومجموعة `Users` معندهاش صلاحية Delete. شغّل من PowerShell كـ admin: `Remove-Item package-lock.json -Force`.
- **تحقّق من اسم نموذج Gemini** (`GEMINI_DISCOVERY_MODEL`، افتراضي `gemini-2.0-flash`) في حسابك قبل ربط `GEMINI_API_KEY` — لو غلط بيسقط للـ deterministic fallback بصمت (مع log).
- **سر الـ cron بيتراجع لمفتاح حسّاس:** `AGENT_CRON_SECRET` بيـfallback لـ `SUPABASE_SERVICE_ROLE_KEY` ويتبعت في HTTP header (`src/app/api/agent/tick/route.ts`). اضبط `AGENT_CRON_SECRET` منفصل في `.env` وما تعتمدش على تسريب مفتاح الـ service-role.

> القاعدة الذهبية: **القيمة في الثقة وجودة الداتا، مش كمية الـ Leads.**

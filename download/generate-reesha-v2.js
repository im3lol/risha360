const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, SectionType,
} = require("docx");
const fs = require("fs");

// Palette — DM-1 Deep Cyan
const P = {
  primary: "162235", body: "1A2B40", secondary: "6878A0", accent: "37DCF2",
  surface: "F8F9FF",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const hBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
  left: NB, right: NB,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
  insideVertical: NB,
};

// Helpers
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200, line: 312 }, children: [new TextRun({ text: t, bold: true, size: 32, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160, line: 312 }, children: [new TextRun({ text: t, bold: true, size: 28, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 120, line: 312 }, children: [new TextRun({ text: t, bold: true, size: 24, color: P.primary, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] });
const p = (t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 }, indent: { firstLine: 480 }, children: [new TextRun({ text: t, size: 24, color: "000000", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] });
const pni = (t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 120 }, children: [new TextRun({ text: t, size: 24, color: "000000", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] });
const bp = (t) => new Paragraph({ spacing: { line: 312, after: 80 }, children: [new TextRun({ text: t, bold: true, size: 24, color: "000000", font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] });
const code = (lines) => lines.map(l => new Paragraph({ spacing: { line: 276, after: 0 }, indent: { left: 480 }, children: [new TextRun({ text: l, size: 20, font: { ascii: "Courier New", eastAsia: "Courier New" }, color: "1A2B40" })] }));

function tbl(headers, rows, widths) {
  const w = widths || headers.map(() => Math.floor(100 / headers.length));
  function makeHCell(h, i) {
    return new TableCell({
      width: { size: w[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: P.table.headerText, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] })],
    });
  }
  function makeDCell(cell, ci, ri) {
    return new TableCell({
      width: { size: w[ci], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? P.table.surface : "FFFFFF" },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, color: "000000", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] })],
    });
  }
  const hRow = new TableRow({ tableHeader: true, cantSplit: true, children: headers.map(makeHCell) });
  const dRows = rows.map((row, ri) => new TableRow({ cantSplit: true, children: row.map((cell, ci) => makeDCell(cell, ci, ri)) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: hBorders, rows: [hRow, ...dRows] });
}

function agentSection(num, name, purpose, state, inputs, outputs, tools, prompt, failure, outputJson) {
  const items = [];
  items.push(h2(`${num} ${name}`));
  items.push(h3(`${num}.1 Purpose`));
  items.push(p(purpose));
  items.push(h3(`${num}.2 State`));
  items.push(p(state));
  items.push(h3(`${num}.3 Inputs`));
  items.push(p(inputs));
  items.push(h3(`${num}.4 Outputs`));
  items.push(p(outputs));
  items.push(...code(outputJson));
  items.push(h3(`${num}.5 Tools`));
  items.push(p(tools));
  items.push(h3(`${num}.6 Prompt Strategy`));
  items.push(p(prompt));
  items.push(h3(`${num}.7 Failure Handling`));
  items.push(p(failure));
  return items;
}

function buildCover() {
  const titlePt = 44, subPt = 22;
  const meta = ["Production-Grade Technical Specification", "Version 2.0", "June 2026", "Confidential"];
  const darkBg = "162235";
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBordersCell = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const coverCell = new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: darkBg },
    borders: noBordersCell,
    margins: { top: 2400, bottom: 1200, left: 1200, right: 1200 },
    children: [
      new Paragraph({ spacing: { line: Math.ceil(titlePt * 23), lineRule: "atLeast", after: 200 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Reesha", bold: true, size: titlePt * 2, color: "FFFFFF", font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] }),
      new Paragraph({ spacing: { line: Math.ceil(subPt * 23), lineRule: "atLeast", after: 400 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: "AI-Powered Creator Acquisition Operating System", size: subPt * 2, color: "B0B8C0", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "37DCF2", space: 12 } }, spacing: { after: 600 }, children: [] }),
      ...meta.map(l => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { line: 312, after: 80 }, children: [new TextRun({ text: l, size: 22, color: "90989F", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] })),
    ],
  });
  const coverRow = new TableRow({ children: [coverCell] });
  const coverTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    height: { size: 100, rule: "exact" },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [coverRow],
  });
  return [coverTable];
}

function buildBody() {
  const c = [];

  // ═══ EXECUTIVE SUMMARY ═══
  c.push(h1("1. Executive Summary and Architectural Philosophy"));
  c.push(p("Reesha is not designed as a simple scraping tool. It is designed as an Autonomous Acquisition Operating System. The difference is fundamental: a scraper collects data; an operating system understands market gaps, orchestrates intelligence agents, enforces business logic, manages compliant communications, and drives a measurable conversion funnel. This specification defines every component, contract, and workflow required to build this operating system."));
  c.push(p("The system connects influencers, artists, actors, and creators with brands, restaurants, companies, and advertising agencies for marketing campaigns. While the public Reesha platform already exists, this specification defines the internal AI-powered Creator Acquisition System - the engine that continuously discovers, qualifies, stores, contacts, and converts creators into registered Reesha members. The goal is to build the largest structured database of Saudi creators and then systematically convert them into active platform members."));

  c.push(h2("1.1 Architectural Challenges and Strategic Decisions"));
  c.push(p("Four critical architectural challenges shape the system design. First, Anti-Fragile Collection: relying purely on web scrapers for Instagram and TikTok is fragile. The architecture must use a hybrid approach combining Apify for rapid MVP, Crawlee plus Playwright for long-term anti-bot evasion, and semantic fallbacks including search engines and public directories. This multi-layer strategy ensures that when one collection method fails, alternatives are already in place."));
  c.push(p("Second, Stateful Agent Orchestration: seventeen agents running ad-hoc will cause race conditions and data corruption. The system implements Three Distinct LangGraph Stateful Workflows (Discovery, Enrichment, Outreach) rather than seventeen isolated scripts. Each workflow maintains shared state, supports checkpointing for error recovery, and enforces ordering guarantees that prevent concurrent modification issues."));
  c.push(p("Third, Vector-Native Deduplication: string matching fails for Arabic and English name variations. The system uses pgvector for semantic identity resolution, matching names like the Arabic and English forms of the same name via embedding cosine similarity. This approach also handles transliteration variations, nickname patterns, and cross-platform username differences that traditional matching would miss."));
  c.push(p("Fourth, the Closed-Loop Acquisition: the system must be a closed-loop operating system. The Market Coverage Agent feeds back into the Discovery Director to autonomously fix under-represented categories. This creates a compounding asset: the database gets smarter, cleaner, and more comprehensive every day without linear human effort. The machine builds the moat."));

  // ═══ 2. SYSTEM ARCHITECTURE ═══
  c.push(h1("2. System Architecture"));
  c.push(h2("2.1 High-Level Architecture"));
  c.push(p("The Reesha Creator Acquisition Operating System is designed as a layered, event-driven architecture. The Frontend Layer (Next.js on Vercel) provides the internal dashboard. The API Gateway (FastAPI on Railway) exposes REST and WebSocket endpoints. The Orchestration Layer (LangGraph plus Celery) manages three stateful workflows: Discovery, Enrichment, and Outreach. The Data and Queue Layer (Supabase PostgreSQL with pgvector plus Redis) provides persistent storage and task distribution. The Scraping Mesh (Apify, Crawlee, Firecrawl, Crawl4AI) executes physical data extraction."));
  c.push(p("The architecture follows an event-driven pattern where each workflow produces output that triggers downstream processing. The Discovery Director Agent controls all collection activities, ensuring that scraping is targeted and strategic. Results flow through the enrichment pipeline, then to scoring and outreach. Human approval gates exist at the outreach stage to maintain quality and compliance. The following Mermaid diagram illustrates the high-level component relationships:"));
  c.push(...code([
    'graph TD',
    '    subgraph Frontend ["Next.js + Vercel"]',
    '      Dash[Internal Dashboard]',
    '    end',
    '    subgraph API ["FastAPI + Railway"]',
    '      API_GW[REST and WebSocket APIs]',
    '    end',
    '    subgraph Orch ["LangGraph + Celery"]',
    '      DiscWF[Discovery Workflow]',
    '      EnrWF[Enrichment Workflow]',
    '      OutWF[Outreach Workflow]',
    '      Dir[Discovery Director]',
    '    end',
    '    subgraph Data ["Supabase + Redis"]',
    '      DB[(PostgreSQL + pgvector)]',
    '      Q[(Redis / Celery)]',
    '    end',
    '    subgraph Scrape ["Scraping Mesh"]',
    '      Apify[Apify Actors]',
    '      Crawlee[Crawlee Cluster]',
    '      FC[Firecrawl / Crawl4AI]',
    '    end',
    '    Dash -->|REST| API_GW',
    '    API_GW -->|Dispatch| Q',
    '    Q -->|Consume| Orch',
    '    Dir -->|Create Jobs| Q',
    '    DiscWF -->|Execute| Scrape',
    '    EnrWF -->|Execute| FC',
    '    OutWF -->|Read/Write| DB',
    '    Scrape -->|Raw Data| API_GW',
    '    API_GW -->|Persist| DB',
  ]));

  c.push(h2("2.2 Agent Architecture: Three LangGraph Workflows"));
  c.push(p("Instead of seventeen isolated agents, the system groups them into three stateful LangGraph workflows. This allows shared state, checkpointing, and error recovery. The Discovery Workflow contains the Discovery Director, Search Strategy Agent, and Collector Agents. It loops until the batch target is met or no more results are found. The Enrichment Workflow processes raw profiles through Profile Enrichment, Category Classification, Saudi Relevance, Engagement Analysis, Deduplication Identity, Lead Scoring, and Market Coverage Update. The Outreach Workflow handles Lead Assignment, AI Sales Outreach, Human Approval Gate, Conversation Agent, Follow-up Agent, and Human Escalation."));
  c.push(...code([
    'graph TD',
    '  subgraph DiscoveryWF ["Discovery Workflow"]',
    '    DD[Discovery Director] --> SS[Search Strategy]',
    '    SS --> CA[Collector Agent]',
    '    CA --> DD2{More Needed?}',
    '    DD2 -->|Yes| SS',
    '    DD2 -->|No| Stop1[End Batch]',
    '  end',
    '  subgraph EnrichmentWF ["Enrichment Workflow"]',
    '    Start2[Raw Profile] --> PE[Profile Enrichment]',
    '    PE --> CC[Category Classification]',
    '    CC --> SR[Saudi Relevance]',
    '    SR --> EA[Engagement Analysis]',
    '    EA --> DI[Deduplication Identity]',
    '    DI --> LS[Lead Scoring]',
    '    LS --> MC[Market Coverage Update]',
    '  end',
    '  subgraph OutreachWF ["Outreach Workflow"]',
    '    Start3[Qualified Lead] --> LA[Lead Assignment]',
    '    LA --> ASO[AI Sales Outreach]',
    '    ASO --> HA[Human Approval Gate]',
    '    HA -->|Approved| CN[Conversation Agent]',
    '    CN --> FU[Follow-up Agent]',
    '    FU --> HE{Escalate?}',
    '    HE -->|Yes| HUM[Human Escalation]',
    '    HE -->|No| CN',
    '  end',
  ]));

  c.push(h2("2.3 Data Flow"));
  c.push(p("Data flows through the system in a well-defined pipeline. A market gap triggers the Discovery Director, which generates search queries. Collectors produce raw HTML/JSON that is parsed by Scrapling into structured profiles. The Deduplication Agent uses pgvector similarity to create unique creator records. Enrichment agents expand the profile with external data. Scoring produces qualified leads. The AI Sales Agent generates draft messages. Human review approves outreach. Sent messages are tracked through to registration."));
  c.push(...code([
    'flowchart LR',
    '  A[Market Gap] --> B(Discovery Director)',
    '  B --> C{Search Queries}',
    '  C -->|Apify/Crawlee| D[Raw HTML/JSON]',
    '  D --> E[Scrapling Parser]',
    '  E --> F[Structured Profile]',
    '  F --> G[Deduplication Agent]',
    '  G -->|pgvector similarity| H[Unique Creator]',
    '  H --> I[Enrichment Agents]',
    '  I --> J[Scored Lead]',
    '  J --> K[AI Sales Agent]',
    '  K --> L[Draft Message]',
    '  L --> M[Human Review]',
    '  M --> N[Outreach Sent]',
    '  N --> O[Registration Tracking]',
  ]));

  c.push(h2("2.4 Event Flow and Queue Architecture"));
  c.push(p("The system uses Redis-backed Celery queues organized into four priority lanes: discovery_tasks, enrichment_tasks, outreach_tasks, and analytics_tasks. Producers include FastAPI endpoints and the Celery Beat Scheduler. Each queue has dedicated consumers. The discovery worker posts results to the enrichment queue. The enrichment worker routes scored leads above 60 to the outreach queue. This ensures smooth pipeline flow with backpressure handling."));
  c.push(...code([
    'graph LR',
    '  subgraph Producers',
    '    API[FastAPI Endpoints]',
    '    Sched[Celery Beat Scheduler]',
    '  end',
    '  subgraph Redis_Broker',
    '    Q1[Queue: discovery_tasks]',
    '    Q2[Queue: enrichment_tasks]',
    '    Q3[Queue: outreach_tasks]',
    '    Q4[Queue: analytics_tasks]',
    '  end',
    '  subgraph Consumers',
    '    C1[Celery Worker: Discovery]',
    '    C2[Celery Worker: Enrichment]',
    '    C3[Celery Worker: Outreach]',
    '  end',
    '  API --> Q1',
    '  Sched --> Q4',
    '  Q1 --> C1',
    '  Q2 --> C2',
    '  Q3 --> C3',
    '  C1 -->|Post-processing| Q2',
    '  C2 -->|Score > 60| Q3',
  ]));

  c.push(h2("2.5 Deployment Architecture"));
  c.push(p("The system uses a split deployment strategy optimized for each component's characteristics. The Next.js dashboard deploys on Vercel with serverless auto-scaling. The FastAPI cluster deploys on Railway with horizontal worker scaling. Redis Cloud provides the message broker. Supabase provides managed PostgreSQL with pgvector, authentication, and storage. External integrations include Apify Cloud for scraping and OpenAI/Anthropic for LLM services."));
  c.push(tbl(["Component", "Platform", "Scaling Strategy", "Backup"], [
    ["Dashboard (Next.js)", "Vercel", "Serverless auto-scale", "Git-based"],
    ["API (FastAPI)", "Railway / VPS", "Horizontal (workers)", "Docker images"],
    ["Workers (Celery)", "Railway / VPS", "Horizontal (add workers)", "Task logs"],
    ["Database (PostgreSQL)", "Supabase", "Vertical + read replicas", "Automated PITR"],
    ["Cache / Queue (Redis)", "Redis Cloud", "Managed scaling", "AOF persistence"],
    ["Storage (Files)", "Supabase Storage", "CDN-backed", "Cross-region replication"],
  ], [20, 20, 25, 35]));

  // ═══ 3. AI AGENT SPECIFICATIONS ═══
  c.push(h1("3. AI Agent Specifications"));
  c.push(p("This section provides implementation-level specifications for all seventeen AI agents organized within three LangGraph workflows. Each specification includes purpose, state, inputs, outputs, tools, prompt strategy, failure handling, and JSON contracts."));

  // 3.1 Discovery Director
  c.push(...agentSection("3.1", "Discovery Director Agent",
    "The strategic brain of the acquisition operating system. It analyzes market coverage deficits and spawns targeted search batches. It does not scrape directly; it decides what to search for, which platform to target, which category needs more leads, which city needs more coverage, and when to stop a search. It operates as the strategic controller ensuring the acquisition engine always focuses on the most valuable market gaps.",
    "{target_market, current_coverage, active_batches, budget_remaining}",
    "Market coverage stats from the database, admin configurations (min followers, target cities), historical batch performance data.",
    "discovery_batches records and agent_tasks for the Search Strategy Agent. Each batch includes a rationale explaining why this gap was prioritized.",
    "query_database, create_batch, spawn_search_agent, get_trending_hashtags",
    "You are the Head of Growth. Analyze the current database distribution. Identify underrepresented categories in specific cities. Generate targeted search batch configurations. Do not overlap with existing active batches. Prioritize categories where the deficit is greatest relative to the estimated market size.",
    "If no new gaps exist, enter idle state. If Apify rate limits are hit, throttle batch creation. If the LLM returns malformed JSON, validate against Pydantic schema and request regeneration with exponential backoff (3 attempts).",
    ['{', '  "batch_id": "uuid",', '  "rationale": "Actors in Abha are below 10% of target.",', '  "platform": "instagram",', '  "category": "actor",', '  "city": "Abha",', '  "required_count": 200,', '  "status": "pending"', '}']
  ));

  // 3.2 Search Strategy
  c.push(...agentSection("3.2", "Search Strategy Agent",
    "Translates batch requirements into platform-specific search queries, hashtags, and seed URLs. It has deep knowledge of Saudi social media behavior, including Arabic hashtag conventions, platform-specific search patterns, and seasonal trends that affect creator activity. It generates both Arabic and English hashtags, long-tail keywords, and seed usernames for expansion chains.",
    "{batch_id, platform, category, city, generated_queries}",
    "Discovery Batch config from the Discovery Director.",
    "Arrays of hashtags, keywords, and seed profile URLs organized by platform and type.",
    "llm_generate, query_trends, hashtag_expander, seed_account_expander",
    "Generate 20 Arabic and English hashtags, 10 long-tail keywords, and 5 seed usernames for finding creators of the specified category in the specified city, Saudi Arabia. Include seasonal and trending hashtags when relevant.",
    "Fallback to a curated dictionary of Saudi hashtags if LLM fails. If hashtag expansion returns empty results, use the static hashtag list. If LLM generates culturally inappropriate queries, a validation layer filters them out before execution.",
    ['{', '  "batch_id": "uuid",', '  "queries": [', '    {"type": "hashtag", "value": "#mklmat_riyadh", "platform": "instagram"},', '    {"type": "keyword", "value": "Riyadh food blogger", "platform": "tiktok"},', '    {"type": "seed_user", "value": "example_user", "platform": "instagram"}', '  ]', '}']
  ));

  // 3.3 Collector Agents
  c.push(...agentSection("3.3", "Collector Agents (Apify / Crawlee / Playwright)",
    "Execute the physical extraction of data from web platforms. There are five specialized collector types: the Apify Collector for rapid MVP using pre-built actors, the Crawlee Collector for long-term scalable crawling with queue management, the Playwright Collector for JavaScript-heavy pages requiring browser rendering, the Scrapling Extractor for fast HTML parsing, and the Crawl4AI Collector for LLM-assisted extraction from complex pages.",
    "{batch_id, query, proxy_config, retry_count}",
    "Search queries from the Search Strategy Agent.",
    "Raw JSON/HTML of creator profiles with structured fields extracted.",
    "apify_client, crawlee_router, playwright_page, scrapling_parse, crawl4ai_extract",
    "N/A - Programmatic extraction logic, not LLM-driven.",
    "Rotating proxies, cookie rotation, exponential backoff. If blocked, mark query as failed and move to next. If a batch exceeds 15% failure rate, pause the batch and notify Discovery Director.",
    ['{', '  "batch_id": "uuid",', '  "platform": "instagram",', '  "username": "creator_name",', '  "bio": "Saudi food creator | Riyadh",', '  "followers": 125000,', '  "external_url": "https://linktr.ee/example",', '  "raw_html": "..."', '}']
  ));

  // 3.4 Profile Enrichment
  c.push(...agentSection("3.4", "Profile Enrichment Agent",
    "Follows external links (Linktree, personal websites, agency pages, media kit pages) to extract hidden emails, phones, cross-platform profiles, and agency information. This agent transforms a basic social profile into a rich, actionable lead record by extracting data that is not available directly from the social platform profile page.",
    "{profile_id, urls_to_crawl, data_extracted}",
    "Creator profile with external_links field populated.",
    "Email, phone, secondary platforms, agency info, media kit URLs.",
    "firecrawl_scrape, crawl4ai_llm_extract, email_regex_extractor",
    "Extract all email addresses, phone numbers starting with +966, and social media links from this markdown page. Focus on business contact information.",
    "Timeout handling for slow sites; skip if 404. If no external links exist, mark profile as enrichment_skipped. If Firecrawl returns garbage data, retry with Crawl4AI as fallback.",
    ['{', '  "profile_id": "uuid",', '  "emails": ["biz@creator.com"],', '  "phones": ["+9665xxxxxxxx"],', '  "tiktok": "@creator_tt",', '  "agency": "XYZ Management"', '}']
  ));

  // 3.5 Contact Discovery
  c.push(...agentSection("3.5", "Contact Discovery Agent",
    "Specifically targets contact info validation and formatting. While the Profile Enrichment Agent discovers contacts as part of broader enrichment, this agent focuses specifically on contact discovery with deeper analysis. It validates email formats, checks phone number formats against Saudi patterns, identifies WhatsApp contact buttons, and assigns confidence scores to each discovered contact.",
    "{profile_id, raw_contacts, validated_contacts}",
    "Raw text from bio and enrichment phase.",
    "Cleaned, validated contacts with confidence scores and source attribution.",
    "regex_extractor, llm_parse, validate_email_api, phone_format_validator",
    "Extract and categorize all contact methods from this unstructured text. Identify email addresses, phone numbers (especially +966), and social media DM channels.",
    "Discard invalid formats (e.g., emails without domains, phone numbers that do not match Saudi format). Mark unvalidated contacts with lower confidence scores.",
    ['{', '  "contact_type": "email",', '  "value": "creator@email.com",', '  "is_public": true,', '  "source": "linktree_page",', '  "confidence": 0.95', '}']
  ));

  // 3.6 Category Classification
  c.push(...agentSection("3.6", "Category Classification Agent",
    "Assigns primary and secondary categories using LLM-based analysis and rule-based signals. The classification inputs include bio text, recent post captions, hashtags used, username patterns, and external links. The agent assigns one primary category and up to three secondary categories from a predefined taxonomy of seventeen categories: Food, Fashion, Beauty, Lifestyle, Comedy, Fitness, Actor, Artist, Singer, Travel, Tech, Gaming, Family, Business, Education, Model, and Other.",
    "{profile_id, bio, hashtags, classification}",
    "Bio text, recent hashtags, username, external links.",
    "Primary category, secondary categories, and confidence scores for each classification.",
    "llm_classify, zero_shot_classifier, hashtag_category_map",
    "Classify this Saudi creator into one of the predefined categories based on their bio and hashtags. Output JSON with primary and secondary categories and confidence scores.",
    "Default to 'Other' if confidence is below 0.6. If the LLM returns a category not in the taxonomy, remap to the closest match or 'Other'. Run classification twice with different prompts and take the consensus.",
    ['{', '  "primary_category": "food",', '  "secondary_categories": ["lifestyle"],', '  "confidence": 0.95', '}']
  ));

  // 3.7 Saudi Relevance
  c.push(...agentSection("3.7", "Saudi Relevance Agent",
    "Ensures the creator is actually based in or creating content for Saudi Arabia. This is critical because many creators with Arabic content may be based in other GCC countries, Egypt, or the Levant, and would not be suitable for the Saudi-focused platform. The agent analyzes Saudi Arabic dialect markers (Najdi, Hijazi, Eastern Province), city mentions, Saudi-specific hashtags, Saudi phone numbers (+966), Saudi brand mentions, and location tags.",
    "{profile_id, location_signals, relevance_score}",
    "Bio text, city mentions, dialect markers, phone codes, Saudi hashtags.",
    "Boolean relevance, detected city, confidence score, and specific signals used.",
    "ner_extractor, dialect_classifier, city_pattern_matcher",
    "Does this bio indicate a creator based in Saudi Arabia? Look for Saudi cities, +966 numbers, or Saudi dialect markers. Identify the specific city if possible.",
    "Flag for human review if ambiguous (e.g., GCC-wide creator with no specific city). If no signals are found at all, mark as not_saudi_relevant with confidence 0.",
    ['{', '  "is_saudi_relevant": true,', '  "city": "Riyadh",', '  "signals_used": ["bio_text_riyadh", "hashtag_saudi"],', '  "confidence": 0.98', '}']
  ));

  // 3.8 Engagement Analysis
  c.push(...agentSection("3.8", "Engagement Analysis Agent",
    "Calculates true engagement metrics from recent post data. The agent processes the last 12-30 posts to compute average likes, average comments, average views (for video content), engagement rate, posting frequency, content consistency score, and viral potential. The engagement rate formula is: ER = ((avg_likes + avg_comments) / followers) * 100. The agent also detects engagement anomalies that might indicate purchased followers or engagement pods.",
    "{profile_id, raw_metrics, calculated_metrics}",
    "Followers, likes, comments, views from recent posts.",
    "Engagement rate, consistency score, anomaly flags, and posting frequency.",
    "math_operations, anomaly_detector, consistency_calculator",
    "N/A - Calculative agent executing mathematical formulas and statistical analysis.",
    "Return null metrics if follower count is 0 to avoid division by zero. If fewer than 5 posts are available, flag as insufficient_data and use lower confidence scoring.",
    ['{', '  "engagement_rate": 3.5,', '  "avg_likes": 4500,', '  "avg_comments": 120,', '  "consistency_score": 0.8,', '  "anomaly_flags": []', '}']
  ));

  // 3.9 Lead Scoring
  c.push(...agentSection("3.9", "Lead Scoring Agent",
    "Calculates the 0-100 acquisition priority score using the seven-dimension framework detailed in Section 5. The scoring engine applies exact mathematical formulas to produce an auditable, transparent score. Missing data receives a 0 for that subset, which acts as a natural penalty for incomplete profiles. The score determines the lead's priority tier: Hot (80-100), Qualified (60-79), Nurture (40-59), or Low Priority (0-39).",
    "{profile_id, metrics, score_breakdown}",
    "All enriched data: follower counts, engagement metrics, relevance signals, category, contacts, brand safety assessment.",
    "Total score (0-100), priority tier, and detailed breakdown by dimension.",
    "scoring_engine, penalty_calculator, tier_classifier",
    "N/A - Calculative agent executing SQL/Python scoring logic with exact formulas.",
    "Apply penalty to missing data fields. If a critical dimension (followers or engagement) is completely missing, cap the total score at 39 regardless of other dimensions. Log scoring exceptions for audit.",
    ['{', '  "total_score": 82,', '  "tier": "Hot Lead",', '  "breakdown": {', '    "followers": 20, "engagement": 22,', '    "saudi_relevance": 15, "commercial_value": 8,', '    "contact_availability": 10, "brand_safety": 7,', '    "signup_probability": 0', '  }', '}']
  ));

  // 3.10 Deduplication Identity
  c.push(...agentSection("3.10", "Deduplication Identity Agent",
    "Prevents the same human from being added multiple times using vector-native semantic matching. The agent generates an embedding of the creator's name plus bio and uses pgvector cosine similarity to find potential matches in the existing database. Traditional string matching fails for Arabic and English name variations, so the system uses OpenAI ada-002 embeddings stored in the identity_embedding column with an HNSW index for fast approximate nearest neighbor search. Matching signals include embedding similarity, same email, same phone, same Linktree URL, and cross-linked platforms.",
    "{profile_id, embedding, match_candidates}",
    "New profile data, existing database profiles via pgvector similarity search.",
    "new_identity (create new record) or merge_with_existing_id (merge into existing) with match confidence and reason.",
    "pgvector_cosine_search, fuzzy_string_match, llm_assisted_match",
    "Are these two profiles the same person? Compare the names, bios, linked platforms, and contact info. Output your confidence and reasoning.",
    "If similarity is between 0.75-0.85 (ambiguous zone), create a new record but flag for human merge review. If similarity is above 0.85, auto-merge. If below 0.75, create as new identity. Log all merge decisions for audit.",
    ['{', '  "action": "merge",', '  "existing_influencer_id": "uuid-1234",', '  "match_confidence": 0.91,', '  "match_reason": "Same Linktree URL and similar username"', '}']
  ));

  // 3.11 Market Coverage
  c.push(...agentSection("3.11", "Market Coverage Agent",
    "Monitors database health and reports gaps back to the Discovery Director, creating the closed-loop acquisition system. The agent continuously computes category and city coverage against target thresholds, identifies deficit areas, and feeds gap reports directly into the Discovery Director's input. This feedback loop is what makes Reesha an operating system rather than a simple scraper: the system autonomously identifies and fixes its own blind spots.",
    "{market, category_counts, city_counts}",
    "Database aggregates from the mv_market_coverage materialized view.",
    "Gap reports showing categories and cities below target, with deficit numbers.",
    "sql_aggregator, target_comparator, gap_reporter",
    "N/A - Calculative agent comparing database state against target coverage goals.",
    "If the materialized view is stale, trigger a refresh before computing gaps. If no targets are configured for a category, use the median target as default.",
    ['{', '  "gaps": [', '    {"category": "actors", "city": "Abha", "current": 10, "target": 100, "deficit": 90}', '  ]', '}']
  ));

  // 3.12 Lead Assignment
  c.push(...agentSection("3.12", "Lead Assignment Agent",
    "Routes leads to the appropriate AI Sales persona or human agent based on category specialization, language compatibility, score tier, and current workload balance. The assignment logic ensures that each AI Sales Agent works within its area of expertise, that no agent is overloaded, and that high-priority leads are assigned first.",
    "{lead_id, profile_data, assignment}",
    "Lead score, category, language, city, available agents and their current workload.",
    "Assignment record linking lead to agent with assignment reason.",
    "routing_logic, workload_balancer, agent_registry",
    "N/A - Logic router using configurable rules and workload metrics.",
    "Assign to the General pool if no specific agent matches. If all specialized agents are at capacity, overflow to the General pool with a flagged priority.",
    ['{', '  "lead_id": "uuid",', '  "assigned_agent_id": "ai_food_agent_1",', '  "assignment_reason": "Arabic speaking food creator"', '}']
  ));

  // 3.13 AI Sales Outreach
  c.push(...agentSection("3.13", "AI Sales Outreach Agent",
    "Generates highly personalized, culturally appropriate initial messages in Arabic or English. The agent uses template-plus-personalization approach: personalization variables are injected explicitly (creator_name, platform, category, city) rather than asking the LLM to guess facts. Strict constraints enforce compliance: never promise income, mention free registration, keep messages under 80 words, and use appropriate Gulf/Saudi Arabic dialect for Arabic messages. All generated messages require human approval before sending.",
    "{lead_id, draft_message, language}",
    "Creator name, category, platform, language, city.",
    "Draft message for human approval with compliance check results.",
    "llm_generate, template_engine, compliance_checker",
    "Strict constraints: Never promise income. Mention free registration. Keep under 80 words. Use appropriate Gulf/Saudi Arabic dialect if Arabic. Be warm but professional. Do not sound desperate.",
    "Fallback to approved static templates if LLM hallucinates. If the compliance checker flags any violation, regenerate with stricter constraints. After 3 failed generations, use the static template.",
    ['{', '  "lead_id": "uuid",', '  "language": "ar",', '  "message_text": "Ahlan Ahmad...",', '  "status": "pending_approval",', '  "compliance": {"no_income_promise": true, "free_reg_mentioned": true}', '}']
  ));

  // 3.14 Conversation
  c.push(...agentSection("3.14", "Conversation Agent",
    "Handles inbound replies from creators using conversation memory. Before generating a new reply, the agent receives the system prompt plus conversation summary plus last message, which prevents hallucinating past interactions. The agent has access to an FAQ knowledge base about Reesha. Intent detection classifies each reply as information_request, pricing_inquiry, registration_interest, complaint, or other. Complex business questions, legal inquiries, and complaints trigger immediate escalation.",
    "{conversation_id, history, intent}",
    "Creator's reply message and conversation history summary.",
    "Suggested response, detected intent, and escalation flag.",
    "llm_chat, intent_classifier, faq_lookup",
    "You are a helpful community manager for Reesha. Answer the question based on the FAQ provided. Do not make up policies. If unsure, flag for escalation rather than guessing.",
    "Trigger Human Escalation Agent if intent is legal, complaint, pricing_guarantee, or request_for_manager. If the FAQ does not cover the question, escalate rather than fabricate an answer.",
    ['{', '  "conversation_id": "uuid",', '  "suggested_reply": "Yes, registration is completely free...",', '  "intent_detected": "pricing_inquiry",', '  "requires_escalation": false', '}']
  ));

  // 3.15 Follow-up
  c.push(...agentSection("3.15", "Follow-up Agent",
    "Schedules and generates follow-up messages if no reply is received. The follow-up timeline is: first follow-up at 48 hours, second at 5 days, and final follow-up at 10 days. After the final follow-up with no response, the lead status is changed to no_response and no further automated messages are sent. Each follow-up is shorter and takes a different angle. The system respects opt-out requests immediately.",
    "{lead_id, sequence_step, next_date}",
    "Time since last message, lead status, conversation history.",
    "New follow-up task with scheduled date and draft message.",
    "scheduler, llm_generate, sequence_manager",
    "Write a gentle follow-up to the previous message. Do not sound desperate. Reference the value proposition differently than the previous message. Keep it brief.",
    "Stop sequence after 3 unanswered follow-ups; mark lead as no_response. If the creator opts out at any point, immediately cancel all scheduled follow-ups and update consent status.",
    ['{', '  "lead_id": "uuid",', '  "sequence_step": 2,', '  "scheduled_for": "2026-06-14T10:00:00Z",', '  "draft_message": "Ahlan Ahmad, wanted to follow up..."', '}']
  ));

  // 3.16 Human Escalation
  c.push(...agentSection("3.16", "Human Escalation Agent",
    "Routes complex conversations to internal staff when the AI agent's capabilities are exceeded. Escalation triggers include: legal inquiries, pricing guarantee requests, complaints, requests to speak to a manager, contract discussions, and high-value creators (score above 90) who need personal attention. The agent transfers full conversation context to the human agent, including the conversation summary, detected intent, and recommended response approach.",
    "{conversation_id, reason, urgency}",
    "Intent flags from the Conversation Agent, lead priority, conversation history.",
    "Internal notification, assignment to human agent, context transfer.",
    "slack_notifier, dashboard_updater, context_transfer",
    "N/A - Routing logic based on escalation trigger classification.",
    "Create high-priority ticket if Slack webhook fails. If no human agents are available, queue the escalation and notify the dashboard with a visible alert. Ensure no escalation is lost.",
    ['{', '  "conversation_id": "uuid",', '  "escalated_to": "human_agent_1",', '  "reason": "Creator asked for exclusivity contract terms",', '  "urgency": "high"', '}']
  ));

  // 3.17 Match Probability
  c.push(...agentSection("3.17", "Match Probability Agent",
    "Predicts the likelihood of a creator matching with a brand in the future, which is used to prioritize acquisition effort. This is distinct from the Lead Scoring Agent, which scores acquisition priority. The Match Probability Agent considers category demand on the platform, audience demographics alignment with brand needs, and historical campaign match data for similar creators. A high match probability means the creator is likely to receive campaign opportunities once registered, increasing their long-term platform value.",
    "{lead_id, brand_market_data, match_score}",
    "Creator categories, engagement quality, market demand data from the platform.",
    "Probability score (0-1) and reasoning for the prediction.",
    "ml_model_predict, query_analytics, demand_forecaster",
    "N/A - ML/Logic based prediction using trained model or heuristic rules.",
    "Default to average category conversion rate if model fails. If no historical data exists for the category, use the platform-wide average as a prior.",
    ['{', '  "lead_id": "uuid",', '  "match_probability": 0.75,', '  "reasoning": "High demand for food creators in Riyadh currently"', '}']
  ));

  // ═══ 4. DATABASE ARCHITECTURE ═══
  c.push(h1("4. Database Architecture (Supabase)"));
  c.push(h2("4.1 SQL Schema"));
  c.push(p("The database is hosted on Supabase PostgreSQL with the pgvector extension for semantic similarity search. The schema is designed for production workloads with proper indexing, constraints, and relationships. The identity_embedding column stores OpenAI ada-002 embeddings of name plus bio for vector-native deduplication. A materialized view provides fast market coverage aggregations."));

  c.push(...code([
    '-- Enable extensions',
    'create extension if not exists "uuid-ossp";',
    'create extension if not exists "pgcrypto";',
    'create extension if not exists "pgvector";',
    '',
    '-- 1. INFLUENCERS (Core Identity)',
    'create table influencers (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  full_name text,',
    '  display_name text,',
    '  creator_type text,',
    '  primary_category text,',
    '  secondary_categories text[],',
    '  country text default \'Saudi Arabia\',',
    '  city text,',
    '  primary_language text default \'ar\',',
    '  gender text,',
    '  profile_summary text,',
    '  identity_embedding vector(1536),',
    '  registration_status text default \'not_registered\'',
    '    check (registration_status in (',
    '      \'not_registered\',\'pending\',\'registered\',\'rejected\')),',
    '  status text default \'new\'',
    '    check (status in (\'new\',\'qualified\',\'contacted\',',
    '      \'interested\',\'escalated\',\'converted\',\'unsubscribed\')),',
    '  created_at timestamptz default now(),',
    '  updated_at timestamptz default now()',
    ');',
    '',
    '-- 2. SOCIAL PROFILES',
    'create table social_profiles (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  influencer_id uuid references influencers(id) on delete cascade,',
    '  platform text not null check (platform in (',
    '    \'instagram\',\'tiktok\',\'youtube\',\'twitter\',\'snapchat\')),',
    '  username text not null,',
    '  profile_url text,',
    '  bio text,',
    '  followers_count integer,',
    '  following_count integer,',
    '  posts_count integer,',
    '  avg_likes numeric,',
    '  avg_comments numeric,',
    '  avg_views numeric,',
    '  engagement_rate numeric,',
    '  verified boolean default false,',
    '  profile_image_url text,',
    '  external_links text[],',
    '  last_checked_at timestamptz,',
    '  raw_data jsonb,',
    '  created_at timestamptz default now(),',
    '  unique(platform, username)',
    ');',
    '',
    '-- 3. INFLUENCER CONTACTS',
    'create table influencer_contacts (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  influencer_id uuid references influencers(id) on delete cascade,',
    '  contact_type text not null check (contact_type in (',
    '    \'email\',\'phone\',\'whatsapp\',\'dm_instagram\',\'dm_tiktok\',\'other\')),',
    '  contact_value text not null,',
    '  source text,',
    '  is_public boolean default true,',
    '  is_verified boolean default false,',
    '  consent_status text default \'unknown\'',
    '    check (consent_status in (\'unknown\',\'opted_in\',\'opted_out\')),',
    '  created_at timestamptz default now()',
    ');',
    '',
    '-- 4. LEADS',
    'create table leads (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  influencer_id uuid references influencers(id) on delete cascade,',
    '  lead_score integer default 0 check (lead_score >= 0 and lead_score <= 100),',
    '  priority text default \'normal\'',
    '    check (priority in (\'low\',\'normal\',\'high\',\'hot\')),',
    '  lead_stage text default \'new\' check (lead_stage in (',
    '    \'new\',\'enrichment\',\'scoring\',\'qualified\',\'assigned\',',
    '    \'outreach\',\'conversing\',\'registered\',\'rejected\',\'no_response\')),',
    '  assigned_agent_id uuid,',
    '  assigned_to_human uuid,',
    '  source text,',
    '  notes text,',
    '  next_action text,',
    '  next_action_at timestamptz,',
    '  score_breakdown jsonb,',
    '  created_at timestamptz default now(),',
    '  updated_at timestamptz default now()',
    ');',
    '',
    '-- 5. CONVERSATIONS',
    'create table conversations (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  lead_id uuid references leads(id) on delete cascade,',
    '  channel text,',
    '  last_message text,',
    '  summary text,',
    '  intent_status text,',
    '  sentiment text,',
    '  next_action text,',
    '  created_at timestamptz default now(),',
    '  updated_at timestamptz default now()',
    ');',
    '',
    '-- 6. OUTREACH MESSAGES',
    'create table outreach_messages (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  conversation_id uuid references conversations(id) on delete cascade,',
    '  lead_id uuid references leads(id) on delete cascade,',
    '  channel text,',
    '  language text,',
    '  message_type text check (message_type in (',
    '    \'initial\',\'follow_up_1\',\'follow_up_2\',\'reply\',\'escalation\')),',
    '  message_text text,',
    '  status text default \'draft\' check (status in (',
    '    \'draft\',\'pending_approval\',\'approved\',\'sent\',\'failed\',\'responded\')),',
    '  approved_by uuid,',
    '  sent_by uuid,',
    '  sent_at timestamptz,',
    '  response_at timestamptz,',
    '  created_at timestamptz default now()',
    ');',
    '',
    '-- 7. DISCOVERY BATCHES',
    'create table discovery_batches (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  name text,',
    '  market text default \'Saudi Arabia\',',
    '  platform text,',
    '  category text,',
    '  city text,',
    '  min_followers integer default 20000,',
    '  target_count integer,',
    '  found_count integer default 0,',
    '  status text default \'pending\' check (status in (',
    '    \'pending\',\'running\',\'paused\',\'completed\',\'failed\')),',
    '  config jsonb,',
    '  created_at timestamptz default now(),',
    '  completed_at timestamptz',
    ');',
    '',
    '-- 8. AGENT TASKS',
    'create table agent_tasks (',
    '  id uuid primary key default uuid_generate_v4(),',
    '  task_type text not null,',
    '  status text default \'pending\' check (status in (',
    '    \'pending\',\'running\',\'completed\',\'failed\',\'retrying\')),',
    '  priority integer default 5,',
    '  input jsonb,',
    '  output jsonb,',
    '  error text,',
    '  assigned_agent text,',
    '  batch_id uuid references discovery_batches(id),',
    '  retry_count integer default 0,',
    '  max_retries integer default 3,',
    '  created_at timestamptz default now(),',
    '  started_at timestamptz,',
    '  completed_at timestamptz',
    ');',
    '',
    '-- 9. MARKET COVERAGE (Materialized View)',
    'create materialized view mv_market_coverage as',
    'select primary_category, city,',
    '  count(*) as creator_count,',
    '  avg(lead_score) as avg_score',
    'from influencers i',
    'join leads l on l.influencer_id = i.id',
    'where i.country = \'Saudi Arabia\'',
    'group by primary_category, city;',
  ]));

  c.push(h2("4.2 Indexes and Constraints"));
  c.push(p("The indexing strategy prioritizes the most common query patterns: dashboard filtering by score and stage, deduplication via vector similarity, and JSONB querying for flexible agent output analysis. The HNSW index on identity_embedding enables fast approximate nearest neighbor search for the Deduplication Identity Agent."));
  c.push(...code([
    '-- Vector index for deduplication (HNSW for pgvector cosine similarity)',
    'create index idx_influencers_embedding',
    '  on influencers using hnsw (identity_embedding vector_cosine_ops);',
    '',
    '-- Dashboard filtering indexes',
    'create index idx_leads_score on leads (lead_score desc);',
    'create index idx_leads_stage on leads (lead_stage);',
    'create index idx_influencers_category on influencers (primary_category);',
    'create index idx_influencers_city on influencers (city);',
    'create index idx_influencers_status on influencers (status);',
    '',
    '-- JSONB indexing for agent output querying',
    'create index idx_agent_tasks_output on agent_tasks using gin (output);',
    'create index idx_social_profiles_raw on social_profiles using gin (raw_data);',
    '',
    '-- Prevent duplicate outreach',
    'create unique index idx_unique_outreach_type',
    '  on outreach_messages (lead_id, message_type);',
  ]));

  c.push(h2("4.3 Row-Level Security (RLS)"));
  c.push(p("As an internal tool, RLS is less about multi-tenant user isolation and more about role-based access control (Admin vs Sales Rep). The following policies enforce that sales reps can only see leads assigned to them, and only admins can approve outreach messages."));
  c.push(...code([
    'alter table leads enable row level security;',
    'alter table outreach_messages enable row level security;',
    '',
    '-- Sales Reps can only see leads assigned to them',
    'create policy "Sales reps can view assigned leads"',
    '  on leads for select',
    '  using (assigned_to_human = auth.uid());',
    '',
    '-- Only Admins can approve outreach',
    'create policy "Only admins can approve outreach"',
    '  on outreach_messages for update',
    '  using (auth.jwt() ->> \'role\' = \'admin\');',
  ]));

  // ═══ 5. SCORING ENGINE ═══
  c.push(h1("5. Scoring Engine (100-Point Framework)"));
  c.push(p("The Lead Scoring Agent uses the following exact mathematical formulas to ensure fairness and auditability. Missing data receives a 0 for that subset, which acts as a natural penalty for incomplete profiles."));
  c.push(tbl(["Dimension", "Max Points", "Weight", "Description"], [
    ["Followers Score", "25", "25%", "Logarithmic scale based on follower count"],
    ["Engagement Score", "25", "25%", "Tiered scoring based on engagement rate"],
    ["Saudi Relevance", "15", "15%", "Binary signals for Saudi market connection"],
    ["Commercial Value", "10", "10%", "Category demand weighting"],
    ["Contact Availability", "10", "10%", "Availability of contact channels"],
    ["Brand Safety", "10", "10%", "LLM analysis of content safety"],
    ["Signup Probability", "5", "5%", "Predicted conversion likelihood"],
    ["TOTAL", "100", "100%", "Composite acquisition priority score"],
  ], [22, 12, 12, 54]));

  c.push(h2("5.1 Followers Score (Max 25)"));
  c.push(p("Logarithmic scale to prevent mega-influencers from skewing the system entirely. Formula: Score = min(25, (log10(followers) - 4) * 8.33). This means 20,000 followers maps to approximately score 10, 100,000 followers maps to approximately score 16.6, and 1,000,000 followers maps to the maximum score of 25. The logarithmic scale ensures that the difference between 20K and 100K followers is significant, while the difference between 1M and 5M followers is less dramatic."));

  c.push(h2("5.2 Engagement Score (Max 25)"));
  c.push(p("Tiered scoring based on Engagement Rate (ER). The formula is: ER = ((avg_likes + avg_comments) / followers) * 100. The scoring tiers are: ER below 1% maps to score 5, ER between 1% and 2% maps to score 10, ER between 2% and 4% maps to score 18, and ER above 4% maps to score 25. The tiered approach rewards genuinely engaged audiences while penalizing accounts with purchased followers that typically have very low engagement rates relative to their follower counts."));

  c.push(h2("5.3 Saudi Relevance (Max 15)"));
  c.push(p("Binary signal scoring: Detected City Match (Riyadh, Jeddah, etc.) adds 5 points, Saudi Phone (+966) adds 5 points, Saudi Dialect or Hashtags in Bio adds 5 points. If no signals are found, 0 points. The maximum of 15 requires all three signals to be present, indicating a creator deeply embedded in the Saudi market."));

  c.push(h2("5.4 Commercial Value (Max 10)"));
  c.push(p("Based on category demand in the Reesha network. High demand categories (Food, Fashion, Beauty) receive 10 points. Medium demand categories (Lifestyle, Tech, Comedy) receive 6 points. Niche categories (Art, Education) receive 3 points. This weighting reflects the actual brand demand the platform experiences and ensures acquisition effort is focused on commercially valuable creators."));

  c.push(h2("5.5 Contact Availability (Max 10)"));
  c.push(p("Public Email adds 5 points, Public Phone or WhatsApp adds 5 points, DM-only access adds 2 points. The maximum of 10 requires both a public email and a public phone/WhatsApp, which enables multi-channel outreach and significantly increases the probability of successful contact."));

  c.push(h2("5.6 Brand Safety (Max 10)"));
  c.push(p("LLM analysis of bio and recent posts for controversial, adult, or political content. Clean profile receives 10 points, Mild Risk receives 4 points, and High Risk receives 0 points with an auto-reject flag on the lead. Brand safety is a hard gate: a high-risk content profile is excluded from outreach regardless of other scores."));

  c.push(h2("5.7 Signup Probability (Max 5)"));
  c.push(p("Based on the Match Probability Agent output and historical conversion of similar profiles. High probability receives 5 points, Medium receives 3 points, Low receives 1 point. This dimension captures the likelihood that a creator will actually register after being contacted, which is the ultimate business objective."));

  c.push(h2("5.8 Priority Classification"));
  c.push(tbl(["Score Range", "Priority Tier", "Action", "SLA"], [
    ["80-100", "Hot Lead", "Immediate AI Outreach", "Contact within 24 hours"],
    ["60-79", "Qualified Lead", "Queue for Outreach", "Contact within 48 hours"],
    ["40-59", "Nurture Lead", "Add to database, passive monitoring", "Re-evaluate quarterly"],
    ["Below 40", "Low Priority", "Archive", "No active outreach"],
  ], [15, 18, 35, 32]));

  // ═══ 6. OUTREACH ENGINE ═══
  c.push(h1("6. Outreach Engine Logic"));
  c.push(h2("6.1 Message Generation and State Machine"));
  c.push(p("The Outreach engine uses a strict state machine. A message cannot be generated if the previous step is incomplete. The state transitions are: New -> Drafting -> Pending Approval -> Approved -> Sent -> Responded or No Response. This state machine ensures that no message is sent without human approval (in the MVP phase), that duplicate messages are prevented, and that the full message lifecycle is tracked for analytics."));

  c.push(h2("6.2 Personalization and Prompting"));
  c.push(p("Personalization is injected via explicit variables, NOT by asking the LLM to guess facts. The variables include: creator_name, platform, category_ar, city_ar. This approach prevents hallucination of creator details, which could damage the Reesha brand if incorrect information is sent. The constraint checklist for every message is: no income promises, no campaign guarantees, explicitly mention free registration, maximum 80 words, and polite Gulf Arabic dialect for Arabic messages."));

  c.push(h2("6.3 Conversation Memory"));
  c.push(p("Uses the conversations.summary field for context management. Before generating a new reply, the Conversation Agent receives the system prompt plus conversation summary plus last message. This three-part context prevents hallucinating past interactions and ensures the agent has sufficient context to generate relevant replies. The summary is updated after each exchange to maintain a concise but complete record of the conversation."));

  c.push(h2("6.4 Escalation Logic"));
  c.push(p("Triggered immediately if intent detection classifies the user's message as: legal inquiry, pricing guarantee request, complaint, or request to speak to a manager. The Human Escalation Agent transfers the full conversation context, including the summary, detected intent, and recommended response approach, to the assigned human agent. Critical escalations are routed within 15 minutes; high-priority within 1 hour; normal within 4 hours."));

  c.push(h2("6.5 Communication Rules"));
  c.push(tbl(["Rule", "Description", "Enforcement"], [
    ["No guaranteed campaigns", "Never promise that a creator will receive campaign offers", "Compliance check on all messages"],
    ["No guaranteed income", "Never suggest specific earnings or income levels", "Compliance check on all messages"],
    ["Free registration", "Always mention that registration is free", "Required field in templates"],
    ["Professional tone", "Maintain formal, respectful communication", "LLM system prompt enforcement"],
    ["Language matching", "Use Arabic for Arabic-content creators", "Auto-detection from profile"],
    ["No spam", "Maximum 3 follow-ups, respect opt-out requests", "Hard limit in Follow-up Agent"],
    ["Official accounts only", "Use only official Reesha accounts for outreach", "Channel configuration"],
    ["Variable-based personalization", "Never ask LLM to guess creator facts", "Template variable injection"],
  ], [22, 45, 33]));

  // ═══ 7. DASHBOARD DESIGN ═══
  c.push(h1("7. Dashboard Design (Next.js + shadcn/ui)"));
  c.push(h2("7.1 Overview Page"));
  c.push(p("The command center providing the pulse of the acquisition operating system. Components include StatCards (Total Creators, Hot Leads, Conversion Rate), Category BarChart, City Heatmap, and Recent Activity Feed. Data comes from aggregations on the leads and influencers tables. The primary action is quick-starting a Discovery Batch. API endpoint: GET /api/stats/overview."));

  c.push(h2("7.2 Leads Page"));
  c.push(p("Data-heavy CRM view with a DataTable featuring server-side pagination, sorting, and multi-filter (Category, City, Score, Stage). Custom components include LeadScoreBadge and StageTag. Data comes from joined influencers, social_profiles, and leads tables. Actions include bulk assign, export CSV, and navigate to Lead Profile. API endpoint: GET /api/leads with query parameters for filtering."));

  c.push(h2("7.3 Lead Profile Page"));
  c.push(p("360-degree view of the creator organized into sections: Identity Card (Photo, Name, Socials), Score Breakdown Radar Chart, Timeline (Outreach messages, Conversations, Status changes), and Action Panel (Generate Message, Assign, Escalate). Data comes from a full join of influencers, leads, social_profiles, and conversations. API endpoint: GET /api/leads/:id."));

  c.push(h2("7.4 Discovery Control Page"));
  c.push(p("Interface for the Discovery Director. Components include Active Batches Table, Market Coverage Matrix (Category vs City with color-coded counts), and a New Batch Form Wizard. Data comes from discovery_batches and the mv_market_coverage materialized view. Actions include start/pause batch and adjust target count. API endpoints: POST /api/batches, PATCH /api/batches/:id."));

  c.push(h2("7.5 AI Agent Control Page"));
  c.push(p("Observability for LangGraph workflows. Components include Task Queue Table, Agent Logs (collapsible JSON), Error Feed, and Worker Health Metrics. Data comes from the agent_tasks table. Actions include retry failed task and cancel running task. API endpoints: GET /api/tasks, POST /api/tasks/:id/retry."));

  c.push(h2("7.6 Outreach Approval Page"));
  c.push(p("Human-in-the-loop gate. Components include Pending Approval Queue, side-by-side view of Creator Profile vs Draft Message, Edit Message Textarea, and Approve/Reject buttons. Data comes from outreach_messages where status is pending_approval. Actions include edit message, approve, reject. API endpoint: PATCH /api/messages/:id/approve."));

  c.push(h2("7.7 Analytics Page"));
  c.push(p("Measures funnel and conversion. Components include Funnel Chart (Discovered -> Contacted -> Replied -> Registered), Time-series of registration conversions, and Agent Effectiveness chart. Data comes from custom analytics queries. API endpoint: GET /api/analytics/funnel."));

  c.push(h2("7.8 Settings Page"));
  c.push(p("System configuration including Minimum Follower Threshold Slider, AI Agent Prompt Configurations (textarea), API Key Management, and User Roles Management. Data comes from a system config table and environment variables. API endpoints: GET /api/settings, PATCH /api/settings."));

  // ═══ 8. IMPLEMENTATION ROADMAP ═══
  c.push(h1("8. Implementation Roadmap"));

  c.push(h2("8.1 Phase 1: Foundation (Weeks 1-3)"));
  c.push(p("Deliverables: Supabase schema with all tables and extensions, Next.js Dashboard with authentication, Manual Lead Creation forms, CSV Import functionality, and basic scoring implementation. Technical tasks include setting up Vercel and Railway, implementing RLS policies, and building the DataTable component for leads. Key risk: schema design flaws causing migration pain later, mitigated by strict review of relationships and constraints. Success metric: ability to manually import and view 1,000 leads in the dashboard."));

  c.push(h2("8.2 Phase 2: Discovery MVP (Weeks 4-7)"));
  c.push(p("Deliverables: Discovery Director Agent, Search Strategy Agent, and Apify Integration. Technical tasks include implementing Celery workers, Redis queues, and the LangGraph Discovery Workflow. Key risk: Apify getting blocked by Instagram rate limiting, mitigated by throttling jobs and testing specific Apify actors thoroughly. Success metric: collect 10,000 raw profiles into Supabase automatically."));

  c.push(h2("8.3 Phase 3: Enrichment and Scoring (Weeks 8-11)"));
  c.push(p("Deliverables: Profile Enrichment using Firecrawl and Crawl4AI, pgvector Deduplication, and Lead Scoring Agent. Technical tasks include implementing identity embeddings, building scoring formulas, and creating the Enrichment LangGraph workflow. Key risk: deduplication false positives (merging two different people with the same Arabic name), mitigated by threshold tuning on cosine similarity with human review for the 0.75-0.85 ambiguity zone. Success metric: 90% deduplication accuracy with a clean scored database."));

  c.push(h2("8.4 Phase 4: AI Sales and Outreach (Weeks 12-15)"));
  c.push(p("Deliverables: Outreach Approval Dashboard, AI Sales Agent, Conversation Agent, and Follow-up Agent. Technical tasks include building the human-in-the-loop UI and implementing the conversation state machine. Key risk: LLM hallucinations in Arabic messages offending creators, mitigated by strict prompt constraints and the human approval gate. Success metric: first 1,000 messages sent with a measurable reply rate."));

  c.push(h2("8.5 Phase 5: Scale and Autonomy (Weeks 16-20)"));
  c.push(p("Deliverables: Crawlee custom collectors, Market Coverage Agent feedback loop, and Analytics Dashboard. Technical tasks include building the Crawlee cluster on VPS, implementing the Director Agent autonomous mode, and connecting the Market Coverage Agent to the Discovery Director for closed-loop acquisition. Key risk: infrastructure cost scaling, mitigated by optimizing Apify usage and moving heavy lifting to Crawlee. Success metric: 50,000 creators in the database with automated gap-filling active."));

  c.push(h2("8.6 Phase 6: WhatsApp and Advanced Automation (Weeks 21+)"));
  c.push(p("Deliverables: WhatsApp Business API integration, automated onboarding flows, and full conversion tracking. Technical tasks include integrating WhatsApp webhooks and building final conversion tracking from outreach to active Reesha platform user. Key risk: WhatsApp ban risks, mitigated by strict opt-in verification and compliant messaging templates. Success metric: high conversion rate from outreach to active Reesha platform user, completing the closed-loop acquisition operating system."));

  c.push(h2("8.7 Roadmap Summary"));
  c.push(tbl(["Phase", "Timeline", "Key Deliverable", "Success Metric"], [
    ["1. Foundation", "Weeks 1-3", "Dashboard + Schema + CSV Import", "1,000 leads managed"],
    ["2. Discovery MVP", "Weeks 4-7", "Discovery Director + Apify", "10,000 profiles collected"],
    ["3. Enrichment", "Weeks 8-11", "pgvector Dedup + Scoring", "90% dedup accuracy"],
    ["4. Outreach", "Weeks 12-15", "AI Sales + Human Approval", "1,000 messages sent"],
    ["5. Scale", "Weeks 16-20", "Crawlee + Closed Loop", "50,000 creators in DB"],
    ["6. Advanced", "Weeks 21+", "WhatsApp + Full Automation", "High conversion rate"],
  ], [14, 16, 35, 35]));

  // ═══ 9. TECHNOLOGY STACK ═══
  c.push(h1("9. Technology Stack"));
  c.push(tbl(["Layer", "Technology", "Purpose", "Version"], [
    ["Frontend", "Next.js + TypeScript + Tailwind + shadcn/ui", "Internal dashboard", "Next.js 14+"],
    ["Database", "Supabase PostgreSQL + pgvector", "Storage + similarity search", "PostgreSQL 15+"],
    ["Auth", "Supabase Auth", "Dashboard authentication", "Managed"],
    ["Backend", "FastAPI + Python", "API server + agent orchestration", "Python 3.11+"],
    ["Agents", "LangGraph", "Stateful agent workflows", "0.2+"],
    ["Jobs", "Redis + Celery", "Task queue and distribution", "Redis 7+, Celery 5+"],
    ["Scraping MVP", "Apify", "Quick collection with pre-built actors", "API v2"],
    ["Scraping Scale", "Crawlee + Playwright", "Custom scalable crawling", "Crawlee 3+"],
    ["Extraction", "Scrapling + Firecrawl", "HTML parsing + external link crawling", "Latest"],
    ["AI Extraction", "Crawl4AI", "LLM-assisted page conversion", "Latest"],
    ["Deployment FE", "Vercel", "Dashboard hosting", "Managed"],
    ["Deployment BE", "Railway / VPS", "API + workers hosting", "Docker"],
  ], [14, 38, 28, 20]));

  // ═══ 10. COMPLIANCE ═══
  c.push(h1("10. Compliance and Safety"));
  c.push(p("The system must operate within ethical and legal boundaries to protect both the Reesha brand and the rights of the creators it contacts. The compliance framework covers five key areas: data collection (only collect publicly available data, respect robots.txt, avoid collecting non-public sensitive information), outreach (no spam behavior, human approval in MVP, maximum 3 follow-ups, respect opt-out requests immediately), messaging (never guarantee campaigns or income, always mention free registration, professional and transparent communication), data storage (only store relevant business acquisition data, respect data retention policies, implement proper access controls via RLS), and platform terms (comply with social platform terms of service, use official APIs where available, maintain sustainable scraping practices)."));
  c.push(tbl(["Compliance Area", "Rule", "Enforcement"], [
    ["Data Collection", "Only collect publicly available data", "Scraping configuration validation"],
    ["Data Collection", "Do not collect non-public sensitive information", "Extraction filter rules"],
    ["Outreach", "Maximum 3 follow-ups per lead", "Hard limit in Follow-up Agent"],
    ["Outreach", "Respect opt-out requests immediately", "Auto-detection + blocklist"],
    ["Messaging", "Never guarantee campaigns or income", "Compliance check on all messages"],
    ["Messaging", "Always mention free registration", "Required field in templates"],
    ["Messaging", "Use variable-based personalization only", "Template variable injection"],
    ["Storage", "Implement data retention policies", "Scheduled cleanup jobs"],
    ["Platform", "Respect robots.txt and rate limits", "Built-in rate limiter"],
    ["Platform", "Use official Reesha accounts only", "Channel configuration"],
  ], [18, 42, 40]));

  // ═══ 11. FINAL NOTE ═══
  c.push(h1("11. Architectural Conclusion"));
  c.push(p("By treating Reesha as an Operating System driven by autonomous feedback loops (Market Coverage -> Discovery Director -> Collection -> Scoring -> Outreach -> Coverage Update), we build a compounding asset. The database gets smarter, cleaner, and more comprehensive every day without linear human effort. The three LangGraph workflows (Discovery, Enrichment, Outreach) provide stateful, checkpointed, and recoverable processing pipelines. The vector-native deduplication using pgvector ensures identity integrity across platforms and languages. The closed-loop acquisition design ensures the system continuously identifies and fills its own gaps. This is the venture-backed approach: build the machine that builds the moat."));

  return c;
}

async function main() {
  const pgSize = { width: 11906, height: 16838 };
  const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" }, size: 24, color: "000000" }, paragraph: { spacing: { line: 312 } } },
        heading1: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 32, bold: true, color: P.primary }, paragraph: { spacing: { before: 480, after: 200, line: 312 } } },
        heading2: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 28, bold: true, color: P.primary }, paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
        heading3: { run: { font: { ascii: "Times New Roman", eastAsia: "SimHei" }, size: 24, bold: true, color: P.primary }, paragraph: { spacing: { before: 240, after: 120, line: 312 } } },
      },
    },
    sections: [
      // Cover
      { properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } }, children: buildCover() },
      // TOC
      {
        properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] }) },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Times New Roman", eastAsia: "SimHei" } })] }),
          new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
          new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select "Update Field."', italics: true, size: 18, color: "888888" })] }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // Body
      {
        properties: { type: SectionType.NEXT_PAGE, page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Reesha - Creator Acquisition Operating System", size: 18, color: "808080", font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" } })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] }) },
        children: buildBody(),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("/home/z/my-project/download/Reesha_Technical_Specification.docx", buffer);
  console.log("Document generated successfully!");
}

main().catch(console.error);

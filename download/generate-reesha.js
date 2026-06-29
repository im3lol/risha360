const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, SectionType, LevelFormat,
} = require("docx");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════════
// PALETTE — DM-1 Deep Cyan (AI / Tech)
// ═══════════════════════════════════════════════════════════════
const P = {
  primary: "162235",
  body: "1A2B40",
  secondary: "6878A0",
  accent: "37DCF2",
  surface: "F8F9FF",
  cover: {
    bg: "162235",
    titleColor: "FFFFFF",
    subtitleColor: "B0B8C0",
    metaColor: "90989F",
    footerColor: "687078",
  },
  table: {
    headerBg: "1B6B7A",
    headerText: "FFFFFF",
    accentLine: "1B6B7A",
    innerLine: "C8DDE2",
    surface: "EDF3F5",
  },
};

const c = (hex) => hex.replace("#", "");

// ═══════════════════════════════════════════════════════════════
// BORDER DEFINITIONS
// ═══════════════════════════════════════════════════════════════
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNoBorders = {
  top: NB, bottom: NB, left: NB, right: NB,
  insideHorizontal: NB, insideVertical: NB,
};
const horizontalBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
  insideVertical: { style: BorderStyle.NONE },
};
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 32,
        color: c(P.primary),
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      }),
    ],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160, line: 312 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        color: c(P.primary),
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      }),
    ],
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 312 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: c(P.primary),
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      }),
    ],
  });
}

function bodyPara(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    indent: { firstLine: 480 },
    children: [
      new TextRun({
        text,
        size: 24,
        color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
      }),
    ],
  });
}

function bodyParaNoIndent(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [
      new TextRun({
        text,
        size: 24,
        color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
      }),
    ],
  });
}

function boldBodyPara(text) {
  return new Paragraph({
    spacing: { line: 312, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: "000000",
        font: { ascii: "Times New Roman", eastAsia: "SimHei" },
      }),
    ],
  });
}

function codeBlock(lines) {
  return lines.map((line, idx) =>
    new Paragraph({
      spacing: { line: 276, after: 0 },
      indent: { left: 480 },
      children: [
        new TextRun({
          text: line,
          size: 20,
          font: { ascii: "Courier New", eastAsia: "Courier New" },
          color: "1A2B40",
        }),
      ],
    })
  );
}

function makeTable(headers, rows, colWidths) {
  const totalCols = headers.length;
  const defaultWidth = Math.floor(100 / totalCols);
  const widths = colWidths || headers.map(() => defaultWidth);

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        borders: {
          bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.accentLine },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: 21,
                color: P.table.headerText,
                font: { ascii: "Times New Roman", eastAsia: "SimHei" },
              }),
            ],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map(
    (row, rIdx) =>
      new TableRow({
        cantSplit: true,
        children: row.map((cell, cIdx) =>
          new TableCell({
            width: { size: widths[cIdx], type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.CLEAR,
              fill: rIdx % 2 === 0 ? P.table.surface : "FFFFFF",
            },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell,
                    size: 21,
                    color: "000000",
                    font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
                  }),
                ],
              }),
            ],
          })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: horizontalBorders,
    rows: [headerRow, ...dataRows],
  });
}

function spacer(twips) {
  return new Paragraph({ spacing: { before: twips } });
}

// ═══════════════════════════════════════════════════════════════
// COVER PAGE — R4 Top Color Block
// ═══════════════════════════════════════════════════════════════
function buildCover() {
  const title = "Reesha";
  const subtitle = "AI-Powered Creator Acquisition Operating System";
  const metaLines = [
    "Production-Grade Technical Specification",
    "Version 1.0",
    "June 2026",
    "Confidential",
  ];

  const titlePt = 44;
  const subtitlePt = 22;

  const children = [
    // Top color block with title
    new Paragraph({ spacing: { before: 3600 } }),
    new Paragraph({
      spacing: { line: Math.ceil(titlePt * 23), lineRule: "atLeast", after: 200 },
      alignment: AlignmentType.LEFT,
      indent: { left: 800 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: titlePt * 2,
          color: P.cover.titleColor,
          font: { ascii: "Times New Roman", eastAsia: "SimHei" },
        }),
      ],
    }),
    new Paragraph({
      spacing: {
        line: Math.ceil(subtitlePt * 23),
        lineRule: "atLeast",
        after: 400,
      },
      alignment: AlignmentType.LEFT,
      indent: { left: 800 },
      children: [
        new TextRun({
          text: subtitle,
          size: subtitlePt * 2,
          color: P.cover.subtitleColor,
          font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
        }),
      ],
    }),
    // Accent line
    new Paragraph({
      indent: { left: 800, right: 4000 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: P.accent, space: 12 },
      },
      spacing: { after: 600 },
      children: [],
    }),
    // Meta lines
    ...metaLines.map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { left: 800 },
          spacing: { line: 312, after: 80 },
          children: [
            new TextRun({
              text: line,
              size: 22,
              color: P.cover.metaColor,
              font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
            }),
          ],
        })
    ),
  ];

  return children;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT CONTENT BUILDER
// ═══════════════════════════════════════════════════════════════
function buildBodyContent() {
  const content = [];

  // ──── EXECUTIVE SUMMARY ────
  content.push(heading1("1. Executive Summary"));
  content.push(
    bodyPara(
      "Reesha is a Saudi-first platform designed to connect influencers, artists, actors, and creators with brands, restaurants, companies, and advertising agencies for marketing campaigns. While the public platform already exists, this technical specification defines the internal AI-powered Creator Acquisition Operating System - the engine responsible for continuously discovering, qualifying, storing, contacting, and converting creators into registered Reesha members."
    )
  );
  content.push(
    bodyPara(
      "The system is architected as an autonomous acquisition engine rather than a simple scraping tool. It employs seventeen specialized AI agents orchestrated through LangGraph, a FastAPI-based backend, a Supabase PostgreSQL database with pgvector for similarity search, and a Next.js internal dashboard for human oversight. The core business objective is to build the largest clean, scored, and reachable database of Saudi influencers and artists, then systematically convert them into active Reesha platform members."
    )
  );
  content.push(
    bodyPara(
      "This document provides implementation-level detail across every dimension: agent architecture with full JSON contracts, a production-grade Supabase schema with indexes and RLS policies, a complete dashboard specification, a 100-point scoring engine with exact formulas, a bilingual outreach engine, system architecture diagrams in Mermaid, and a phased implementation roadmap with concrete deliverables and success metrics. The specification is designed to be handed directly to engineering teams for execution."
    )
  );

  // ──── 2. PROJECT OVERVIEW ────
  content.push(heading1("2. Project Overview"));
  content.push(heading2("2.1 Business Context"));
  content.push(
    bodyPara(
      "The Saudi creator economy is experiencing explosive growth, driven by Vision 2030 initiatives, high smartphone penetration rates exceeding 95%, and one of the highest social media usage rates globally. Despite this growth, there is no comprehensive, structured database of Saudi creators that brands and agencies can access. Reesha fills this gap by building both the marketplace platform and the acquisition infrastructure needed to populate it."
    )
  );
  content.push(
    bodyPara(
      "The current platform allows creators to register manually, but this passive approach is insufficient for building a dominant market position. The creator acquisition system must proactively discover, qualify, and onboard creators at scale, treating each creator as a lead in a structured sales pipeline. This transforms Reesha from a passive directory into an active acquisition machine."
    )
  );

  content.push(heading2("2.2 Core Business Objective"));
  content.push(
    bodyPara(
      "The primary business objective is not scraping - it is creator acquisition. The system must build the largest structured database of Saudi creators and then convert them into registered Reesha platform members. The acquisition funnel consists of nine stages: Discover, Analyze, Score, Store, Assign, Contact, Follow Up, Track Registration, and Measure Conversion. Each stage is supported by dedicated AI agents and automated workflows, with human oversight at critical decision points."
    )
  );

  content.push(heading2("2.3 Target Market"));
  content.push(
    bodyPara(
      "The system targets creators operating within Saudi Arabia across eight primary cities: Riyadh (the capital and largest market), Jeddah (the commercial hub), Dammam and Khobar (the Eastern Province economic corridor), Makkah and Madinah (culturally significant cities with tourism-driven creator activity), Abha (the Asir region cultural center), and Taif (the seasonal resort city). Each city has distinct creator demographics and market characteristics that influence discovery and outreach strategies."
    )
  );
  content.push(
    makeTable(
      ["City", "Market Profile", "Creator Density", "Primary Categories"],
      [
        ["Riyadh", "Capital, largest market", "Very High", "All categories"],
        ["Jeddah", "Commercial hub, coastal", "High", "Fashion, Food, Lifestyle"],
        ["Dammam", "Industrial, oil sector", "Medium", "Business, Lifestyle"],
        ["Khobar", "Upscale residential", "Medium", "Food, Fashion, Lifestyle"],
        ["Makkah", "Religious tourism", "Medium", "Travel, Culture, Family"],
        ["Madinah", "Religious tourism", "Medium-Low", "Travel, Culture"],
        ["Abha", "Cultural, tourism", "Low", "Art, Travel, Culture"],
        ["Taif", "Seasonal resort", "Low", "Travel, Food, Lifestyle"],
      ],
      [15, 25, 20, 40]
    )
  );

  content.push(heading2("2.4 Target Creator Types"));
  content.push(
    bodyPara(
      "The system must collect all creator types relevant to the Saudi market, spanning the full spectrum from high-follower influencers to niche content creators. The target types include influencers, TikTok creators, Instagram creators, actors, artists, singers, models, food reviewers, lifestyle creators, beauty creators, fashion creators, fitness creators, tech creators, comedians, and public figures. Each type requires different discovery strategies, scoring weights, and outreach messaging."
    )
  );
  content.push(
    makeTable(
      ["Creator Type", "Primary Platform", "Discovery Strategy", "Scoring Priority"],
      [
        ["Influencers", "Instagram", "Hashtag + follower filtering", "Followers + Engagement"],
        ["TikTok Creators", "TikTok", "Hashtag + sound + duet chains", "Views + Viral Potential"],
        ["Instagram Creators", "Instagram", "Hashtag + location + explore", "Engagement Rate"],
        ["Actors", "Instagram + Google", "Agency lists + media mentions", "Brand Safety + Reach"],
        ["Artists", "Instagram", "Hashtag + gallery links", "Cultural Relevance"],
        ["Singers", "TikTok + YouTube", "Music hashtags + covers", "Audience Size"],
        ["Models", "Instagram", "Agency + hashtag + brand tags", "Brand Fit Score"],
        ["Food Reviewers", "Instagram + TikTok", "Restaurant tags + location", "Local Relevance"],
        ["Lifestyle Creators", "Instagram", "Hashtag + follower expansion", "Engagement"],
        ["Beauty Creators", "Instagram + TikTok", "Brand tags + tutorials", "Commercial Value"],
        ["Fashion Creators", "Instagram", "Brand tags + OOTD hashtags", "Commercial Value"],
        ["Fitness Creators", "Instagram", "Gym tags + transformation", "Engagement"],
        ["Tech Creators", "YouTube + Twitter", "Product review + unboxing", "Niche Authority"],
        ["Comedians", "TikTok + YouTube", "Comedy hashtags + duets", "Viral Potential"],
        ["Public Figures", "Google + Instagram", "Media mentions + Wikipedia", "Brand Safety"],
      ],
      [20, 20, 30, 30]
    )
  );

  // ──── 3. SYSTEM ARCHITECTURE ────
  content.push(heading1("3. System Architecture"));
  content.push(heading2("3.1 High-Level Architecture"));
  content.push(
    bodyPara(
      "The Reesha Creator Acquisition Operating System is designed as a layered, event-driven architecture with clear separation of concerns. The Admin Dashboard sits at the top, providing human oversight and control. Below it, the Agent Orchestration Layer manages the lifecycle of all AI agents. The Processing Layer handles data collection, enrichment, and scoring. The Data Layer provides persistent storage with Supabase PostgreSQL. The Infrastructure Layer manages queues, caching, and external service integrations."
    )
  );
  content.push(
    bodyPara(
      "The architecture follows an event-driven pattern where each agent produces output that triggers downstream processing. The Discovery Director Agent controls all collection activities, ensuring that scraping is targeted and strategic rather than random. Results flow through a processing pipeline: raw profiles are enriched, deduplicated, scored, and then routed to the outreach system. Human approval gates exist at the outreach stage to maintain quality and compliance."
    )
  );

  content.push(heading2("3.2 Agent Architecture"));
  content.push(
    bodyPara(
      "The agent system is built on LangGraph, which provides stateful workflow orchestration with checkpoint-based persistence. Each agent is implemented as a LangGraph node with defined inputs, outputs, state, and tools. Agents communicate through a shared state graph, where the output of one agent becomes the input to the next. The state transitions are explicitly modeled, enabling full auditability and recovery from failures."
    )
  );
  content.push(
    bodyPara(
      "The seventeen agents are organized into four functional groups: Discovery Agents (Discovery Director, Search Strategy, Collector Agents), Processing Agents (Profile Enrichment, Contact Discovery, Category Classification, Saudi Relevance, Engagement Analysis), Decision Agents (Lead Scoring, Deduplication Identity, Market Coverage, Match Probability), and Outreach Agents (Lead Assignment, AI Sales Outreach, Conversation, Follow-up, Human Escalation). Each group operates semi-independently but shares state through the central graph."
    )
  );

  content.push(heading2("3.3 Data Flow"));
  content.push(
    bodyPara(
      "Data flows through the system in a well-defined pipeline. The Discovery Director initiates search batches based on market coverage gaps. Search Strategy generates queries and hashtags. Collector Agents execute scraping jobs using Apify, Crawlee, Playwright, Scrapling, Firecrawl, or Crawl4AI. Raw profile data is normalized and passed to the Enrichment pipeline. Profile Enrichment uses Firecrawl and Crawl4AI to extract additional data from external links. Contact Discovery extracts emails, phone numbers, and agency information."
    )
  );
  content.push(
    bodyPara(
      "Enriched profiles are then processed by the Classification and Relevance agents. Category Classification assigns primary and secondary categories using LLM-based analysis. Saudi Relevance determines geographic and cultural relevance. Engagement Analysis computes performance metrics. The Deduplication Identity Agent merges duplicate profiles across platforms into unified creator identities. Finally, the Lead Scoring Agent produces a composite score from 0 to 100, and the Market Coverage Agent feeds coverage gaps back to the Discovery Director."
    )
  );

  content.push(heading2("3.4 Event Flow"));
  content.push(
    bodyPara(
      "The system uses an event-driven architecture with Redis-backed Celery queues. Key events include: discovery.batch.created (triggers Search Strategy), profile.collected (triggers Enrichment pipeline), profile.enriched (triggers Classification and Scoring), lead.scored (triggers Assignment), lead.assigned (triggers Outreach), outreach.approved (triggers message sending), creator.responded (triggers Conversation Agent), and creator.registered (triggers conversion tracking). Each event is persisted for auditability and replay capability."
    )
  );

  content.push(heading2("3.5 Queue Architecture"));
  content.push(
    bodyPara(
      "The queue system uses Redis as the message broker and Celery as the task distribution framework. Jobs are organized into priority queues: critical (human escalation triggers, registration events), high (scoring and assignment tasks), normal (enrichment and classification), and low (batch discovery and background crawling). Each queue has configurable concurrency limits and retry policies. Failed jobs are moved to a dead-letter queue for manual inspection. The system supports job chaining, where the completion of one job automatically enqueues the next stage."
    )
  );

  content.push(heading2("3.6 Backend Architecture"));
  content.push(
    bodyPara(
      "The backend is implemented as a FastAPI application with a modular architecture. The API layer exposes REST endpoints for the dashboard and agent control. The Agent Layer implements all seventeen agents as LangGraph nodes. The Service Layer provides business logic for scoring, deduplication, and assignment. The Repository Layer abstracts database access through Supabase client libraries. The Worker Layer runs Celery tasks for asynchronous processing. The Crawler Layer manages all scraping integrations."
    )
  );
  content.push(
    bodyPara(
      "The FastAPI application uses dependency injection for database connections, LLM clients, and external service integrations. Authentication is handled through Supabase Auth with JWT tokens. Rate limiting is applied per-endpoint to prevent abuse. The application exposes health check endpoints for monitoring and supports graceful shutdown with in-flight task completion."
    )
  );

  content.push(heading2("3.7 Deployment Architecture"));
  content.push(
    bodyPara(
      "The system uses a split deployment strategy. The Next.js dashboard is deployed on Vercel with automatic preview deployments for each branch. The FastAPI backend and Celery workers are deployed on Railway or a VPS with Docker containers. Redis runs as a managed service. Supabase provides the managed PostgreSQL database with automatic backups and point-in-time recovery. The system uses environment-based configuration with secrets managed through the hosting platform's secret management."
    )
  );
  content.push(
    makeTable(
      ["Component", "Platform", "Scaling Strategy", "Backup"],
      [
        ["Dashboard (Next.js)", "Vercel", "Serverless auto-scale", "Git-based"],
        ["API (FastAPI)", "Railway / VPS", "Horizontal (workers)", "Docker images"],
        ["Workers (Celery)", "Railway / VPS", "Horizontal (add workers)", "Task logs"],
        ["Database (PostgreSQL)", "Supabase", "Vertical + read replicas", "Automated PITR"],
        ["Cache / Queue (Redis)", "Railway / Upstash", "Managed scaling", "AOF persistence"],
        ["Storage (Files)", "Supabase Storage", "CDN-backed", "Cross-region replication"],
      ],
      [20, 20, 25, 35]
    )
  );

  // ──── 4. AI AGENT SPECIFICATIONS ────
  content.push(heading1("4. AI Agent Specifications"));
  content.push(
    bodyPara(
      "This section provides implementation-level specifications for all seventeen AI agents. Each agent specification includes its purpose, inputs, outputs, state definition, tools, prompt strategy, failure handling, and example JSON contracts. All agents are implemented as LangGraph nodes with checkpoint-based state persistence."
    )
  );

  // Agent 1: Discovery Director
  content.push(heading2("4.1 Discovery Director Agent"));
  content.push(heading3("4.1.1 Purpose"));
  content.push(
    bodyPara(
      "The Discovery Director Agent is the main brain that directs all discovery and scraping activities. It does not scrape directly. Instead, it decides what to search for, which platform to target, which category needs more leads, which city needs more coverage, which hashtags should be expanded, when to stop a search, and when to create new crawler jobs. It operates as a strategic controller that ensures the acquisition engine is always focused on the most valuable market gaps."
    )
  );

  content.push(heading3("4.1.2 Inputs"));
  content.push(...codeBlock([
    '{',
    '  "market": "Saudi Arabia",',
    '  "categories": ["food", "lifestyle", "fashion", "beauty", "tech"],',
    '  "cities": ["Riyadh", "Jeddah", "Dammam"],',
    '  "min_followers": 20000,',
    '  "target_count": 5000,',
    '  "current_coverage": {',
    '    "food": 8200, "lifestyle": 4100,',
    '    "fashion": 3500, "beauty": 2800,',
    '    "tech": 900, "actors": 300',
    '  }',
    '}',
  ]));

  content.push(heading3("4.1.3 Outputs"));
  content.push(...codeBlock([
    '{',
    '  "search_batches": [',
    '    {',
    '      "platform": "instagram",',
    '      "category": "food",',
    '      "city": "Riyadh",',
    '      "queries": ["#riyadhfood", "#mklmat_riyadh", "Riyadh food blogger"],',
    '      "priority": "high",',
    '      "target_count": 500,',
    '      "min_followers": 20000',
    '    },',
    '    {',
    '      "platform": "tiktok",',
    '      "category": "tech",',
    '      "city": "Jeddah",',
    '      "queries": ["#jeddahtech", "#sauditech", "Jeddah tech review"],',
    '      "priority": "critical",',
    '      "target_count": 300,',
    '      "min_followers": 15000',
    '    }',
    '  ]',
    '}',
  ]));

  content.push(heading3("4.1.4 State"));
  content.push(
    makeTable(
      ["State Field", "Type", "Description"],
      [
        ["current_batches", "List[BatchConfig]", "Active discovery batch configurations"],
        ["coverage_map", "Dict[str, int]", "Category-to-count mapping of current database"],
        ["city_coverage", "Dict[str, Dict[str, int]]", "City-to-category coverage mapping"],
        ["platform_quotas", "Dict[str, int]", "Platform-specific daily collection limits"],
        ["last_discovery_run", "datetime", "Timestamp of last discovery cycle"],
        ["underrepresented_categories", "List[str]", "Categories below target threshold"],
      ],
      [25, 30, 45]
    )
  );

  content.push(heading3("4.1.5 Tools"));
  content.push(
    bodyPara(
      "The Discovery Director Agent uses the following tools: Market Coverage Query Tool (queries Supabase for current category and city coverage statistics), Competitor Gap Analysis Tool (compares Reesha database against known market estimates), Hashtag Trend Tool (fetches trending hashtags from social platforms), Batch Creation Tool (creates new discovery batch records in Supabase), and Historical Performance Tool (analyzes past batch success rates to optimize future strategies)."
    )
  );

  content.push(heading3("4.1.6 Prompt Strategy"));
  content.push(
    bodyPara(
      "The agent uses a structured decision-making prompt that prioritizes underrepresented categories and cities. The prompt instructs the LLM to analyze the current coverage map, identify gaps where the database has fewer creators than the estimated market size, and generate targeted search batches. The prompt includes few-shot examples of effective search strategies for the Saudi market, including Arabic hashtag patterns and platform-specific search behaviors."
    )
  );

  content.push(heading3("4.1.7 Failure Handling"));
  content.push(
    bodyPara(
      "If the Market Coverage Query fails, the agent falls back to cached coverage data from the previous run. If batch creation fails due to database connectivity, the agent retries with exponential backoff (3 attempts, 5s, 15s, 45s). If the LLM returns malformed JSON, the agent validates the output against a Pydantic schema and requests regeneration. If all retries are exhausted, the agent logs the failure and alerts the dashboard for manual intervention."
    )
  );

  // Agent 2: Search Strategy Agent
  content.push(heading2("4.2 Search Strategy Agent"));
  content.push(heading3("4.2.1 Purpose"));
  content.push(
    bodyPara(
      "The Search Strategy Agent generates search queries, hashtags, keywords, and seed accounts for each discovery batch. It transforms the strategic direction from the Discovery Director into concrete, executable search plans. The agent has deep knowledge of Saudi social media behavior, including Arabic hashtag conventions, platform-specific search patterns, and seasonal trends that affect creator activity."
    )
  );

  content.push(heading3("4.2.2 Inputs and Outputs"));
  content.push(
    bodyPara(
      "The agent receives a batch configuration from the Discovery Director and produces an expanded search plan. For example, given a batch targeting food creators in Riyadh on Instagram, the agent generates Arabic hashtags like #mklmat_riyadh and #riyadhfood, English hashtags like #riyadhfoodblogger and #saudifoodie, keyword combinations like 'Riyadh restaurant review', seed accounts of known food creators to expand from, and location-based search parameters."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "batch_id": "uuid-here",',
    '  "platform": "instagram",',
    '  "category": "food",',
    '  "city": "Riyadh",',
    '  "search_plan": {',
    '    "arabic_hashtags": ["#mklmat_riyadh", "#kafihyat_riyadh", "#tabkh_saudi"],',
    '    "english_hashtags": ["#riyadhfood", "#saudifoodie", "#riyadheats"],',
    '    "keywords": ["Riyadh food blogger", "Saudi restaurant review"],',
    '    "seed_accounts": ["@riyadh.food", "@saudifoodie"],',
    '    "location_ids": ["riyadh_region"],',
    '    "explore_categories": ["food_dining", "restaurant_reviews"]',
    '  }',
    '}',
  ]));

  content.push(heading3("4.2.3 Tools and Failure Handling"));
  content.push(
    bodyPara(
      "The Search Strategy Agent uses a Hashtag Expansion Tool (discovers related hashtags from seed hashtags), a Seed Account Expander (finds similar accounts from seed profiles), and a Google Search Tool (discovers creator directories and agency lists). If hashtag expansion returns no results, the agent falls back to a curated list of Saudi-specific hashtags. If the LLM generates culturally inappropriate queries, a validation layer filters them out before execution."
    )
  );

  // Agent 3: Collector Agents
  content.push(heading2("4.3 Collector Agents"));
  content.push(heading3("4.3.1 Purpose"));
  content.push(
    bodyPara(
      "Collector Agents execute the scraping and collection jobs generated by the Search Strategy Agent. There are five specialized collector types, each designed for different scraping scenarios: the Apify Collector for rapid MVP collection, the Crawlee Collector for scalable custom crawling, the Playwright Collector for browser-rendered pages, the Scrapling Extractor for fast HTML parsing, and the Firecrawl Collector for external link enrichment."
    )
  );

  content.push(heading3("4.3.2 Collector Types"));
  content.push(
    makeTable(
      ["Collector", "Primary Use Case", "Strengths", "Limitations"],
      [
        ["Apify Collector", "MVP, quick testing", "Fast setup, pre-built actors", "Cost at scale, rate limits"],
        ["Crawlee Collector", "Long-term scalable crawling", "Queue mgmt, retry, proxy", "Higher development effort"],
        ["Playwright Collector", "JS-heavy rendered pages", "Full browser automation", "Resource-intensive, slower"],
        ["Scrapling Extractor", "HTML parsing after load", "Fast, structured extraction", "No JS rendering"],
        ["Firecrawl Collector", "External link enrichment", "AI-ready page conversion", "API rate limits"],
        ["Crawl4AI Collector", "LLM-assisted extraction", "Markdown conversion, AI-ready", "Higher latency per page"],
      ],
      [18, 22, 30, 30]
    )
  );

  content.push(heading3("4.3.3 Output Contract"));
  content.push(...codeBlock([
    '{',
    '  "platform": "instagram",',
    '  "username": "creator_name",',
    '  "profile_url": "https://instagram.com/creator_name",',
    '  "display_name": "Creator Display Name",',
    '  "bio": "Saudi food creator | Riyadh | Collabs: email@me.com",',
    '  "followers_count": 125000,',
    '  "following_count": 800,',
    '  "posts_count": 450,',
    '  "is_verified": false,',
    '  "profile_image_url": "https://...",',
    '  "external_links": ["https://linktr.ee/example"],',
    '  "recent_posts": [',
    '    { "caption": "...", "likes": 3200, "comments": 85, "date": "2026-05-20" }',
    '  ],',
    '  "scraped_at": "2026-06-09T10:30:00Z",',
    '  "source_batch_id": "uuid-here"',
    '}',
  ]));

  content.push(heading3("4.3.4 Failure Handling"));
  content.push(
    bodyPara(
      "Each collector implements retry logic with exponential backoff. If a profile page returns a 429 (rate limit), the collector pauses for the indicated cooldown period and then retries. If a page returns a 404 or the profile no longer exists, the collector logs it and skips. If the page structure has changed and parsing fails, the collector saves the raw HTML for manual inspection and attempts to parse with an alternative extractor. If a batch exceeds its error rate threshold (15% failures), the batch is paused and the Discovery Director is notified."
    )
  );

  // Agent 4: Profile Enrichment Agent
  content.push(heading2("4.4 Profile Enrichment Agent"));
  content.push(heading3("4.4.1 Purpose"));
  content.push(
    bodyPara(
      "The Profile Enrichment Agent enriches the creator profile using external links and public data discovered during the collection phase. It follows bio links, Linktree pages, personal websites, agency pages, and media kit pages to extract additional contact information, cross-platform links, professional details, and brand partnership history. This agent transforms a basic social profile into a rich, actionable lead record."
    )
  );

  content.push(heading3("4.4.2 Output Contract"));
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "emails": ["creator@email.com"],',
    '  "phones": ["+9665XXXXXXXX"],',
    '  "management_agency": "Agency Name",',
    '  "agency_contact": "agency@email.com",',
    '  "other_platforms": {',
    '    "tiktok": "https://tiktok.com/@creator",',
    '    "youtube": "https://youtube.com/@creator",',
    '    "twitter": "https://twitter.com/creator"',
    '  },',
    '  "website": "https://creator-website.com",',
    '  "media_kit_url": "https://...",',
    '  "brand_partners": ["Brand A", "Brand B"],',
    '  "languages": ["Arabic", "English"],',
    '  "enriched_at": "2026-06-09T10:35:00Z"',
    '}',
  ]));

  content.push(heading3("4.4.3 Tools"));
  content.push(
    bodyPara(
      "The agent uses Firecrawl for crawling external link pages, Crawl4AI for AI-assisted content extraction from complex pages, Scrapling for fast HTML parsing of simple pages, and an Email Extraction Tool that uses regex patterns and LLM-based extraction to find email addresses in page content. All enrichment data is source-tagged to maintain data provenance."
    )
  );

  // Agent 5: Contact Discovery Agent
  content.push(heading2("4.5 Contact Discovery Agent"));
  content.push(
    bodyPara(
      "The Contact Discovery Agent specializes in finding and verifying contact information for creators. While the Profile Enrichment Agent discovers contacts as part of broader enrichment, this agent focuses specifically on contact discovery with deeper analysis. It checks bio text for email patterns, follows Linktree and similar link aggregator pages, searches for WhatsApp contact buttons, identifies management agency contacts, and cross-references public directories. The agent assigns a confidence score to each discovered contact, indicating the likelihood that the contact is current and active."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "contacts": [',
    '    {',
    '      "type": "email",',
    '      "value": "creator@email.com",',
    '      "source": "instagram_bio",',
    '      "confidence": 0.95,',
    '      "is_public": true,',
    '      "is_verified": false',
    '    },',
    '    {',
    '      "type": "phone",',
    '      "value": "+9665XXXXXXXX",',
    '      "source": "linktree_page",',
    '      "confidence": 0.70,',
    '      "is_public": true,',
    '      "is_verified": false',
    '    }',
    '  ],',
    '  "best_contact_channel": "email",',
    '  "outreach_readiness": "ready"',
    '}',
  ]));

  // Agent 6: Category Classification Agent
  content.push(heading2("4.6 Category Classification Agent"));
  content.push(
    bodyPara(
      "The Category Classification Agent assigns primary and secondary categories to each creator using a combination of LLM-based analysis and rule-based signals. The classification inputs include bio text, recent post captions, hashtags used, username patterns, external links, and visual content descriptions where available. The agent assigns one primary category and up to three secondary categories from a predefined taxonomy of seventeen categories: Food, Fashion, Beauty, Lifestyle, Comedy, Fitness, Actor, Artist, Singer, Travel, Tech, Gaming, Family, Business, Education, Model, and Other."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "primary_category": "food",',
    '  "secondary_categories": ["lifestyle", "travel"],',
    '  "category_confidence": {',
    '    "food": 0.92,',
    '    "lifestyle": 0.65,',
    '    "travel": 0.45',
    '  },',
    '  "classification_signals": {',
    '    "bio_keywords": ["food", "restaurant", "Riyadh"],',
    '    "hashtag_categories": ["food", "dining"],',
    '    "content_analysis": "food_photography_heavy"',
    '  }',
    '}',
  ]));

  // Agent 7: Saudi Relevance Agent
  content.push(heading2("4.7 Saudi Relevance Agent"));
  content.push(
    bodyPara(
      "The Saudi Relevance Agent determines whether a creator is genuinely relevant to the Saudi Arabian market. This is critical because many creators with Arabic content may be based in other GCC countries, Egypt, or the Levant, and would not be suitable for the Saudi-focused platform. The agent analyzes multiple signals: the presence of Saudi Arabic dialect (Najdi, Hijazi, or Eastern Province dialects), Saudi city mentions in bio or captions, Saudi-specific hashtags, Saudi phone numbers (+966), mentions of Saudi brands or restaurants, and location tags within Saudi cities."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "saudi_relevance_score": 0.85,',
    '  "relevance_signals": {',
    '    "saudi_dialect_detected": true,',
    '    "cities_mentioned": ["Riyadh", "Jeddah"],',
    '    "saudi_hashtags": ["#saudi", "#riyadh"],',
    '    "saudi_phone": true,',
    '    "saudi_brands_mentioned": ["Albaik", "Jarir"],',
    '    "location_tags_saudi": true',
    '  },',
    '  "primary_city": "Riyadh",',
    '  "confidence": 0.85',
    '}',
  ]));

  // Agent 8: Engagement Analysis Agent
  content.push(heading2("4.8 Engagement Analysis Agent"));
  content.push(
    bodyPara(
      "The Engagement Analysis Agent analyzes recent content performance to compute engagement metrics that feed into the Lead Scoring Agent. It processes the last 12-30 posts to calculate average likes, average comments, average views (for video content), engagement rate, posting frequency, content consistency, recent activity status, and viral potential. The engagement rate is calculated as ((Average Likes + Average Comments) / Followers) multiplied by 100. The agent also detects engagement anomalies that might indicate purchased followers or engagement pods."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "platform": "instagram",',
    '  "metrics": {',
    '    "avg_likes": 3200,',
    '    "avg_comments": 85,',
    '    "avg_views": null,',
    '    "engagement_rate": 2.62,',
    '    "posting_frequency": "4.2 posts/week",',
    '    "content_consistency": 0.78,',
    '    "last_post_date": "2026-06-01",',
    '    "days_inactive": 8,',
    '    "viral_potential": 0.35',
    '  },',
    '  "anomaly_flags": [],',
    '  "analysis_period": "last_30_posts"',
    '}',
  ]));

  // Agent 9: Lead Scoring Agent
  content.push(heading2("4.9 Lead Scoring Agent"));
  content.push(
    bodyPara(
      "The Lead Scoring Agent produces a composite score from 0 to 100 for each creator. The scoring framework weighs seven dimensions: Followers (25 points), Engagement (25 points), Saudi Relevance (15 points), Category Commercial Value (10 points), Contact Availability (10 points), Brand Safety (10 points), and Registration Probability (5 points). The detailed formulas for each dimension are provided in Section 6 (Scoring Engine)."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "total_score": 78,',
    '  "score_breakdown": {',
    '    "followers_score": 20,',
    '    "engagement_score": 21,',
    '    "saudi_relevance_score": 13,',
    '    "commercial_value_score": 8,',
    '    "contact_availability_score": 7,',
    '    "brand_safety_score": 7,',
    '    "registration_probability_score": 2',
    '  },',
    '  "priority": "qualified_lead",',
    '  "scored_at": "2026-06-09T10:40:00Z"',
    '}',
  ]));

  // Agent 10: Deduplication Identity Agent
  content.push(heading2("4.10 Deduplication Identity Agent"));
  content.push(
    bodyPara(
      "The Deduplication Identity Agent merges the same creator across multiple platforms into a single unified identity. Without deduplication, a creator with an Instagram account, a TikTok account, and a YouTube channel would appear as three separate leads, leading to wasted outreach effort and inconsistent scoring. The agent uses multiple matching signals: similar name or display name, similar username patterns, same email address, same phone number, same Linktree or website URL, same profile image (using perceptual hashing), cross-linked platform URLs in bio, and similar bio text."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "unified_creator_id": "reesha_uuid",',
    '  "matched_profiles": [',
    '    { "platform": "instagram", "username": "creator", "match_confidence": 0.95 },',
    '    { "platform": "tiktok", "username": "creator_official", "match_confidence": 0.88 },',
    '    { "platform": "youtube", "username": "creator", "match_confidence": 0.82 }',
    '  ],',
    '  "match_signals": {',
    '    "email_match": true,',
    '    "cross_linked": true,',
    '    "name_similarity": 0.92,',
    '    "bio_similarity": 0.75,',
    '    "profile_image_similarity": 0.68',
    '  },',
    '  "primary_platform": "instagram",',
    '  "merge_action": "auto_merge"',
    '}',
  ]));

  // Agent 11: Market Coverage Agent
  content.push(heading2("4.11 Market Coverage Agent"));
  content.push(
    bodyPara(
      "The Market Coverage Agent monitors the overall coverage of the creator database by category, city, and platform. It continuously compares the current database state against target coverage goals and identifies gaps that need to be addressed. When it detects underrepresented segments, it communicates directly with the Discovery Director Agent to request targeted discovery batches. The agent also tracks coverage trends over time to measure the effectiveness of the acquisition strategy."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "timestamp": "2026-06-09T12:00:00Z",',
    '  "category_coverage": {',
    '    "food": { "current": 8200, "target": 10000, "gap": 1800, "priority": "high" },',
    '    "lifestyle": { "current": 4100, "target": 8000, "gap": 3900, "priority": "critical" },',
    '    "actors": { "current": 300, "target": 2000, "gap": 1700, "priority": "critical" }',
    '  },',
    '  "city_coverage": {',
    '    "riyadh": { "current": 12000, "target": 20000, "gap": 8000 },',
    '    "jeddah": { "current": 6000, "target": 12000, "gap": 6000 }',
    '  },',
    '  "recommendation": "Prioritize actor and lifestyle discovery in Riyadh and Jeddah"',
    '}',
  ]));

  // Agent 12: Lead Assignment Agent
  content.push(heading2("4.12 Lead Assignment Agent"));
  content.push(
    bodyPara(
      "The Lead Assignment Agent assigns qualified leads to AI Sales Agents based on category specialization, language compatibility, score tier, city proximity, available contact channels, and current workload balance. The assignment logic ensures that each AI Sales Agent works within its area of expertise, that no agent is overloaded, and that high-priority leads are assigned first. The agent supports both automatic assignment and manual override through the dashboard."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "lead_id": "uuid",',
    '  "assigned_agent_id": "sales_agent_uuid",',
    '  "assignment_reason": {',
    '    "category_match": "food",',
    '    "language_match": "arabic",',
    '    "city_proximity": "same_city",',
    '    "score_tier": "hot_lead"',
    '  },',
    '  "assigned_at": "2026-06-09T11:00:00Z",',
    '  "workload_balance": {',
    '    "agent_current_leads": 45,',
    '    "agent_max_leads": 60',
    '  }',
    '}',
  ]));

  // Agent 13: AI Sales Outreach Agent
  content.push(heading2("4.13 AI Sales Outreach Agent"));
  content.push(
    bodyPara(
      "The AI Sales Outreach Agent generates personalized outreach messages for each lead. The agent crafts messages that reference the creator's specific content category, platform, and city, while strictly adhering to the communication rules: never guarantee campaigns, never guarantee income, always mention free registration, keep messages short and professional, and use Arabic or English based on the creator's detected language. Messages are generated as drafts that require human approval before sending."
    )
  );
  content.push(
    bodyPara(
      "The Arabic first-contact message template follows a warm, professional tone that is culturally appropriate for the Saudi market. The English template maintains the same structure with appropriate localization. Both templates include a personalization slot for the creator's name, platform reference, and an invitation to receive the registration link."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "lead_id": "uuid",',
    '  "channel": "instagram_dm",',
    '  "language": "arabic",',
    '  "message_type": "first_contact",',
    '  "message_text": "Ahlan {creator_name}...",',
    '  "personalization_data": {',
    '    "creator_name": "Ahmad",',
    '    "platform": "Instagram",',
    '    "category": "food",',
    '    "city": "Riyadh"',
    '  },',
    '  "status": "draft",',
    '  "compliance_checks": {',
    '    "no_income_guarantee": true,',
    '    "no_campaign_guarantee": true,',
    '    "free_registration_mentioned": true,',
    '    "professional_tone": true',
    '  }',
    '}',
  ]));

  // Agent 14: Conversation Agent
  content.push(heading2("4.14 Conversation Agent"));
  content.push(
    bodyPara(
      "The Conversation Agent assists with replies when creators respond to outreach messages. It maintains conversation context, suggests appropriate responses, and detects intent signals such as interest, skepticism, questions about the platform, or rejection. The agent has a knowledge base of common creator questions and their approved answers, including explanations of what Reesha is, how registration works, what benefits creators receive, and privacy assurances. Complex business questions, legal inquiries, and contract discussions are escalated to the Human Escalation Agent."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "conversation_id": "uuid",',
    '  "lead_id": "uuid",',
    '  "last_message": "What is Reesha?",',
    '  "detected_intent": "information_request",',
    '  "suggested_reply": "Reesha is a Saudi platform that helps creators...",',
    '  "reply_language": "english",',
    '  "confidence": 0.92,',
    '  "needs_escalation": false',
    '}',
  ]));

  // Agent 15: Follow-up Agent
  content.push(heading2("4.15 Follow-up Agent"));
  content.push(
    bodyPara(
      "The Follow-up Agent creates and schedules follow-up messages for leads that have not responded to initial outreach. The follow-up timeline is: first follow-up at 48 hours, second follow-up at 5 days, and final follow-up at 10 days. After the final follow-up with no response, the lead status is changed to 'no_response' and no further automated messages are sent. Each follow-up message is personalized and references the previous contact, maintaining a professional and non-pushy tone."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "lead_id": "uuid",',
    '  "followup_sequence": 1,',
    '  "scheduled_at": "2026-06-11T10:00:00Z",',
    '  "message_text": "Ahlan {creator_name}, wanted to follow up regarding Reesha...",',
    '  "previous_contact_date": "2026-06-09T10:00:00Z",',
    '  "days_since_last_contact": 2,',
    '  "status": "scheduled"',
    '}',
  ]));

  // Agent 16: Human Escalation Agent
  content.push(heading2("4.16 Human Escalation Agent"));
  content.push(
    bodyPara(
      "The Human Escalation Agent transfers leads to human team members when the conversation exceeds the AI agent's capabilities. Escalation triggers include: the creator asks about payment or compensation, the creator asks for a contract or legal terms, the creator asks about exclusivity, the creator is a high-value lead (score above 90), the creator is interested but needs detailed explanation, the creator requests a phone call, the creator has a registration issue, or the AI agent detects negative sentiment that could damage the Reesha brand."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "lead_id": "uuid",',
    '  "escalation_reason": "creator_asks_about_payment",',
    '  "escalated_to": "human_agent_uuid",',
    '  "conversation_summary": "Creator is interested but wants to know about payment structure...",',
    '  "priority": "high",',
    '  "escalated_at": "2026-06-09T14:00:00Z",',
    '  "suggested_response_approach": "Explain that Reesha connects creators with brands, payment comes from campaigns"',
    '}',
  ]));

  // Agent 17: Match Probability Agent
  content.push(heading2("4.17 Match Probability Agent"));
  content.push(
    bodyPara(
      "The Match Probability Agent predicts how well a creator matches the needs of brands and agencies on the Reesha platform. This is distinct from the Lead Scoring Agent, which scores the creator's acquisition priority. The Match Probability Agent scores how likely a creator is to receive campaign opportunities once registered, which directly affects long-term platform value. It considers the creator's category demand on the platform, audience demographics alignment with brand needs, content quality and professionalism, and historical campaign match data for similar creators."
    )
  );
  content.push(...codeBlock([
    '{',
    '  "influencer_id": "uuid",',
    '  "match_probability": 0.72,',
    '  "demand_signals": {',
    '    "category_demand": "high",',
    '    "brand_requests_for_category": 45,',
    '    "similar_creators_registered": 120,',
    '    "similar_creators_with_campaigns": 35',
    '  },',
    '  "projected_campaign_frequency": "2-3 per quarter",',
    '  "top_matching_brands": ["Restaurant Brand A", "FMCG Brand B"]',
    '}',
  ]));

  // ──── 5. DATABASE DESIGN ────
  content.push(heading1("5. Database Design"));
  content.push(heading2("5.1 Overview"));
  content.push(
    bodyPara(
      "The database is hosted on Supabase PostgreSQL with the pgvector extension for similarity search. The schema is designed for production workloads with proper indexing, constraints, relationships, and Row-Level Security (RLS) policies. The design follows a normalized structure with strategic denormalization for performance-critical queries. All tables use UUID primary keys for distributed system compatibility and include timestamps for auditability."
    )
  );

  content.push(heading2("5.2 influencers"));
  content.push(...codeBlock([
    'CREATE TABLE influencers (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  full_name TEXT,',
    '  display_name TEXT,',
    '  creator_type TEXT,',
    '  primary_category TEXT,',
    '  secondary_categories TEXT[],',
    '  country TEXT DEFAULT \'Saudi Arabia\',',
    '  city TEXT,',
    '  primary_language TEXT DEFAULT \'arabic\',',
    '  gender TEXT,',
    '  profile_summary TEXT,',
    '  profile_image_url TEXT,',
    '  registration_status TEXT DEFAULT \'not_registered\'',
    '    CHECK (registration_status IN (',
    '      \'not_registered\',\'pending\',\'registered\',\'rejected\')),',
    '  status TEXT DEFAULT \'new\'',
    '    CHECK (status IN (',
    '      \'new\',\'qualified\',\'assigned\',\'contacted\',',
    '      \'follow_up\',\'interested\',\'registered\',',
    '      \'rejected\',\'no_response\')),',
    '  saudi_relevance_score NUMERIC(3,2) DEFAULT 0,',
    '  total_score INTEGER DEFAULT 0,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE INDEX idx_influencers_status ON influencers(status);',
    'CREATE INDEX idx_influencers_category ON influencers(primary_category);',
    'CREATE INDEX idx_influencers_city ON influencers(city);',
    'CREATE INDEX idx_influencers_score ON influencers(total_score DESC);',
    'CREATE INDEX idx_influencers_registration ON influencers(registration_status);',
    'CREATE INDEX idx_influencers_creator_type ON influencers(creator_type);',
  ]));

  content.push(heading2("5.3 social_profiles"));
  content.push(...codeBlock([
    'CREATE TABLE social_profiles (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,',
    '  platform TEXT NOT NULL',
    '    CHECK (platform IN (\'instagram\',\'tiktok\',\'youtube\',',
    '      \'twitter\',\'snapchat\',\'other\')),',
    '  username TEXT NOT NULL,',
    '  profile_url TEXT,',
    '  bio TEXT,',
    '  followers_count INTEGER DEFAULT 0,',
    '  following_count INTEGER DEFAULT 0,',
    '  posts_count INTEGER DEFAULT 0,',
    '  avg_likes NUMERIC DEFAULT 0,',
    '  avg_comments NUMERIC DEFAULT 0,',
    '  avg_views NUMERIC DEFAULT 0,',
    '  engagement_rate NUMERIC(5,2) DEFAULT 0,',
    '  verified BOOLEAN DEFAULT FALSE,',
    '  profile_image_url TEXT,',
    '  external_links TEXT[],',
    '  last_checked_at TIMESTAMPTZ,',
    '  raw_data JSONB,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  UNIQUE(platform, username)',
    ');',
    '',
    'CREATE INDEX idx_social_profiles_influencer',
    '  ON social_profiles(influencer_id);',
    'CREATE INDEX idx_social_profiles_platform',
    '  ON social_profiles(platform);',
    'CREATE INDEX idx_social_profiles_followers',
    '  ON social_profiles(followers_count DESC);',
  ]));

  content.push(heading2("5.4 influencer_contacts"));
  content.push(...codeBlock([
    'CREATE TABLE influencer_contacts (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,',
    '  contact_type TEXT NOT NULL',
    '    CHECK (contact_type IN (\'email\',\'phone\',\'whatsapp\',',
    '      \'agency_email\',\'agency_phone\')),',
    '  contact_value TEXT NOT NULL,',
    '  source TEXT,',
    '  confidence NUMERIC(3,2) DEFAULT 0.5,',
    '  is_public BOOLEAN DEFAULT TRUE,',
    '  is_verified BOOLEAN DEFAULT FALSE,',
    '  consent_status TEXT DEFAULT \'unknown\'',
    '    CHECK (consent_status IN (\'unknown\',\'granted\',\'denied\')),',
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE INDEX idx_contacts_influencer',
    '  ON influencer_contacts(influencer_id);',
    'CREATE INDEX idx_contacts_type',
    '  ON influencer_contacts(contact_type);',
  ]));

  content.push(heading2("5.5 leads"));
  content.push(...codeBlock([
    'CREATE TABLE leads (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,',
    '  lead_score INTEGER DEFAULT 0,',
    '  priority TEXT DEFAULT \'normal\'',
    '    CHECK (priority IN (\'low\',\'normal\',\'high\',\'critical\')),',
    '  lead_stage TEXT DEFAULT \'new\'',
    '    CHECK (lead_stage IN (\'new\',\'qualified\',\'assigned\',',
    '      \'message_drafted\',\'contacted\',\'follow_up\',',
    '      \'interested\',\'registered\',\'rejected\',\'no_response\')),',
    '  score_breakdown JSONB,',
    '  assigned_agent_id UUID,',
    '  assigned_to_human UUID,',
    '  source TEXT,',
    '  notes TEXT,',
    '  next_action TEXT,',
    '  next_action_at TIMESTAMPTZ,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE INDEX idx_leads_influencer ON leads(influencer_id);',
    'CREATE INDEX idx_leads_stage ON leads(lead_stage);',
    'CREATE INDEX idx_leads_score ON leads(lead_score DESC);',
    'CREATE INDEX idx_leads_priority ON leads(priority);',
    'CREATE INDEX idx_leads_agent ON leads(assigned_agent_id);',
    'CREATE INDEX idx_leads_next_action ON leads(next_action_at)',
    '  WHERE next_action_at IS NOT NULL;',
  ]));

  content.push(heading2("5.6 conversations"));
  content.push(...codeBlock([
    'CREATE TABLE conversations (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,',
    '  channel TEXT',
    '    CHECK (channel IN (\'instagram_dm\',\'tiktok_message\',',
    '      \'email\',\'phone\',\'whatsapp\')),',
    '  last_message TEXT,',
    '  summary TEXT,',
    '  intent_status TEXT,',
    '  sentiment TEXT,',
    '  next_action TEXT,',
    '  message_count INTEGER DEFAULT 0,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  updated_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE INDEX idx_conversations_lead ON conversations(lead_id);',
  ]));

  content.push(heading2("5.7 outreach_messages"));
  content.push(...codeBlock([
    'CREATE TABLE outreach_messages (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,',
    '  conversation_id UUID REFERENCES conversations(id),',
    '  channel TEXT,',
    '  language TEXT DEFAULT \'arabic\',',
    '  message_type TEXT',
    '    CHECK (message_type IN (\'first_contact\',\'follow_up_1\',',
    '      \'follow_up_2\',\'follow_up_3\',\'reply\',\'escalation\')),',
    '  message_text TEXT NOT NULL,',
    '  status TEXT DEFAULT \'draft\'',
    '    CHECK (status IN (\'draft\',\'approved\',\'sent\',',
    '      \'delivered\',\'read\',\'replied\',\'failed\')),',
    '  approved_by UUID,',
    '  sent_by UUID,',
    '  sent_at TIMESTAMPTZ,',
    '  response_at TIMESTAMPTZ,',
    '  response_text TEXT,',
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
    '',
    'CREATE INDEX idx_outreach_lead ON outreach_messages(lead_id);',
    'CREATE INDEX idx_outreach_status ON outreach_messages(status);',
    'CREATE INDEX idx_outreach_type ON outreach_messages(message_type);',
  ]));

  content.push(heading2("5.8 discovery_batches"));
  content.push(...codeBlock([
    'CREATE TABLE discovery_batches (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  name TEXT,',
    '  market TEXT DEFAULT \'Saudi Arabia\',',
    '  platform TEXT,',
    '  category TEXT,',
    '  city TEXT,',
    '  min_followers INTEGER DEFAULT 20000,',
    '  target_count INTEGER,',
    '  collected_count INTEGER DEFAULT 0,',
    '  status TEXT DEFAULT \'pending\'',
    '    CHECK (status IN (\'pending\',\'running\',\'paused\',',
    '      \'completed\',\'failed\')),',
    '  config JSONB,',
    '  error_log TEXT,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  started_at TIMESTAMPTZ,',
    '  completed_at TIMESTAMPTZ',
    ');',
    '',
    'CREATE INDEX idx_batches_status ON discovery_batches(status);',
    'CREATE INDEX idx_batches_category ON discovery_batches(category);',
  ]));

  content.push(heading2("5.9 agent_tasks"));
  content.push(...codeBlock([
    'CREATE TABLE agent_tasks (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  task_type TEXT NOT NULL,',
    '  status TEXT DEFAULT \'pending\'',
    '    CHECK (status IN (\'pending\',\'running\',\'completed\',',
    '      \'failed\',\'cancelled\')),',
    '  priority TEXT DEFAULT \'normal\'',
    '    CHECK (priority IN (\'low\',\'normal\',\'high\',\'critical\')),',
    '  input JSONB,',
    '  output JSONB,',
    '  error TEXT,',
    '  assigned_agent TEXT,',
    '  retry_count INTEGER DEFAULT 0,',
    '  max_retries INTEGER DEFAULT 3,',
    '  created_at TIMESTAMPTZ DEFAULT NOW(),',
    '  started_at TIMESTAMPTZ,',
    '  completed_at TIMESTAMPTZ',
    ');',
    '',
    'CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);',
    'CREATE INDEX idx_agent_tasks_type ON agent_tasks(task_type);',
    'CREATE INDEX idx_agent_tasks_agent ON agent_tasks(assigned_agent);',
  ]));

  content.push(heading2("5.10 ai_sales_agents"));
  content.push(...codeBlock([
    'CREATE TABLE ai_sales_agents (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  name TEXT NOT NULL,',
    '  specialization TEXT[],',
    '  language TEXT[] DEFAULT \'{arabic}\',',
    '  is_active BOOLEAN DEFAULT TRUE,',
    '  current_lead_count INTEGER DEFAULT 0,',
    '  max_lead_count INTEGER DEFAULT 60,',
    '  total_contacts_made INTEGER DEFAULT 0,',
    '  total_registrations INTEGER DEFAULT 0,',
    '  conversion_rate NUMERIC(5,2) DEFAULT 0,',
    '  created_at TIMESTAMPTZ DEFAULT NOW()',
    ');',
  ]));

  content.push(heading2("5.11 analytics tables"));
  content.push(...codeBlock([
    'CREATE TABLE daily_analytics (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  date DATE NOT NULL,',
    '  total_creators INTEGER DEFAULT 0,',
    '  new_creators_day INTEGER DEFAULT 0,',
    '  total_leads INTEGER DEFAULT 0,',
    '  hot_leads INTEGER DEFAULT 0,',
    '  qualified_leads INTEGER DEFAULT 0,',
    '  contacted_leads INTEGER DEFAULT 0,',
    '  interested_leads INTEGER DEFAULT 0,',
    '  registered_leads INTEGER DEFAULT 0,',
    '  conversion_rate NUMERIC(5,2) DEFAULT 0,',
    '  messages_sent INTEGER DEFAULT 0,',
    '  messages_approved INTEGER DEFAULT 0,',
    '  agent_tasks_completed INTEGER DEFAULT 0,',
    '  agent_tasks_failed INTEGER DEFAULT 0,',
    '  UNIQUE(date)',
    ');',
    '',
    'CREATE TABLE category_analytics (',
    '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
    '  date DATE NOT NULL,',
    '  category TEXT NOT NULL,',
    '  creator_count INTEGER DEFAULT 0,',
    '  avg_score NUMERIC(5,2) DEFAULT 0,',
    '  contacted_count INTEGER DEFAULT 0,',
    '  registered_count INTEGER DEFAULT 0,',
    '  conversion_rate NUMERIC(5,2) DEFAULT 0,',
    '  UNIQUE(date, category)',
    ');',
  ]));

  content.push(heading2("5.12 Row-Level Security Recommendations"));
  content.push(
    bodyPara(
      "Row-Level Security (RLS) policies are critical for protecting sensitive data, especially contact information and conversation content. The following RLS policies are recommended: all tables should have RLS enabled, dashboard users should only see data appropriate to their role (admin, sales_manager, sales_agent), contact information should only be visible to assigned agents and managers, conversation content should be restricted to assigned agents and managers, and analytics tables should be readable by all authenticated users but writable only by system processes."
    )
  );
  content.push(...codeBlock([
    '-- Enable RLS on all tables',
    'ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE influencer_contacts ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE leads ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;',
    'ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;',
    '',
    '-- Admin can see all data',
    'CREATE POLICY admin_all_access ON influencers',
    '  FOR ALL USING (auth.jwt() ->> \'role\' = \'admin\');',
    '',
    '-- Sales agents see only assigned leads',
    'CREATE POLICY agent_assigned_leads ON leads',
    '  FOR SELECT USING (',
    '    assigned_agent_id::text = auth.uid()::text',
    '    OR auth.jwt() ->> \'role\' = \'admin\'',
    '  );',
    '',
    '-- Contacts visible only to assigned agents',
    'CREATE POLICY agent_contacts ON influencer_contacts',
    '  FOR SELECT USING (',
    '    influencer_id IN (',
    '      SELECT influencer_id FROM leads',
    '      WHERE assigned_agent_id::text = auth.uid()::text',
    '    ) OR auth.jwt() ->> \'role\' = \'admin\'',
    '  );',
  ]));

  // ──── 6. SCORING ENGINE ────
  content.push(heading1("6. Scoring Engine"));
  content.push(heading2("6.1 100-Point Scoring Framework"));
  content.push(
    bodyPara(
      "The Lead Scoring Engine produces a composite score from 0 to 100 for each creator. The score determines the lead's priority and affects how quickly the creator is contacted. The framework weighs seven dimensions, with Followers and Engagement receiving the highest weights because they are the strongest predictors of a creator's value on the Reesha platform. The scoring formulas are designed to be transparent, auditable, and easily adjustable as the business learns which factors best predict successful conversion."
    )
  );
  content.push(
    makeTable(
      ["Dimension", "Max Points", "Weight", "Description"],
      [
        ["Followers Score", "25", "25%", "Size of the creator's audience"],
        ["Engagement Score", "25", "25%", "Quality of audience interaction"],
        ["Saudi Relevance Score", "15", "15%", "Geographic and cultural relevance to Saudi"],
        ["Commercial Value Score", "10", "10%", "Category demand and brand fit"],
        ["Contact Availability Score", "10", "10%", "Availability of contact channels"],
        ["Brand Safety Score", "10", "10%", "Content safety and professionalism"],
        ["Registration Probability Score", "5", "5%", "Likelihood of successful conversion"],
        ["TOTAL", "100", "100%", "Composite lead score"],
      ],
      [25, 15, 15, 45]
    )
  );

  content.push(heading2("6.2 Followers Score (25 points)"));
  content.push(
    bodyPara(
      "The Followers Score uses a logarithmic scale to reward audience size while diminishing returns at very high follower counts. The formula is: Followers Score = min(25, 5 * log10(followers_count / 10000)). This means 10,000 followers earns approximately 0 points (below threshold), 20,000 followers earns approximately 1.5 points, 50,000 followers earns approximately 3.5 points, 100,000 followers earns approximately 5 points, 500,000 followers earns approximately 8.5 points, and 1,000,000 followers earns approximately 10 points. The maximum of 25 points is reached at approximately 100 million followers, which provides a natural ceiling."
    )
  );

  content.push(heading2("6.3 Engagement Score (25 points)"));
  content.push(
    bodyPara(
      "The Engagement Score evaluates the quality of audience interaction relative to the creator's follower count. The engagement rate is calculated as: Engagement Rate = ((Average Likes + Average Comments) / Followers) * 100. The Engagement Score formula is: Engagement Score = min(25, engagement_rate * 5). This means a 1% engagement rate earns 5 points, a 2% rate earns 10 points, a 3% rate earns 15 points, a 4% rate earns 20 points, and a 5% rate earns the maximum 25 points. An additional bonus of up to 5 points is added for posting frequency (4+ posts per week) and content consistency (regular posting schedule)."
    )
  );

  content.push(heading2("6.4 Saudi Relevance Score (15 points)"));
  content.push(
    bodyPara(
      "The Saudi Relevance Score determines how strongly the creator is connected to the Saudi market. The score is computed from binary signals, each contributing a weighted portion of the 15 points: Saudi dialect detected (3 points), Saudi city mentioned (3 points), Saudi hashtags used (2 points), Saudi phone number present (3 points), Saudi brands or restaurants mentioned (2 points), and location tags in Saudi Arabia (2 points). The maximum score of 15 requires all signals to be present, which indicates a creator who is deeply embedded in the Saudi market."
    )
  );

  content.push(heading2("6.5 Commercial Value Score (10 points)"));
  content.push(
    bodyPara(
      "The Commercial Value Score assesses how commercially valuable the creator's category is to brands on the Reesha platform. Categories with higher brand demand receive higher scores. The category commercial values are: Food (10), Fashion (10), Beauty (9), Lifestyle (8), Fitness (7), Travel (7), Tech (6), Comedy (6), Acting (5), Music (5), Art (4), Family (4), Gaming (4), Business (3), Education (3), and Other (2). A creator's commercial value is the score of their primary category plus 20% of their secondary category scores, capped at 10."
    )
  );

  content.push(heading2("6.6 Contact Availability Score (10 points)"));
  content.push(
    bodyPara(
      "The Contact Availability Score rewards creators who have accessible contact information, as this directly affects the ability to reach them for outreach. The scoring is: email available and verified (4 points), email available but unverified (2 points), phone number available and verified (3 points), phone number available but unverified (1.5 points), WhatsApp available (2 points), and agency contact available (1 point). The maximum score of 10 requires both verified email and verified phone, plus either WhatsApp or agency contact."
    )
  );

  content.push(heading2("6.7 Brand Safety Score (10 points)"));
  content.push(
    bodyPara(
      "The Brand Safety Score evaluates whether the creator's content is safe for brand partnerships. This is assessed by analyzing the creator's bio, recent posts, and any flagged content. The scoring starts at 10 and subtracts points for risks: explicit content detected (-5), controversial or political content (-3), fake engagement indicators (-4), inconsistent posting pattern (-1), negative brand mentions (-2), and inappropriate language (-2). The minimum score is 0. A creator with no detected issues receives the full 10 points."
    )
  );

  content.push(heading2("6.8 Registration Probability Score (5 points)"));
  content.push(
    bodyPara(
      "The Registration Probability Score predicts the likelihood that the creator will register on the Reesha platform after being contacted. The formula uses a logistic regression model trained on historical conversion data, with key features including: engagement rate (higher engagement correlates with higher registration), content professionalism (professional-looking profiles convert better), platform activity (recently active creators are more likely to respond), category demand (creators in high-demand categories see more value in registering), and contact quality (verified contacts lead to higher conversion). The raw probability is scaled to 0-5 points."
    )
  );

  content.push(heading2("6.9 Priority Classification"));
  content.push(
    makeTable(
      ["Score Range", "Priority Level", "Action", "SLA"],
      [
        ["80-100", "Hot Lead", "Immediate assignment, priority outreach", "Contact within 24 hours"],
        ["60-79", "Qualified Lead", "Standard assignment, regular outreach", "Contact within 48 hours"],
        ["40-59", "Nurture Lead", "Low-priority outreach, nurture campaigns", "Contact within 1 week"],
        ["0-39", "Low Priority", "Database entry only, no active outreach", "Re-evaluate quarterly"],
      ],
      [15, 20, 35, 30]
    )
  );

  // ──── 7. DASHBOARD DESIGN ────
  content.push(heading1("7. Dashboard Design"));
  content.push(heading2("7.1 Overview Page"));
  content.push(
    bodyPara(
      "The Overview Page provides a high-level snapshot of the entire acquisition pipeline. It displays key metrics in card format at the top: total creators in the database, total leads, hot leads count, qualified leads count, contacted leads count, interested leads count, registered creators count, and overall conversion rate. Below the metrics, the page features category coverage visualization showing the distribution of creators across categories with gap indicators, city coverage visualization showing geographic distribution, and a conversion funnel chart showing the flow from discovery to registration."
    )
  );
  content.push(
    makeTable(
      ["Component", "Data Source", "Refresh Rate", "User Actions"],
      [
        ["Metric Cards", "daily_analytics + live queries", "5 min", "Click to drill down"],
        ["Category Coverage Chart", "category_analytics", "5 min", "Filter by city/platform"],
        ["City Coverage Map", "influencers (city agg)", "5 min", "Click city for detail"],
        ["Conversion Funnel", "leads (stage agg)", "5 min", "Click stage for list"],
        ["Recent Activity Feed", "agent_tasks + outreach_messages", "30 sec", "Click for detail"],
      ],
      [25, 25, 15, 35]
    )
  );

  content.push(heading2("7.2 Leads Page"));
  content.push(
    bodyPara(
      "The Leads Page is the primary working view for the sales team. It displays a filterable, sortable table of all leads with the following columns: Name, Platform, Username, Followers, Engagement Rate, Category, City, Score, Priority, Stage, Assigned Agent, Last Contact, and Registration Status. The table supports multi-column sorting, text search across all fields, and filter combinations (category + city + score range + stage + priority). Pagination is server-side with configurable page size. Each row is clickable, opening the Lead Profile page."
    )
  );

  content.push(heading2("7.3 Lead Profile Page"));
  content.push(
    bodyPara(
      "The Lead Profile Page provides a comprehensive 360-degree view of a single creator. The page is organized into sections: Creator Details (name, type, categories, city, languages, profile summary), Social Profiles (platform-by-platform metrics with links), Contact Information (all discovered contacts with confidence scores), Scoring Breakdown (visual breakdown of the 100-point score across all dimensions), AI Summary (LLM-generated profile summary), Outreach History (chronological list of all messages sent and received), Conversation Summary (current conversation status and last exchanges), Next Action (recommended next step and scheduled date), and Activity Timeline (all events related to this lead in chronological order)."
    )
  );

  content.push(heading2("7.4 Discovery Control Page"));
  content.push(
    bodyPara(
      "The Discovery Control Page allows administrators to manage the discovery process. It provides a form for creating new discovery batches (selecting platform, category, city, minimum followers, and target count), a list of active and completed batches with real-time progress indicators, controls to start, pause, and stop batches, market coverage visualization highlighting underrepresented segments, and agent task queue monitoring showing pending, running, and completed tasks. The page serves as the primary interface for strategic control of the acquisition engine."
    )
  );

  content.push(heading2("7.5 AI Agent Control Page"));
  content.push(
    bodyPara(
      "The AI Agent Control Page provides visibility and control over the agent system. It displays a real-time status dashboard for all seventeen agents, showing their current activity, queue depth, and recent task results. Administrators can view agent task logs, retry failed tasks, adjust agent configuration parameters (such as scoring weights and outreach timing), and temporarily enable or disable specific agents. The page also shows the LangGraph state graph visualization, making the workflow between agents visible and understandable."
    )
  );

  content.push(heading2("7.6 Outreach Approval Page"));
  content.push(
    bodyPara(
      "The Outreach Approval Page is the human approval gate in the outreach pipeline. It displays a queue of AI-generated messages waiting for approval. Each message card shows: the lead name and profile summary, the proposed message text with personalization highlighted, the target channel, the message type (first contact, follow-up, or reply), and compliance check results. The reviewer can approve the message as-is, edit the message text, reject the message (with a reason), copy the message for manual sending, mark the message as sent, or log a response received from the creator."
    )
  );

  content.push(heading2("7.7 Analytics Page"));
  content.push(
    bodyPara(
      "The Analytics Page provides comprehensive reporting on the acquisition pipeline. It includes: conversion funnel analysis (discovery to registration rates at each stage), category performance (which categories have the highest conversion rates), city performance (geographic conversion patterns), agent performance (which AI Sales Agents are most effective), outreach effectiveness (response rates by message type and channel), time-to-conversion analysis (how long it takes from first contact to registration), and trend analysis (performance over time with weekly and monthly views). All charts support date range filtering and data export."
    )
  );

  content.push(heading2("7.8 Settings Page"));
  content.push(
    bodyPara(
      "The Settings Page manages system configuration including: scoring weights (adjustable sliders for each of the seven scoring dimensions), discovery parameters (minimum followers, target counts per category), outreach timing (follow-up intervals, quiet hours), AI Sales Agent management (create, configure, enable/disable agents), team management (user roles and permissions), and API integration settings (Apify token, Firecrawl key, Supabase credentials). Changes to scoring weights trigger a recalculation of all existing lead scores."
    )
  );

  // ──── 8. DISCOVERY ENGINE ────
  content.push(heading1("8. Discovery Engine"));
  content.push(heading2("8.1 Design Philosophy"));
  content.push(
    bodyPara(
      "The Discovery Engine is designed as an autonomous acquisition engine, not a random scraper. The key principle is strategic discovery: the system decides what to search for based on market coverage gaps, not arbitrary keyword lists. The Discovery Director Agent acts as the strategic brain, continuously analyzing the database state and market signals to determine where to focus collection efforts. This ensures that every scraping job serves a specific business objective and contributes to filling identified gaps in the creator database."
    )
  );

  content.push(heading2("8.2 Discovery Director Decision Logic"));
  content.push(
    bodyPara(
      "The Discovery Director makes decisions based on a multi-factor analysis. First, it examines the current coverage map to identify underrepresented categories and cities. Second, it considers the target-to-actual ratio for each segment, prioritizing segments that are furthest below their targets. Third, it factors in the commercial value of each segment, weighting discovery toward higher-value categories. Fourth, it considers historical discovery success rates for each platform and category combination, avoiding strategies that have previously yielded low-quality results. Fifth, it respects platform-specific rate limits and daily collection quotas to maintain sustainable operations."
    )
  );

  content.push(heading2("8.3 Search Strategy Generation"));
  content.push(
    bodyPara(
      "The Search Strategy Agent generates platform-specific search plans. For Instagram, it creates Arabic and English hashtag lists, location-based searches, and seed account expansion chains. For TikTok, it generates hashtag searches, sound-based discovery (finding creators who use trending audio), and duet chain analysis (discovering creators who interact with known Saudi creators). For Google, it creates site-specific searches targeting creator directories, agency websites, and media mentions. The search strategy also includes temporal considerations, such as focusing on food creators during Ramadan when content activity peaks in Saudi Arabia."
    )
  );

  content.push(heading2("8.4 Collector Orchestration"));
  content.push(
    bodyPara(
      "The system orchestrates multiple collector types based on the requirements of each search batch. Apify collectors are used for fast MVP collection where pre-built actors exist. Crawlee collectors handle scalable, long-running jobs with sophisticated queue management. Playwright collectors are deployed for JavaScript-heavy pages that require browser rendering, such as TikTok profiles. Scrapling extractors parse the HTML after it has been loaded by a browser or fetched directly. Firecrawl and Crawl4AI handle the enrichment phase, following external links to extract additional data. The orchestration logic selects the appropriate collector for each job based on the platform, page type, and job scale."
    )
  );

  content.push(heading2("8.5 Anti-Detection and Rate Limiting"));
  content.push(
    bodyPara(
      "The discovery system implements multiple layers of anti-detection to maintain sustainable collection operations. These include: rotating proxy pools with residential proxies for each session, randomized request intervals with human-like timing patterns, session management with cookie persistence to avoid repeated login prompts, user-agent rotation to mimic different browsers and devices, and rate limiting that respects each platform's documented API limits and observed throttling behavior. The system also implements a 'cool-down' protocol when rate limits are detected, automatically pausing collection for the indicated period before retrying."
    )
  );

  // ──── 9. OUTREACH ENGINE ────
  content.push(heading1("9. Outreach Engine"));
  content.push(heading2("9.1 Message Generation"));
  content.push(
    bodyPara(
      "The Outreach Engine generates personalized messages using a template-plus-personalization approach. The AI Sales Outreach Agent selects the appropriate template based on the creator's language, category, and the message type (first contact, follow-up, or reply). It then fills personalization slots with the creator's name, platform, category, and city. The LLM further customizes the message by referencing specific aspects of the creator's content, such as their most popular recent post or a notable brand collaboration. All generated messages must pass a compliance check before being submitted for human approval."
    )
  );

  content.push(heading2("9.2 Personalization Strategy"));
  content.push(
    bodyPara(
      "Personalization goes beyond inserting the creator's name. The system personalizes at three levels: macro (category-specific messaging that references the creator's niche), meso (city-specific references that demonstrate local knowledge), and micro (individual content references that show genuine familiarity with the creator's work). For example, a food creator in Riyadh might receive a message that references popular Riyadh restaurant trends, while a fashion creator in Jeddah might receive a message that mentions Jeddah Fashion Week or local fashion events."
    )
  );

  content.push(heading2("9.3 Follow-up Logic"));
  content.push(
    bodyPara(
      "The Follow-up Agent implements a structured follow-up sequence with three touchpoints: first follow-up at 48 hours, second follow-up at 5 days, and final follow-up at 10 days. Each follow-up message is shorter than the previous one and takes a different angle. The first follow-up restates the value proposition, the second emphasizes the free nature of registration, and the third provides a final invitation. If no response is received after the third follow-up, the lead status is changed to 'no_response' and no further automated messages are sent. The system respects opt-out requests immediately and prevents any further outreach to leads that have explicitly declined."
    )
  );

  content.push(heading2("9.4 Conversation Memory"));
  content.push(
    bodyPara(
      "The Conversation Agent maintains a conversation memory that includes all previous messages, the creator's detected intent, sentiment, and the current conversation state. This memory enables the agent to generate contextually appropriate replies that reference previous exchanges. The conversation memory is stored in the conversations table and is accessible to both the AI Sales Outreach Agent and the Human Escalation Agent. This ensures that when a conversation is escalated to a human, the human has full context of the previous interaction."
    )
  );

  content.push(heading2("9.5 Escalation Logic"));
  content.push(
    bodyPara(
      "The escalation system is designed to protect both the Reesha brand and the creator relationship. Escalation triggers are categorized into three priority levels: critical (immediate escalation required - legal questions, contract requests, or negative sentiment that could damage the brand), high (escalation within 1 hour - payment questions, exclusivity questions, or high-value creators who need personal attention), and normal (escalation within 4 hours - registration issues, detailed platform questions, or requests for phone calls). The Human Escalation Agent routes each escalation to the appropriate human team member based on availability, language, and expertise."
    )
  );

  content.push(heading2("9.6 Communication Rules"));
  content.push(
    makeTable(
      ["Rule", "Description", "Enforcement"],
      [
        ["No guaranteed campaigns", "Never promise that a creator will receive campaign offers", "Compliance check on all messages"],
        ["No guaranteed income", "Never suggest specific earnings or income levels", "Compliance check on all messages"],
        ["Free registration", "Always mention that registration is free", "Required field in templates"],
        ["Professional tone", "Maintain formal, respectful communication", "LLM system prompt enforcement"],
        ["Language matching", "Use Arabic for Arabic-content creators, English for English", "Auto-detection from profile"],
        ["No spam", "Maximum 3 follow-ups, respect opt-out requests", "Hard limit in Follow-up Agent"],
        ["No sensitive data", "Do not collect or reference non-public personal data", "Data governance policy"],
        ["Official accounts only", "Use only official Reesha accounts for outreach", "Channel configuration"],
      ],
      [25, 45, 30]
    )
  );

  // ──── 10. IMPLEMENTATION ROADMAP ────
  content.push(heading1("10. Implementation Roadmap"));
  content.push(heading2("10.1 Phase 1: Foundation (Weeks 1-4)"));
  content.push(
    bodyPara(
      "Phase 1 establishes the foundational infrastructure upon which all subsequent phases build. The primary deliverables are the Supabase database schema with all tables, indexes, and RLS policies; the Next.js dashboard with authentication, layout, and navigation; the leads table page with filtering and sorting; the lead profile page with all sections; CSV import functionality for manual lead ingestion; manual lead creation forms; basic scoring implementation; and outreach message draft generation. The goal is to enable the team to manually and semi-automatically manage the first 1,000 leads."
    )
  );
  content.push(
    makeTable(
      ["Deliverable", "Technical Tasks", "Risk", "Success Metric"],
      [
        ["Supabase Schema", "Create all tables, indexes, RLS policies", "Schema migration complexity", "All tables created with constraints"],
        ["Dashboard UI", "Next.js setup, auth, layout, navigation", "Supabase Auth integration", "Users can login and navigate"],
        ["Leads Table", "Data table with filters, sort, pagination", "Performance with large datasets", "Loads 10K leads in <2s"],
        ["Lead Profile", "360-degree creator view page", "Data aggregation complexity", "All sections render correctly"],
        ["CSV Import", "Upload, parse, validate, insert", "Data quality from external sources", "Import 1000 rows without errors"],
        ["Basic Scoring", "Followers + engagement formula", "Score accuracy vs manual review", "80% alignment with manual scores"],
        ["Message Drafts", "Template-based draft generation", "Message quality and compliance", "100% pass compliance check"],
      ],
      [18, 30, 25, 27]
    )
  );

  content.push(heading2("10.2 Phase 2: Discovery MVP (Weeks 5-8)"));
  content.push(
    bodyPara(
      "Phase 2 builds the core discovery infrastructure. The deliverables are the Discovery Director Agent, the Search Strategy Agent, Apify collector integration, a basic Playwright collector, Supabase sync pipeline, and deduplication version 1. The Discovery Director creates search batches based on simple category and city coverage analysis. The Search Strategy Agent generates Arabic and English hashtags plus keyword combinations. The Apify collector uses pre-built actors for Instagram and TikTok. The Playwright collector handles browser-rendered pages. The goal is to collect 10,000 Saudi creator profiles."
    )
  );
  content.push(
    makeTable(
      ["Deliverable", "Technical Tasks", "Risk", "Success Metric"],
      [
        ["Discovery Director", "LangGraph node, coverage analysis, batch creation", "LLM output reliability", "Generates 10+ batches per day"],
        ["Search Strategy", "Hashtag expansion, keyword generation", "Arabic NLP accuracy", "50+ unique queries per batch"],
        ["Apify Integration", "Actor selection, result parsing, error handling", "Actor API changes, rate limits", "1000 profiles/day collected"],
        ["Playwright Collector", "Session mgmt, page rendering, extraction", "Platform anti-bot detection", "500 profiles/day collected"],
        ["Supabase Sync", "Batch insert, conflict resolution, status tracking", "Data integrity with high volume", "99.5% write success rate"],
        ["Deduplication v1", "Username + email matching", "False positive merges", "<5% false positive rate"],
      ],
      [18, 30, 25, 27]
    )
  );

  content.push(heading2("10.3 Phase 3: Enrichment and Scoring (Weeks 9-12)"));
  content.push(
    bodyPara(
      "Phase 3 builds the enrichment and scoring pipeline. The deliverables are Firecrawl enrichment integration, Crawl4AI enrichment integration, the Contact Discovery Agent, the Saudi Relevance Agent, the Category Classification Agent, and the Lead Scoring Agent version 2 with all seven scoring dimensions. The goal is to create a clean, qualified database with useful contact data and scoring, transforming the raw profiles collected in Phase 2 into actionable leads."
    )
  );
  content.push(
    makeTable(
      ["Deliverable", "Technical Tasks", "Risk", "Success Metric"],
      [
        ["Firecrawl Enrichment", "External link crawling, data extraction", "API rate limits, page changes", "Enrich 80% of profiles with bio links"],
        ["Crawl4AI Enrichment", "AI-assisted content extraction", "LLM cost per page", "Extract contacts from 60% of websites"],
        ["Contact Discovery", "Email/phone extraction, confidence scoring", "False contact data", "70% verified contact accuracy"],
        ["Saudi Relevance", "Dialect detection, location analysis", "Arabic NLP limitations", "90% accuracy on known Saudi creators"],
        ["Category Classification", "LLM-based multi-label classification", "Category ambiguity", "85% accuracy vs manual review"],
        ["Lead Scoring v2", "Full 100-point scoring framework", "Weight calibration", "75% correlation with manual assessment"],
      ],
      [18, 30, 25, 27]
    )
  );

  content.push(heading2("10.4 Phase 4: AI Sales System (Weeks 13-16)"));
  content.push(
    bodyPara(
      "Phase 4 builds the outreach and conversion system. The deliverables are the Lead Assignment Agent, the AI Sales Outreach Agent with bilingual message generation, the Follow-up Agent with scheduled sequences, the Conversation Agent with intent detection, the Human Escalation flow with dashboard integration, and the Outreach Approval screen with review and editing capabilities. The goal is to convert collected leads into registered Reesha creators through professional, compliant outreach."
    )
  );
  content.push(
    makeTable(
      ["Deliverable", "Technical Tasks", "Risk", "Success Metric"],
      [
        ["Lead Assignment", "Category + language + workload routing", "Workload imbalance", "<5% agent overload"],
        ["AI Sales Outreach", "Bilingual message generation, compliance checks", "Message quality variance", "90% human approval rate"],
        ["Follow-up Agent", "3-touch sequence scheduling", "Over-messaging creators", "Zero post-opt-out messages"],
        ["Conversation Agent", "Intent detection, reply suggestions", "Misinterpreting creator intent", "85% intent accuracy"],
        ["Human Escalation", "Priority routing, context transfer", "Escalation delays", "Critical escalations in <15 min"],
        ["Outreach Approval", "Review queue, edit/approve/reject UI", "Approval bottleneck", "<2 hour average review time"],
      ],
      [18, 30, 25, 27]
    )
  );

  content.push(heading2("10.5 Phase 5: Scale and Optimization (Weeks 17-20)"));
  content.push(
    bodyPara(
      "Phase 5 scales the system for high-volume operations and optimizes performance. The deliverables are Crawlee scalable collectors for long-running jobs, advanced queue system with priority routing and dead-letter handling, proxy and session management infrastructure, the Market Coverage Agent for automated gap analysis, the Match Probability Agent for predicting campaign fit, conversion analytics with daily reporting, and performance optimization across all agents. The goal is to scale toward 50,000+ Saudi creators with maintained data quality."
    )
  );
  content.push(
    makeTable(
      ["Deliverable", "Technical Tasks", "Risk", "Success Metric"],
      [
        ["Crawlee Collectors", "Custom crawlers, queue management, retries", "Anti-bot sophistication", "5000 profiles/day sustainable"],
        ["Advanced Queue", "Priority routing, DLQ, job chaining", "Queue congestion", "<1% task loss"],
        ["Proxy Management", "Residential proxy pool, rotation logic", "Proxy provider reliability", "99% session success"],
        ["Market Coverage", "Gap analysis, auto-discovery triggering", "Coverage target calibration", "90% of targets met"],
        ["Match Probability", "Brand-creator fit prediction model", "Model accuracy", "70% prediction accuracy"],
        ["Conversion Analytics", "Daily reports, funnel analysis, trends", "Data pipeline reliability", "99.9% uptime"],
      ],
      [18, 30, 25, 27]
    )
  );

  content.push(heading2("10.6 Phase 6: Advanced Automation (Weeks 21-24)"));
  content.push(
    bodyPara(
      "Phase 6 introduces advanced automation capabilities. When the WhatsApp Business API becomes available, the system will support WhatsApp templates, opt-in handling, WhatsApp follow-ups, conversation synchronization across channels, and automated creator onboarding flows. Additional advanced features include: creator similarity search using pgvector embeddings, automated lead re-scoring based on updated social metrics, predictive modeling for creator value trajectory, and integration with the Reesha public platform for seamless registration tracking. The goal is full automation of the acquisition pipeline with minimal human intervention for routine operations."
    )
  );

  // ──── 11. TECHNOLOGY STACK ────
  content.push(heading1("11. Technology Stack"));
  content.push(heading2("11.1 Stack Overview"));
  content.push(
    makeTable(
      ["Layer", "Technology", "Purpose", "Version"],
      [
        ["Frontend", "Next.js + TypeScript + Tailwind + shadcn/ui", "Internal dashboard", "Next.js 14+"],
        ["Database", "Supabase PostgreSQL + pgvector", "Persistent storage + similarity search", "PostgreSQL 15+"],
        ["Auth", "Supabase Auth", "Dashboard authentication", "Managed"],
        ["Backend", "FastAPI + Python", "API server + agent orchestration", "Python 3.11+"],
        ["Agents", "LangGraph", "Stateful agent workflows", "0.2+"],
        ["Jobs", "Redis + Celery", "Task queue and distribution", "Redis 7+, Celery 5+"],
        ["Scraping - MVP", "Apify", "Quick collection with pre-built actors", "API v2"],
        ["Scraping - Scale", "Crawlee + Playwright", "Custom scalable crawling", "Crawlee 3+"],
        ["Extraction", "Scrapling + Firecrawl", "HTML parsing + external link crawling", "Latest"],
        ["AI Extraction", "Crawl4AI", "LLM-assisted page conversion", "Latest"],
        ["Deployment - FE", "Vercel", "Dashboard hosting", "Managed"],
        ["Deployment - BE", "Railway / VPS", "API + workers hosting", "Docker"],
      ],
      [15, 35, 30, 20]
    )
  );

  content.push(heading2("11.2 LLM Provider Strategy"));
  content.push(
    bodyPara(
      "The system uses a multi-provider LLM strategy to balance cost, quality, and availability. For agent decision-making (Discovery Director, Search Strategy, Category Classification), the system uses GPT-4 or Claude for high-quality reasoning. For message generation (AI Sales Outreach, Conversation Agent), the system uses GPT-4 for nuanced bilingual output. For bulk classification and scoring tasks, the system uses GPT-3.5-turbo or similar fast models for cost efficiency. The LangGraph implementation supports easy switching between providers through a model registry pattern."
    )
  );

  // ──── 12. COMPLIANCE AND SAFETY ────
  content.push(heading1("12. Compliance and Safety"));
  content.push(
    bodyPara(
      "The system must operate within ethical and legal boundaries to protect both Reesha's reputation and the rights of the creators it contacts. The compliance framework covers five key areas: data collection (only collect publicly available data, respect robots.txt, avoid collecting non-public sensitive information), outreach (no spam behavior, human approval in MVP, maximum 3 follow-ups, respect opt-out requests immediately), messaging (never guarantee campaigns or income, always mention free registration, professional and transparent communication), data storage (only store relevant business acquisition data, respect data retention policies, implement proper access controls), and platform terms (comply with social platform terms of service, use official APIs where available, maintain sustainable scraping practices)."
    )
  );
  content.push(
    makeTable(
      ["Compliance Area", "Rule", "Enforcement Mechanism"],
      [
        ["Data Collection", "Only collect publicly available data", "Scraping configuration validation"],
        ["Data Collection", "Do not collect non-public sensitive information", "Extraction filter rules"],
        ["Outreach", "No spam: max 3 follow-ups per lead", "Hard limit in Follow-up Agent"],
        ["Outreach", "Respect opt-out requests immediately", "Auto-detection + blocklist"],
        ["Messaging", "Never guarantee campaigns or income", "Compliance check on all messages"],
        ["Messaging", "Always mention free registration", "Required field in templates"],
        ["Storage", "Only store relevant business data", "Schema design constraints"],
        ["Storage", "Implement data retention policies", "Scheduled cleanup jobs"],
        ["Platform Terms", "Respect robots.txt and rate limits", "Built-in rate limiter"],
        ["Platform Terms", "Use official Reesha accounts only", "Channel configuration"],
      ],
      [20, 40, 40]
    )
  );

  // ──── 13. API SPECIFICATION ────
  content.push(heading1("13. API Specification"));
  content.push(heading2("13.1 Dashboard API (Next.js API Routes)"));
  content.push(
    makeTable(
      ["Method", "Endpoint", "Description", "Auth Required"],
      [
        ["GET", "/api/leads", "List leads with filters and pagination", "Yes"],
        ["GET", "/api/leads/:id", "Get lead profile with all related data", "Yes"],
        ["POST", "/api/leads", "Create a new lead manually", "Yes"],
        ["PATCH", "/api/leads/:id", "Update lead data and status", "Yes"],
        ["POST", "/api/leads/:id/assign", "Assign lead to an AI Sales Agent", "Yes (Manager)"],
        ["POST", "/api/leads/:id/generate-message", "Trigger AI message generation", "Yes"],
        ["POST", "/api/leads/:id/mark-sent", "Mark outreach message as sent", "Yes"],
        ["POST", "/api/leads/:id/log-response", "Log a creator response", "Yes"],
        ["GET", "/api/analytics/overview", "Get overview dashboard metrics", "Yes"],
        ["GET", "/api/analytics/conversion", "Get conversion funnel data", "Yes"],
        ["POST", "/api/import/csv", "Upload and process CSV import", "Yes (Admin)"],
      ],
      [10, 35, 35, 20]
    )
  );

  content.push(heading2("13.2 Agents API (FastAPI)"));
  content.push(
    makeTable(
      ["Method", "Endpoint", "Description", "Queue Priority"],
      [
        ["POST", "/agents/discovery/start", "Start a discovery batch", "Normal"],
        ["POST", "/agents/discovery/stop", "Stop a running batch", "High"],
        ["POST", "/agents/profile/enrich", "Enrich a specific profile", "Normal"],
        ["POST", "/agents/profile/score", "Score a specific profile", "Normal"],
        ["POST", "/agents/outreach/generate", "Generate outreach message", "High"],
        ["POST", "/agents/conversation/reply", "Get AI reply suggestion", "High"],
        ["POST", "/agents/follow-up/schedule", "Schedule follow-up sequence", "Normal"],
        ["GET", "/agents/tasks", "List agent tasks with status", "N/A"],
        ["POST", "/agents/tasks/:id/retry", "Retry a failed task", "Same as original"],
      ],
      [10, 35, 35, 20]
    )
  );

  // ──── 14. REPOSITORY STRUCTURE ────
  content.push(heading1("14. Repository Structure"));
  content.push(...codeBlock([
    'reesha-ai-agents/',
    '|',
    '+-- apps/',
    '|   +-- dashboard/',
    '|   |   +-- app/',
    '|   |   |   +-- overview/page.tsx',
    '|   |   |   +-- leads/page.tsx',
    '|   |   |   +-- leads/[id]/page.tsx',
    '|   |   |   +-- discovery/page.tsx',
    '|   |   |   +-- agents/page.tsx',
    '|   |   |   +-- outreach/page.tsx',
    '|   |   |   +-- analytics/page.tsx',
    '|   |   |   +-- settings/page.tsx',
    '|   |   +-- components/',
    '|   |   +-- lib/',
    '|   |   +-- package.json',
    '|   |',
    '|   +-- agents-api/',
    '|       +-- app/',
    '|       |   +-- main.py',
    '|       |   +-- routers/',
    '|       +-- agents/',
    '|       |   +-- discovery_director.py',
    '|       |   +-- search_strategy.py',
    '|       |   +-- collectors/',
    '|       |   +-- enrichment.py',
    '|       |   +-- scoring.py',
    '|       |   +-- outreach.py',
    '|       +-- crawlers/',
    '|       +-- services/',
    '|       +-- workers/',
    '|       +-- prompts/',
    '|       +-- requirements.txt',
    '|',
    '+-- packages/',
    '|   +-- database/',
    '|   +-- shared-types/',
    '|   +-- prompts/',
    '|',
    '+-- supabase/',
    '|   +-- migrations/',
    '|   +-- seed.sql',
    '|',
    '+-- docs/',
    '+-- docker-compose.yml',
    '+-- README.md',
  ]));

  // ──── 15. ENVIRONMENT VARIABLES ────
  content.push(heading1("15. Environment Configuration"));
  content.push(...codeBlock([
    '# Supabase',
    'SUPABASE_URL=',
    'SUPABASE_SERVICE_ROLE_KEY=',
    'SUPABASE_ANON_KEY=',
    '',
    '# LLM Providers',
    'OPENAI_API_KEY=',
    'ANTHROPIC_API_KEY=',
    'GEMINI_API_KEY=',
    '',
    '# Queue and Cache',
    'REDIS_URL=',
    'DATABASE_URL=',
    '',
    '# Scraping Services',
    'APIFY_TOKEN=',
    'FIRECRAWL_API_KEY=',
    '',
    '# Crawler Configuration',
    'CRAWLER_PROXY_URL=',
    'CRAWLER_USER_AGENT=',
    'CRAWLER_MAX_CONCURRENT=5',
    'CRAWLER_REQUEST_DELAY_MIN=2',
    'CRAWLER_REQUEST_DELAY_MAX=5',
    '',
    '# Reesha Platform',
    'REESHA_SIGNUP_URL=',
    'REESHA_WEBHOOK_SECRET=',
    '',
    '# Dashboard',
    'NEXT_PUBLIC_SUPABASE_URL=',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=',
  ]));

  return content;
}

// ═══════════════════════════════════════════════════════════════
// BUILD DOCUMENT
// ═══════════════════════════════════════════════════════════════
async function main() {
  const pgSize = { width: 11906, height: 16838 };
  const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

  // Build body content first
  const bodyChildren = buildBodyContent();

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
            size: 24,
            color: "000000",
          },
          paragraph: {
            spacing: { line: 312 },
          },
        },
        heading1: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "SimHei" },
            size: 32,
            bold: true,
            color: P.primary,
          },
          paragraph: {
            spacing: { before: 480, after: 200, line: 312 },
          },
        },
        heading2: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "SimHei" },
            size: 28,
            bold: true,
            color: P.primary,
          },
          paragraph: {
            spacing: { before: 360, after: 160, line: 312 },
          },
        },
        heading3: {
          run: {
            font: { ascii: "Times New Roman", eastAsia: "SimHei" },
            size: 24,
            bold: true,
            color: P.primary,
          },
          paragraph: {
            spacing: { before: 240, after: 120, line: 312 },
          },
        },
      },
    },
    numbering: {
      config: [],
    },
    sections: [
      // Section 1: Cover
      {
        properties: {
          page: {
            size: pgSize,
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
        children: buildCover(),
      },
      // Section 2: Front matter (TOC) — Roman numerals
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 360 },
            children: [
              new TextRun({
                text: "Table of Contents",
                bold: true,
                size: 32,
                font: { ascii: "Times New Roman", eastAsia: "SimHei" },
              }),
            ],
          }),
          new TableOfContents("Table of Contents", {
            hyperlink: true,
            headingStyleRange: "1-3",
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: 'Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select "Update Field."',
                italics: true,
                size: 18,
                color: "888888",
              }),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // Section 3: Body — Arabic numerals
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: pgSize,
            margin: pgMargin,
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Reesha - AI-Powered Creator Acquisition Operating System",
                    size: 18,
                    color: "808080",
                    font: { ascii: "Times New Roman", eastAsia: "Microsoft YaHei" },
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" }),
                ],
              }),
            ],
          }),
        },
        children: bodyChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("/home/z/my-project/download/Reesha_Technical_Specification.docx", buffer);
  console.log("Document generated successfully!");
}

main().catch(console.error);

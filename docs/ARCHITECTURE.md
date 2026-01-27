# FTTG News Tool - Master Architecture Document v2.0

## PROJECT OVERVIEW

**Product Name**: FTTG Content Intelligence Platform
**Purpose**: AI-powered content calendar and planning tool for media companies with story angle discovery and script generation
**Business Model**: License-based (main accounts) + Seat-based (client users) - Monetization layer to be added later
**Tech Stack**: React + TypeScript + Node.js + PostgreSQL + Vercel
**Repository**: GitHub (to be initialized)
**Deployment**: Vercel (Frontend + Backend)

---

## PRODUCT VISION

A **content planning platform** where:
- **FTTG** creates projects and manages editorial calendars
- **Clients** are invited to collaborate on content planning
- **AI frameworks** generate story angles and scripts
- **Approval workflows** ensure quality control
- **Calendar view** provides year-long visibility of content strategy

Think: **Monday.com for video content** + **AI-powered storytelling** + **Multi-tenant SaaS**

---

## CORE FEATURES

### 1. Project-Based Content Planning
- **Projects** = Editorial calendars owned by FTTG or licensed clients
- Set posting frequency (daily, weekly, 2x/week, etc.)
- Set video quotas (52 videos/year, 104 videos/year, etc.)
- Calendar dashboard with drag-drop scheduling
- Multi-project support (e.g., "Mediacorp Q1 2025", "Straits Times Weekly")

### 2. Collaborative Workflow
- **Project Owner** (FTTG): Creates projects, invites members, full control
- **Invited Members** (Client users): Can plan stories, request angles, approve scripts
- **Permissions**: Owner, Editor, Viewer roles
- **Approval States**: Draft → Pending Review → Approved → Scheduled → Published

### 3. News Aggregation Engine
- Real-time RSS scraping across regions (Asia, SEA, East Asia, APAC, Global)
- Social listening (X, TikTok, Instagram, Reddit, Google Trends)
- Categorization system with trending detection
- Feeds into project planning (suggest stories based on trending topics)

### 4. AI Story Frameworks (Core IP)
Multiple storytelling frameworks for different content types:

**Framework 1: FTTG Investigative**
- Contrarian, emotionally-driven angles
- Expose disconnects between official narratives and reality
- Use: Breaking news, policy analysis, investigative pieces

**Framework 2: Educational Deep-Dive (John Oliver-style)**
- Comprehensive topic breakdowns
- Humor + education + systemic analysis
- Use: Explainer videos, complex issues, weekly commentary

**Framework 3: (Future) Social-First Viral**
- Hook-driven, shareable angles
- Use: Short-form content, trending reactions

### 5. Script Generator (Team-Only Feature)
- Duration selection: 1.5min, 3.5min, 7min, 12min, custom
- Format types: Broadcast (short/long), Podcast, Educational, Social Media
- Framework selection: FTTG Investigative, Educational Deep-Dive, etc.
- Tonality training: Framework baselines + custom script uploads
- Editable output with PDF/DOC export

### 6. User & License Management (Future Monetization)
- **Main Account License**: FTTG or licensed media companies
- **Seat Licenses**: Individual users within organizations
- Usage tracking per project
- Billing (to be implemented later)

---

## SYSTEM ARCHITECTURE
```
┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (Vercel)                        │
│          React + TypeScript + Tailwind CSS               │
│                                                          │
│  Routes:                                                 │
│  /login                  - Authentication                │
│  /projects               - List of all projects          │
│  /project/:id/calendar   - Calendar dashboard            │
│  /project/:id/library    - News library + trending       │
│  /project/:id/planned    - Planned stories list          │
│  /story/:id/angles       - Angle explorer                │
│  /story/:id/script       - Script generator (team only)  │
│  /settings               - User/project settings         │
│  /admin                  - Admin: licenses, billing      │
└─────────────────────────────────────────────────────────┘
                          ↓ API Calls
┌─────────────────────────────────────────────────────────┐
│              BACKEND API (Vercel Serverless)             │
│              Node.js + Express + TypeScript              │
│                                                          │
│  /api/auth/*            - Authentication                 │
│  /api/projects/*        - Project CRUD, invitations      │
│  /api/calendar/*        - Calendar items, scheduling     │
│  /api/news/*            - News feed, search, trending    │
│  /api/angles/*          - Angle generation               │
│  /api/scripts/*         - Script generation (team only)  │
│  /api/approvals/*       - Approval workflows             │
│  /api/settings/*        - User/project preferences       │
│  /api/admin/*           - Licenses, billing (future)     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   SERVICES LAYER                         │
│                                                          │
│  News Scraper Service:                                   │
│  - RSS scrapers (15min cron)                             │
│  - Social listening (5min cron)                          │
│  - Categorization & trending detection                   │
│  - Story suggestions for projects                        │
│                                                          │
│  AI Service:                                             │
│  - Multiple storytelling frameworks                      │
│  - Claude API for angle generation                       │
│  - Claude API for script writing                         │
│  - GPT-4o-mini for evidence search                       │
│  - Framework pattern analyzer                            │
│                                                          │
│  Calendar Service:                                       │
│  - Scheduling logic                                      │
│  - Frequency calculator (weekly, bi-weekly, etc.)        │
│  - Quota tracking                                        │
│                                                          │
│  Collaboration Service:                                  │
│  - Invitation system                                     │
│  - Approval workflows                                    │
│  - Activity logs                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              DATABASE (Supabase PostgreSQL)              │
│                                                          │
│  Tables:                                                 │
│  - organizations, users, licenses (future)               │
│  - projects, project_members, calendar_items             │
│  - storytelling_frameworks, news_stories                 │
│  - story_angles, scripts, approvals                      │
│  - audience_profiles, usage_logs                         │
└─────────────────────────────────────────────────────────┘
```

---

## DATABASE SCHEMA

### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('fttg_internal', 'licensed_client', 'trial')) NOT NULL,
  license_type VARCHAR(50) CHECK (license_type IN ('main_account', 'sub_account')) DEFAULT 'main_account',
  seat_limit INT DEFAULT 5, -- For future licensing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_fttg_team BOOLEAN DEFAULT FALSE, -- FTTG team members have special privileges
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(org_id);
```

### Projects Table (Core Entity)
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Content Planning Settings
  posting_frequency VARCHAR(50) CHECK (posting_frequency IN ('daily', 'weekly', 'bi-weekly', 'monthly', 'custom')) DEFAULT 'weekly',
  custom_frequency_days INT, -- For custom frequency (e.g., every 3 days)
  video_quota_per_year INT, -- Total videos planned for the year
  start_date DATE NOT NULL,
  end_date DATE,

  -- Project Status
  status VARCHAR(50) CHECK (status IN ('active', 'archived', 'paused')) DEFAULT 'active',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(owner_org_id);
CREATE INDEX idx_projects_status ON projects(status);
```

### Project Members Table (Collaboration)
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) CHECK (role IN ('owner', 'editor', 'viewer')) NOT NULL,

  -- Permissions
  can_create_stories BOOLEAN DEFAULT TRUE,
  can_approve_stories BOOLEAN DEFAULT FALSE,
  can_generate_scripts BOOLEAN DEFAULT FALSE,
  can_invite_members BOOLEAN DEFAULT FALSE,

  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### Calendar Items Table (Planned Stories)
```sql
CREATE TABLE calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  news_story_id UUID REFERENCES news_stories(id) ON DELETE SET NULL,

  -- Calendar Details
  title VARCHAR(500) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_seconds INT, -- Expected video duration

  -- Planning Status
  status VARCHAR(50) CHECK (status IN ('draft', 'pending_review', 'approved', 'in_production', 'published', 'cancelled')) DEFAULT 'draft',

  -- Associated Content
  selected_angle_id UUID REFERENCES story_angles(id) ON DELETE SET NULL,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,

  -- Metadata
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,

  notes TEXT, -- Editorial notes

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_project_date ON calendar_items(project_id, scheduled_date DESC);
CREATE INDEX idx_calendar_status ON calendar_items(status);
```

### Storytelling Frameworks Table
```sql
CREATE TABLE storytelling_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) CHECK (type IN ('fttg_investigative', 'educational_deepdive', 'social_viral', 'custom')) NOT NULL,
  description TEXT,

  -- Framework Structure (JSON schema)
  framework_steps JSONB NOT NULL,
  -- Example for FTTG Investigative:
  -- [
  --   {"step": "contrarian_headline", "instruction": "Challenge the mainstream narrative"},
  --   {"step": "narrative_extraction", "instruction": "What's being publicly stated?"},
  --   ...
  -- ]

  -- AI Prompt Template
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,

  -- Settings
  is_active BOOLEAN DEFAULT TRUE,
  is_team_only BOOLEAN DEFAULT FALSE, -- Some frameworks only for FTTG team

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_frameworks_type ON storytelling_frameworks(type);
```

### Audience Profiles Table
```sql
CREATE TABLE audience_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,

  -- Demographics
  age_range VARCHAR(50),
  location VARCHAR(100),
  education_level VARCHAR(100),

  -- Psychographics (JSONB arrays)
  values JSONB DEFAULT '[]',
  fears JSONB DEFAULT '[]',
  aspirations JSONB DEFAULT '[]',

  -- Content Preferences
  preferred_tone VARCHAR(50) CHECK (preferred_tone IN ('investigative', 'educational', 'balanced', 'provocative', 'conversational')),
  depth_preference VARCHAR(50) CHECK (depth_preference IN ('surface', 'medium', 'deep_dive')),
  political_sensitivity INT CHECK (political_sensitivity BETWEEN 1 AND 10),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audience_project ON audience_profiles(project_id);
```

### News Stories Table
```sql
CREATE TABLE news_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  source VARCHAR(255) NOT NULL,
  url TEXT,

  -- Categorization
  region VARCHAR(50) CHECK (region IN ('asia', 'southeast_asia', 'east_asia', 'apac', 'global')),
  category VARCHAR(100) NOT NULL,
  is_trending BOOLEAN DEFAULT FALSE,

  -- Social signals
  social_platforms JSONB DEFAULT '[]',
  trend_score INT DEFAULT 0,

  published_at TIMESTAMP,
  scraped_at TIMESTAMP DEFAULT NOW(),

  -- Full text search
  search_vector TSVECTOR
);

CREATE INDEX idx_news_region_category ON news_stories(region, category);
CREATE INDEX idx_news_trending ON news_stories(is_trending DESC, trend_score DESC);
CREATE INDEX idx_news_published ON news_stories(published_at DESC);
CREATE INDEX idx_news_search ON news_stories USING GIN(search_vector);

CREATE TRIGGER news_search_vector_update
BEFORE INSERT OR UPDATE ON news_stories
FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(search_vector, 'pg_catalog.english', title, content, summary);
```

### Story Angles Table
```sql
CREATE TABLE story_angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_story_id UUID REFERENCES news_stories(id) ON DELETE CASCADE,
  framework_id UUID REFERENCES storytelling_frameworks(id) ON DELETE SET NULL,
  audience_profile_id UUID REFERENCES audience_profiles(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Angle Content (structure varies by framework)
  angle_data JSONB NOT NULL,
  -- Example for FTTG Investigative:
  -- {
  --   "contrarian_headline": "...",
  --   "narrative_extraction": "...",
  --   "contradiction_points": [...],
  --   "comparison_framework": {...},
  --   "emotional_core": "...",
  --   "authority_challenge": "...",
  --   "conclusion": "..."
  -- }

  -- Why should audiences care?
  audience_care_statement TEXT NOT NULL,

  -- Supporting Evidence
  related_stories JSONB DEFAULT '[]',
  comparison_regions JSONB DEFAULT '[]',

  status VARCHAR(50) CHECK (status IN ('draft', 'approved', 'archived')) DEFAULT 'draft',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_angles_story ON story_angles(news_story_id);
CREATE INDEX idx_angles_project ON story_angles(project_id);
CREATE INDEX idx_angles_framework ON story_angles(framework_id);
```

### Scripts Table
```sql
CREATE TABLE scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_angle_id UUID REFERENCES story_angles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Script Parameters
  duration_seconds INT NOT NULL,
  format VARCHAR(50) CHECK (format IN ('broadcast_short', 'broadcast_long', 'podcast', 'educational', 'social_media')) NOT NULL,
  framework_id UUID REFERENCES storytelling_frameworks(id) ON DELETE SET NULL,

  -- Generated Content
  script_content TEXT NOT NULL,
  word_count INT,

  -- Visual/Production Notes (JSONB)
  production_notes JSONB DEFAULT '{}',
  -- Example:
  -- {
  --   "visual_suggestions": ["B-roll of factory", "Infographic on prices"],
  --   "tone_cues": ["Deliver with irony", "Pause for effect"],
  --   "timestamps": [...]
  -- }

  -- Metadata
  version INT DEFAULT 1,
  is_exported BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scripts_angle ON scripts(story_angle_id);
CREATE INDEX idx_scripts_project ON scripts(project_id);
```

### Approvals Table (Workflow Tracking)
```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id UUID REFERENCES calendar_items(id) ON DELETE CASCADE,

  -- Approval Details
  approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')) NOT NULL,
  comments TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approvals_calendar_item ON approvals(calendar_item_id);
```

### Usage Logs Table
```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_user_date ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_project_date ON usage_logs(project_id, created_at DESC);
```

---

## STORYTELLING FRAMEWORKS SPECIFICATION

### Framework 1: FTTG Investigative

**Purpose**: Contrarian, emotionally-driven investigative storytelling
**Best For**: Breaking news, policy analysis, exposing disconnects
**Tone**: Provocative, insider perspective, authority-challenging

**Framework Structure** (7 Steps):
```json
{
  "name": "FTTG Investigative",
  "type": "fttg_investigative",
  "steps": [
    {
      "step": "contrarian_headline",
      "instruction": "Create a headline that challenges the mainstream narrative. Use definitive language. Create cognitive dissonance.",
      "output_format": "Single impactful headline (5-10 words)"
    },
    {
      "step": "narrative_extraction",
      "instruction": "Identify the official narrative: What's being publicly stated? Who's promoting it? What are the stated goals/benefits?",
      "output_format": "2-3 sentence summary of the official position"
    },
    {
      "step": "contradiction_finder",
      "instruction": "Find data that challenges the narrative. Look for: implementation failures, delays, budget overruns, quotes from affected parties, statistical evidence contradicting claims.",
      "output_format": "List of 3-5 specific contradictions with sources"
    },
    {
      "step": "comparison_framework",
      "instruction": "Find how other countries/organizations handled similar situations. Highlight approach differences and outcomes.",
      "output_format": "Comparison between subject and 1-2 contrasting examples"
    },
    {
      "step": "emotional_core",
      "instruction": "Identify who's being affected (common people, small businesses). What's the hidden cost? Use specific numbers, prices, personal impacts.",
      "output_format": "Emotional hook with concrete examples"
    },
    {
      "step": "authority_challenge",
      "instruction": "Question the real motive. Expose misalignment between stated goals and actual priorities. Use insider knowledge or direct quotes if available.",
      "output_format": "Critical analysis of underlying motives"
    },
    {
      "step": "conclusion",
      "instruction": "Reframe the 'why'. Expose the betrayal or disconnect. Make it memorable and punchy.",
      "output_format": "Single powerful concluding statement"
    }
  ]
}
```

**AI Prompt Template**:
```typescript
export const FTTG_INVESTIGATIVE_SYSTEM_PROMPT = `
You are an investigative journalist AI trained in FTTG's contrarian storytelling framework.

Your approach:
- Challenge mainstream narratives with evidence
- Expose disconnects between stated goals and reality
- Use specific data (prices, percentages, quotes) over generalities
- Show don't tell: Paint scenes, use concrete examples
- Question authority's true motives

Generate angles that make audiences think: "Wait, that's not what I was told."

Output Structure: Follow the 7-step FTTG Investigative framework precisely.
`;

export function buildFTTGInvestigativePrompt(params: {
  newsStory: NewsStory;
  audienceProfile: AudienceProfile;
  comparisonRegions: string[];
}) {
  return `
STORY TO ANALYZE:
Title: ${params.newsStory.title}
Content: ${params.newsStory.content}
Source: ${params.newsStory.source}
Published: ${params.newsStory.published_at}

AUDIENCE CONTEXT:
Demographics: ${params.audienceProfile.age_range}, ${params.audienceProfile.location}
Values: ${JSON.stringify(params.audienceProfile.values)}
Fears: ${JSON.stringify(params.audienceProfile.fears)}
Aspirations: ${JSON.stringify(params.audienceProfile.aspirations)}

COMPARISON SCOPE: ${params.comparisonRegions.join(', ')}

TASK: Generate 3 distinct investigative angles using the 7-step framework.

For each angle:
1. contrarian_headline: Challenge the mainstream narrative (5-10 words)
2. narrative_extraction: Official story (2-3 sentences)
3. contradiction_finder: 3-5 contradictions with specific data/sources
4. comparison_framework: How 1-2 other regions handled this differently
5. emotional_core: Who's affected? Use specific numbers/prices/quotes
6. authority_challenge: Question the real motive
7. conclusion: Punchy reframe of the "why"

Also include:
- audience_care_statement: Why should THIS audience care? (connect to their fears/aspirations)
- supporting_evidence: List of source IDs/URLs for further research

Return JSON array of 3 angles.
`;
}
```

---

### Framework 2: Educational Deep-Dive (John Oliver-Style)

**Purpose**: Comprehensive topic education with humor and systemic analysis
**Best For**: Explainer videos, complex issues, weekly commentary
**Tone**: Educational, humorous, empathetic, systemic

**John Oliver Last Week Tonight Analysis**:

Key Elements:
1. **Timely Hook** - Current event that makes topic relevant NOW
2. **Accessibility** - "Here's what you need to know" even if you know nothing
3. **Progressive Complexity** - Start simple, build to systemic issues
4. **Humor as Retention Tool** - Absurdity, irony, pop culture refs
5. **Evidence Layering** - News clips, data visualizations, expert quotes
6. **Human Impact** - Real people affected by the issue
7. **Systemic Analysis** - Why does this keep happening?
8. **Visual Support** - Graphics, clips, reenactments
9. **Call to Action** - What needs to change

**Framework Structure** (8 Steps):
```json
{
  "name": "Educational Deep-Dive",
  "type": "educational_deepdive",
  "steps": [
    {
      "step": "timely_hook",
      "instruction": "Connect topic to current event. Why should we talk about this NOW? Use humor if appropriate.",
      "output_format": "Opening hook (2-3 sentences) with relevance anchor"
    },
    {
      "step": "context_setup",
      "instruction": "Explain the basics: What is this issue? Who's involved? Assume audience knows nothing. Be clear and simple.",
      "output_format": "Plain-language explanation (3-5 sentences)"
    },
    {
      "step": "problem_breakdown",
      "instruction": "Identify the core problem. Break complex issue into digestible parts. Use numbered lists or categories.",
      "output_format": "3-5 key problems or aspects, clearly delineated"
    },
    {
      "step": "evidence_layering",
      "instruction": "Build the case with evidence: statistics, expert quotes, news clips, historical data. Layer from recent to historical. Include absurdities or contradictions.",
      "output_format": "5-10 evidence points with sources, organized chronologically or thematically"
    },
    {
      "step": "human_impact",
      "instruction": "Show real people affected. Use specific stories, testimonials, or scenarios that humanize the issue.",
      "output_format": "2-3 human impact examples with details"
    },
    {
      "step": "systemic_analysis",
      "instruction": "Zoom out: Why does this keep happening? What systems, incentives, or structures enable this? Connect dots between evidence points.",
      "output_format": "Systemic explanation (3-5 sentences) identifying root causes"
    },
    {
      "step": "visual_suggestions",
      "instruction": "Suggest visuals that would aid understanding: graphics, charts, clips, reenactments. Think about how to make abstract concepts concrete.",
      "output_format": "List of 5-10 visual aids with descriptions"
    },
    {
      "step": "call_to_action",
      "instruction": "What needs to change? Who needs to do what? Be specific about solutions or reforms needed.",
      "output_format": "Clear call to action (2-3 specific recommendations)"
    }
  ]
}
```

**AI Prompt Template**:
```typescript
export const EDUCATIONAL_DEEPDIVE_SYSTEM_PROMPT = `
You are an educational content AI trained in John Oliver's Last Week Tonight style of explanatory journalism.

Your approach:
- Make complex topics accessible without dumbing them down
- Use humor to maintain engagement (absurdity, irony, relatable analogies)
- Build from simple to complex progressively
- Layer evidence systematically (data, clips, expert voices)
- Show human impact with specific stories
- Identify systemic causes, not just symptoms
- Suggest visual aids that clarify concepts
- End with actionable takeaways

Your tone: Conversational, witty, empathetic, educational
Your goal: Audiences leave understanding WHY this matters and WHAT should change

Output Structure: Follow the 8-step Educational Deep-Dive framework precisely.
`;

export function buildEducationalDeepDivePrompt(params: {
  newsStory: NewsStory;
  audienceProfile: AudienceProfile;
  relatedStories: NewsStory[];
}) {
  return `
TOPIC TO EXPLAIN:
Title: ${params.newsStory.title}
Content: ${params.newsStory.content}
Source: ${params.newsStory.source}

RELATED CONTEXT:
${params.relatedStories.map(s => `- ${s.title} (${s.source})`).join('\n')}

AUDIENCE CONTEXT:
Education level: ${params.audienceProfile.education_level}
Values: ${JSON.stringify(params.audienceProfile.values)}
Depth preference: ${params.audienceProfile.depth_preference}

TASK: Create an educational deep-dive using the 8-step framework.

Generate 2-3 angle options, each following:
1. timely_hook: Why talk about this NOW? (2-3 sentences, use humor)
2. context_setup: Explain basics assuming zero knowledge (3-5 sentences)
3. problem_breakdown: What are the 3-5 key issues?
4. evidence_layering: 5-10 evidence points (stats, quotes, clips) with sources
5. human_impact: 2-3 real-world impact examples
6. systemic_analysis: WHY does this keep happening? (root causes)
7. visual_suggestions: 5-10 visual aids (charts, clips, graphics) that would help
8. call_to_action: What needs to change? (2-3 specific recommendations)

Also include:
- audience_care_statement: Why should THIS audience care?
- humor_opportunities: 3-5 moments where humor could enhance retention
- estimated_duration: How long would this take to explain thoroughly?

Return JSON array of 2-3 educational angles.
`;
}
```

**John Oliver Structural Example** (for AI reference):
```
Topic: [Complex Issue]

[TIMELY HOOK - 30s]
Current event that makes topic relevant now, with humor.

[CONTEXT SETUP - 1min]
Plain-language basics assuming zero knowledge.

[PROBLEM BREAKDOWN - 2min]
3-5 key problems, taken one by one.

[EVIDENCE LAYERING - 5min]
Clips, graphs, expert quotes, absurdities.

[HUMAN IMPACT - 2min]
Real people affected, specific stories.

[SYSTEMIC ANALYSIS - 3min]
Why this keeps happening, root causes, perverse incentives.

[VISUAL AIDS]
Graphics, flowcharts, clips that clarify.

[CALL TO ACTION - 1min]
Specific recommendations for change.
```

---

## PROJECT FILE STRUCTURE
```
fttg-news-tool/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── projects/
│   │   │   │   ├── ProjectList.tsx
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── CreateProjectModal.tsx
│   │   │   │   └── ProjectSettings.tsx
│   │   │   ├── calendar/
│   │   │   │   ├── CalendarView.tsx          # Main calendar dashboard
│   │   │   │   ├── CalendarGrid.tsx          # Grid layout
│   │   │   │   ├── CalendarItem.tsx          # Individual story item
│   │   │   │   ├── DragDropProvider.tsx      # Drag & drop logic
│   │   │   │   ├── FrequencySettings.tsx     # Set posting frequency
│   │   │   │   └── QuotaTracker.tsx          # Show quota usage
│   │   │   ├── collaboration/
│   │   │   │   ├── InviteMemberModal.tsx
│   │   │   │   ├── MembersList.tsx
│   │   │   │   ├── PermissionsEditor.tsx
│   │   │   │   └── ApprovalWorkflow.tsx
│   │   │   ├── news-library/
│   │   │   │   ├── NewsLibrary.tsx           # News feed for project
│   │   │   │   ├── StoryCard.tsx
│   │   │   │   ├── TrendingSection.tsx
│   │   │   │   ├── CategoryFilter.tsx
│   │   │   │   └── AddToCalendarButton.tsx
│   │   │   ├── angle-explorer/
│   │   │   │   ├── AngleGenerator.tsx
│   │   │   │   ├── FrameworkSelector.tsx     # Choose FTTG/Educational/etc
│   │   │   │   ├── AngleCard.tsx
│   │   │   │   ├── EvidencePanel.tsx
│   │   │   │   ├── AudienceCareEditor.tsx
│   │   │   │   └── ComparisonScopeSelector.tsx
│   │   │   ├── script-generator/
│   │   │   │   ├── ScriptGenerator.tsx
│   │   │   │   ├── DurationSelector.tsx
│   │   │   │   ├── FormatSelector.tsx
│   │   │   │   ├── FrameworkSelector.tsx
│   │   │   │   ├── ScriptEditor.tsx
│   │   │   │   ├── ProductionNotes.tsx       # Visual suggestions, tone cues
│   │   │   │   └── ExportButton.tsx
│   │   │   ├── settings/
│   │   │   │   ├── AudienceProfiles.tsx
│   │   │   │   ├── ProfileForm.tsx
│   │   │   │   └── UserPreferences.tsx
│   │   │   ├── admin/
│   │   │   │   ├── LicenseManagement.tsx     # Future: Manage licenses
│   │   │   │   ├── UsageAnalytics.tsx
│   │   │   │   └── BillingSettings.tsx       # Future: Billing
│   │   │   └── shared/
│   │   │       ├── Layout.tsx
│   │   │       ├── Navbar.tsx
│   │   │       ├── Sidebar.tsx
│   │   │       ├── Button.tsx
│   │   │       ├── Input.tsx
│   │   │       ├── Select.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── Calendar.tsx              # Reusable calendar component
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useProjects.ts
│   │   │   ├── useCalendar.ts
│   │   │   ├── useNewsFeed.ts
│   │   │   ├── useAngleGenerator.ts
│   │   │   ├── useScriptGenerator.ts
│   │   │   └── useCollaboration.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── project.service.ts
│   │   │   ├── calendar.service.ts
│   │   │   ├── news.service.ts
│   │   │   ├── angle.service.ts
│   │   │   └── script.service.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── calendar-helpers.ts
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ProjectContext.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
├── backend/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── register.ts
│   │   │   └── logout.ts
│   │   ├── projects/
│   │   │   ├── create.ts
│   │   │   ├── list.ts
│   │   │   ├── [id].ts
│   │   │   ├── invite.ts
│   │   │   └── members.ts
│   │   ├── calendar/
│   │   │   ├── items.ts                      # CRUD for calendar items
│   │   │   ├── schedule.ts                   # Auto-schedule based on frequency
│   │   │   └── quota.ts                      # Get quota usage
│   │   ├── news/
│   │   │   ├── feed.ts
│   │   │   ├── trending.ts
│   │   │   ├── search.ts
│   │   │   ├── suggest.ts                    # Suggest stories for project
│   │   │   └── [id].ts
│   │   ├── angles/
│   │   │   ├── generate.ts
│   │   │   ├── save.ts
│   │   │   ├── list.ts
│   │   │   └── [id].ts
│   │   ├── scripts/
│   │   │   ├── generate.ts
│   │   │   ├── save.ts
│   │   │   ├── export.ts
│   │   │   └── [id].ts
│   │   ├── approvals/
│   │   │   ├── submit.ts
│   │   │   ├── approve.ts
│   │   │   └── reject.ts
│   │   └── settings/
│   │       ├── profiles.ts
│   │       └── preferences.ts
│   ├── src/
│   │   ├── services/
│   │   │   ├── news-scraper/
│   │   │   │   ├── rss-scraper.ts
│   │   │   │   ├── sources.config.ts
│   │   │   │   ├── social-scraper.ts
│   │   │   │   ├── trending-aggregator.ts
│   │   │   │   └── categorizer.ts
│   │   │   ├── ai/
│   │   │   │   ├── frameworks/
│   │   │   │   │   ├── fttg-investigative.ts
│   │   │   │   │   ├── educational-deepdive.ts
│   │   │   │   │   └── framework-registry.ts
│   │   │   │   ├── angle-generator.ts
│   │   │   │   ├── script-writer.ts
│   │   │   │   ├── evidence-finder.ts
│   │   │   │   └── prompts.config.ts
│   │   │   ├── calendar/
│   │   │   │   ├── frequency-calculator.ts   # Calculate posting schedule
│   │   │   │   ├── auto-scheduler.ts         # Auto-fill calendar
│   │   │   │   └── quota-tracker.ts
│   │   │   ├── collaboration/
│   │   │   │   ├── invitation.service.ts
│   │   │   │   ├── approval.service.ts
│   │   │   │   └── activity-log.service.ts
│   │   │   ├── search/
│   │   │   │   ├── news-search.ts
│   │   │   │   └── related-stories.ts
│   │   │   └── auth/
│   │   │       ├── auth.service.ts
│   │   │       ├── jwt.ts
│   │   │       └── password.ts
│   │   ├── db/
│   │   │   ├── client.ts
│   │   │   ├── migrations/
│   │   │   │   ├── 001_initial_schema.sql
│   │   │   │   ├── 002_seed_frameworks.sql
│   │   │   │   └── 003_create_indexes.sql
│   │   │   └── queries/
│   │   │       ├── project.queries.ts
│   │   │       ├── calendar.queries.ts
│   │   │       ├── news.queries.ts
│   │   │       ├── angle.queries.ts
│   │   │       ├── script.queries.ts
│   │   │       └── user.queries.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── project-member.middleware.ts  # Check project membership
│   │   │   ├── team-only.middleware.ts
│   │   │   ├── rate-limiter.ts
│   │   │   └── error-handler.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   ├── validators.ts
│   │   │   └── response.ts
│   │   └── types/
│   │       └── index.ts
│   ├── cron/
│   │   ├── news-fetcher.ts
│   │   └── trending-updater.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vercel.json
├── shared/
│   └── types.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── API.md
│   ├── FRAMEWORKS.md                         # Detailed framework specs
│   └── DEPLOYMENT.md
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## USER EXPERIENCE FLOWS

### Flow 1: FTTG Creates Project & Invites Client
```
1. FTTG logs in
2. Goes to /projects
3. Clicks "Create New Project"
4. Fills in:
   - Project name: "Mediacorp Weekly Commentary Q1 2025"
   - Posting frequency: Weekly (every Monday)
   - Video quota: 13 videos (13 weeks)
   - Start date: Jan 6, 2025
   - End date: Mar 31, 2025
5. Project created, calendar auto-populated with 13 slots
6. FTTG clicks "Invite Members"
7. Enters client emails, sets permissions:
   - john@mediacorp.com (Editor: can create & approve)
   - sarah@mediacorp.com (Viewer: read-only)
8. Invitations sent
9. Clients receive email, accept invitation
10. Clients can now access project
```

### Flow 2: Planning Stories in Calendar
```
1. User navigates to /project/[id]/calendar
2. Sees calendar view with 13 empty slots (one per Monday)
3. Opens /project/[id]/library (news feed)
4. Sees trending stories + categorized news
5. Finds interesting story: "Singapore's AI regulation debate"
6. Clicks "Add to Calendar"
7. Selects date: Monday, Jan 13, 2025
8. System creates calendar_item in "draft" status
9. Calendar now shows story on Jan 13
10. User clicks on calendar item to develop it further
```

### Flow 3: Generating Angles for Calendar Item
```
1. User clicks calendar item: "Singapore's AI regulation debate"
2. Clicks "Generate Angles"
3. Selects audience profile: "Tech-savvy millennials"
4. Selects framework: "FTTG Investigative"
5. Sets comparison regions: Singapore, EU, US, China
6. Clicks "Generate"
7. AI produces 3 contrarian angles:
   - Angle 1: "Singapore's AI rules are copying EU homework—badly"
   - Angle 2: "Why Singapore's AI ethics board has zero teeth"
   - Angle 3: "The real reason Singapore won't regulate AI (yet)"
8. User reviews angles, selects Angle 2
9. Edits "why audiences care": "Tech workers fear job displacement
   without safety nets"
10. Saves angle to calendar item
11. Calendar item status: draft → pending_review
```

### Flow 4: Generating Script (Team Only)
```
1. FTTG team member opens calendar item with approved angle
2. Clicks "Generate Script"
3. Selects:
   - Duration: 3.5 minutes
   - Format: Educational (John Oliver-style)
   - Framework: Educational Deep-Dive
4. AI generates script with:
   - Timely hook
   - Context setup
   - Problem breakdown
   - Evidence layering
   - Human impact stories
   - Systemic analysis
   - Visual suggestions
   - Call to action
5. Script includes production notes:
   - "Show clip of minister's speech here"
   - "Graphic: comparison of AI rules by country"
   - "Deliver this line with ironic tone"
6. Team edits script
7. Exports as PDF
8. Calendar item status: approved → in_production
```

### Flow 5: Approval Workflow
```
1. Editor creates story angle
2. Status: draft → pending_review
3. Owner (FTTG or client admin) receives notification
4. Owner reviews angle
5. Options:
   a) Approve → status: approved
   b) Request changes → adds comments, status stays pending_review
   c) Reject → status: cancelled
6. If approved, script can be generated
7. Script also goes through approval
8. Once script approved, item marked "ready for production"
```

---

## AI PROMPTING CONFIGURATION

### Frameworks Registry
```typescript
// backend/src/services/ai/frameworks/framework-registry.ts

export const STORYTELLING_FRAMEWORKS = {
  fttg_investigative: {
    id: 'fttg_investigative',
    name: 'FTTG Investigative',
    description: 'Contrarian, emotionally-driven investigative storytelling',
    bestFor: ['breaking news', 'policy analysis', 'exposing disconnects'],
    tone: 'provocative',
    generator: fttgInvestigativeGenerator,
    scriptWriter: fttgInvestigativeScriptWriter,
  },
  educational_deepdive: {
    id: 'educational_deepdive',
    name: 'Educational Deep-Dive',
    description: 'John Oliver-style comprehensive topic education',
    bestFor: ['explainers', 'complex issues', 'weekly commentary'],
    tone: 'educational',
    generator: educationalDeepDiveGenerator,
    scriptWriter: educationalDeepDiveScriptWriter,
  },
  // Future frameworks:
  // social_viral: { ... },
  // data_journalism: { ... },
};
```

---

## ENVIRONMENT VARIABLES
```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# AI APIs
ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key

# Social Listening APIs
TRENDS24_API_KEY=your-trends24-key
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret

# Email (for invitations - future)
SENDGRID_API_KEY=your-sendgrid-key

# Vercel
VERCEL_URL=your-app-url.vercel.app
```

---

## DEPLOYMENT CONFIGURATION

### Vercel Configuration (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "backend/api/**/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/news-fetcher",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/trending-updater",
      "schedule": "*/5 * * * *"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

---

## PHASED DEVELOPMENT PLAN

### Phase 1: Foundation
- Database setup (projects, calendar, frameworks)
- Authentication system
- Project creation & invitation system
- Basic frontend shell

### Phase 2: Calendar System
- Calendar view UI
- Drag & drop scheduling
- Frequency calculator
- Quota tracker
- Calendar item CRUD

### Phase 3: News Engine
- RSS scrapers
- Social listening
- News library UI
- Add to calendar functionality

### Phase 4: FTTG Investigative Framework
- Framework implementation
- Angle generator AI
- Evidence finder
- Angle explorer UI

### Phase 5: Educational Deep-Dive Framework
- Framework implementation
- Angle generator AI
- Visual suggestions generator
- Angle explorer UI updates

### Phase 6: Script Generator
- Multi-framework script writer
- Production notes generator
- Script editor UI
- Export functionality

### Phase 7: Collaboration & Approvals
- Approval workflows
- Activity logs
- Notifications (basic)
- Team permissions

### Phase 8: Polish
- Error handling
- Usage tracking
- Mobile responsiveness
- Beta testing

---

## SUCCESS METRICS

### Beta Phase (Initial):
- [ ] 1 project created
- [ ] 3+ users collaborating
- [ ] 10+ calendar items planned
- [ ] 5+ angles generated per week
- [ ] 2+ scripts created per week
- [ ] Calendar view usable on mobile

### Post-Beta:
- [ ] 3-5 active projects
- [ ] 10+ total users
- [ ] 50+ calendar items planned
- [ ] <2s angle generation
- [ ] <5s script generation
- [ ] 90% user satisfaction

---

END OF ARCHITECTURE DOCUMENT

-- FTTG Content Intelligence Platform
-- Migration 002: Seed Storytelling Frameworks
-- Inserts FTTG Investigative and Educational Deep-Dive frameworks

INSERT INTO storytelling_frameworks (name, type, description, framework_steps, system_prompt, user_prompt_template, is_active, is_team_only)
VALUES (
  'FTTG Investigative',
  'fttg_investigative',
  'Contrarian, emotionally-driven investigative storytelling. Best for breaking news, policy analysis, and exposing disconnects.',
  '[
    {"step": "contrarian_headline", "instruction": "Create a headline that challenges the mainstream narrative. Use definitive language. Create cognitive dissonance.", "output_format": "Single impactful headline (5-10 words)"},
    {"step": "narrative_extraction", "instruction": "Identify the official narrative: What is being publicly stated? Who is promoting it? What are the stated goals/benefits?", "output_format": "2-3 sentence summary of the official position"},
    {"step": "contradiction_finder", "instruction": "Find data that challenges the narrative. Look for: implementation failures, delays, budget overruns, quotes from affected parties, statistical evidence contradicting claims.", "output_format": "List of 3-5 specific contradictions with sources"},
    {"step": "comparison_framework", "instruction": "Find how other countries/organizations handled similar situations. Highlight approach differences and outcomes.", "output_format": "Comparison between subject and 1-2 contrasting examples"},
    {"step": "emotional_core", "instruction": "Identify who is being affected (common people, small businesses). What is the hidden cost? Use specific numbers, prices, personal impacts.", "output_format": "Emotional hook with concrete examples"},
    {"step": "authority_challenge", "instruction": "Question the real motive. Expose misalignment between stated goals and actual priorities. Use insider knowledge or direct quotes if available.", "output_format": "Critical analysis of underlying motives"},
    {"step": "conclusion", "instruction": "Reframe the why. Expose the betrayal or disconnect. Make it memorable and punchy.", "output_format": "Single powerful concluding statement"}
  ]'::jsonb,
  'You are an investigative journalist AI trained in FTTG''s contrarian storytelling framework.

Your approach:
- Challenge mainstream narratives with evidence
- Expose disconnects between stated goals and reality
- Use specific data (prices, percentages, quotes) over generalities
- Show don''t tell: Paint scenes, use concrete examples
- Question authority''s true motives

Generate angles that make audiences think: "Wait, that''s not what I was told."

Output Structure: Follow the 7-step FTTG Investigative framework precisely.',
  'STORY TO ANALYZE:
Title: {{news_title}}
Content: {{news_content}}
Source: {{news_source}}
Published: {{published_at}}

AUDIENCE CONTEXT:
Demographics: {{audience_age_range}}, {{audience_location}}
Values: {{audience_values}}
Fears: {{audience_fears}}
Aspirations: {{audience_aspirations}}

COMPARISON SCOPE: {{comparison_regions}}

TASK: Generate 3 distinct investigative angles using the 7-step framework.

For each angle:
1. contrarian_headline: Challenge the mainstream narrative (5-10 words)
2. narrative_extraction: Official story (2-3 sentences)
3. contradiction_finder: 3-5 contradictions with specific data/sources
4. comparison_framework: How 1-2 other regions handled this differently
5. emotional_core: Who is affected? Use specific numbers/prices/quotes
6. authority_challenge: Question the real motive
7. conclusion: Punchy reframe of the "why"

Also include:
- audience_care_statement: Why should THIS audience care? (connect to their fears/aspirations)
- supporting_evidence: List of source IDs/URLs for further research

Return JSON array of 3 angles.',
  true,
  false
);

INSERT INTO storytelling_frameworks (name, type, description, framework_steps, system_prompt, user_prompt_template, is_active, is_team_only)
VALUES (
  'Educational Deep-Dive',
  'educational_deepdive',
  'John Oliver-style comprehensive topic education with humor and systemic analysis. Best for explainer videos, complex issues, and weekly commentary.',
  '[
    {"step": "timely_hook", "instruction": "Connect topic to current event. Why should we talk about this NOW? Use humor if appropriate.", "output_format": "Opening hook (2-3 sentences) with relevance anchor"},
    {"step": "context_setup", "instruction": "Explain the basics: What is this issue? Who is involved? Assume audience knows nothing. Be clear and simple.", "output_format": "Plain-language explanation (3-5 sentences)"},
    {"step": "problem_breakdown", "instruction": "Identify the core problem. Break complex issue into digestible parts. Use numbered lists or categories.", "output_format": "3-5 key problems or aspects, clearly delineated"},
    {"step": "evidence_layering", "instruction": "Build the case with evidence: statistics, expert quotes, news clips, historical data. Layer from recent to historical. Include absurdities or contradictions.", "output_format": "5-10 evidence points with sources, organized chronologically or thematically"},
    {"step": "human_impact", "instruction": "Show real people affected. Use specific stories, testimonials, or scenarios that humanize the issue.", "output_format": "2-3 human impact examples with details"},
    {"step": "systemic_analysis", "instruction": "Zoom out: Why does this keep happening? What systems, incentives, or structures enable this? Connect dots between evidence points.", "output_format": "Systemic explanation (3-5 sentences) identifying root causes"},
    {"step": "visual_suggestions", "instruction": "Suggest visuals that would aid understanding: graphics, charts, clips, reenactments. Think about how to make abstract concepts concrete.", "output_format": "List of 5-10 visual aids with descriptions"},
    {"step": "call_to_action", "instruction": "What needs to change? Who needs to do what? Be specific about solutions or reforms needed.", "output_format": "Clear call to action (2-3 specific recommendations)"}
  ]'::jsonb,
  'You are an educational content AI trained in John Oliver''s Last Week Tonight style of explanatory journalism.

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

Output Structure: Follow the 8-step Educational Deep-Dive framework precisely.',
  'TOPIC TO EXPLAIN:
Title: {{news_title}}
Content: {{news_content}}
Source: {{news_source}}

RELATED CONTEXT:
{{related_stories}}

AUDIENCE CONTEXT:
Education level: {{audience_education_level}}
Values: {{audience_values}}
Depth preference: {{audience_depth_preference}}

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

Return JSON array of 2-3 educational angles.',
  true,
  false
);

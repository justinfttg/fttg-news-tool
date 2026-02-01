import Anthropic from '@anthropic-ai/sdk';

export interface AnalyzedAudience {
  platformName: string | null;
  platformType: 'digital_media' | 'broadcast_tv' | 'radio' | 'print' | 'social_media' | 'podcast' | 'other' | null;
  primaryLanguage: string | null;
  secondaryLanguages: string[];
  marketRegion: string | null;
  contentCategories: string[];
  audienceSize: string | null;
  ageRange: string | null;
  location: string | null;
  educationLevel: string | null;
  keyDemographics: string | null;
  culturalContext: string | null;
  values: string[];
  fears: string[];
  aspirations: string[];
  preferredTone: 'investigative' | 'educational' | 'balanced' | 'provocative' | 'conversational' | null;
  depthPreference: 'surface' | 'medium' | 'deep_dive' | null;
  politicalSensitivity: number | null;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * Analyze a platform URL to infer audience characteristics.
 * Fetches the page content and uses AI to analyze the target audience.
 */
export async function analyzeAudienceFromUrl(url: string): Promise<AnalyzedAudience | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FTTGBot/1.0; +https://fttg.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();

    // Extract meaningful text content (simplified extraction)
    const textContent = extractTextFromHtml(html, url);

    const anthropic = getClient();

    const prompt = `You are an expert media analyst. Analyze this website/platform and infer the target audience characteristics.

URL: ${url}

Website Content (excerpt):
${textContent.slice(0, 8000)}

Based on the website content, language, style, and topics covered, provide a detailed audience profile. Consider:
- The primary language of the content
- The geographic/market focus
- The type of content and topics covered
- The likely demographics of readers/viewers
- Cultural context and sensitivities
- The tone and depth of content

Respond with a JSON object in this exact format (use null for unknown fields):
{
  "platformName": "Name of the platform/publication",
  "platformType": "digital_media|broadcast_tv|radio|print|social_media|podcast|other",
  "primaryLanguage": "e.g., Mandarin, English, Malay",
  "secondaryLanguages": ["array of other languages used"],
  "marketRegion": "e.g., Singapore, Malaysia, Southeast Asia",
  "contentCategories": ["News", "Entertainment", "Lifestyle", etc.],
  "audienceSize": "estimated reach if known, e.g., 500K monthly",
  "ageRange": "e.g., 25-55",
  "location": "e.g., Urban Singapore, Metro Malaysia",
  "educationLevel": "e.g., Secondary and above, College-educated",
  "keyDemographics": "Brief description of key demographic traits",
  "culturalContext": "Cultural considerations, values, and sensitivities for this audience",
  "values": ["array of 3-5 core values this audience cares about"],
  "fears": ["array of 3-5 concerns/fears this audience has"],
  "aspirations": ["array of 3-5 goals/aspirations this audience has"],
  "preferredTone": "investigative|educational|balanced|provocative|conversational",
  "depthPreference": "surface|medium|deep_dive",
  "politicalSensitivity": 1-10 (where 10 is highly sensitive)
}

Return ONLY the JSON object, no other text.`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    let responseText = aiResponse.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    // Parse and validate the response
    const parsed = JSON.parse(responseText);

    return validateAndCleanResponse(parsed);
  } catch (error) {
    console.error('[audience-analyzer] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHtml(html: string, url: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Extract title
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extract headings
  const headings: string[] = [];
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match;
  while ((match = headingRegex.exec(text)) !== null) {
    const headingText = match[1].replace(/<[^>]+>/g, '').trim();
    if (headingText.length > 3 && headingText.length < 200) {
      headings.push(headingText);
    }
  }

  // Extract paragraph text
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = pRegex.exec(text)) !== null) {
    const pText = match[1].replace(/<[^>]+>/g, '').trim();
    if (pText.length > 20) {
      paragraphs.push(pText);
    }
  }

  // Extract nav/menu items for category hints
  const navText = text.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi);
  const navItems = navText
    ? navText.map(n => n.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ')
    : '';

  // Combine extracted content
  const result = [
    `URL: ${url}`,
    `Title: ${title}`,
    `Description: ${description}`,
    `Navigation: ${navItems.slice(0, 500)}`,
    `Headings: ${headings.slice(0, 20).join(' | ')}`,
    `Content: ${paragraphs.slice(0, 30).join('\n')}`,
  ].join('\n\n');

  return result;
}

/**
 * Validate and clean the AI response
 */
function validateAndCleanResponse(parsed: any): AnalyzedAudience {
  const validPlatformTypes = ['digital_media', 'broadcast_tv', 'radio', 'print', 'social_media', 'podcast', 'other'];
  const validTones = ['investigative', 'educational', 'balanced', 'provocative', 'conversational'];
  const validDepths = ['surface', 'medium', 'deep_dive'];

  return {
    platformName: typeof parsed.platformName === 'string' ? parsed.platformName : null,
    platformType: validPlatformTypes.includes(parsed.platformType) ? parsed.platformType : null,
    primaryLanguage: typeof parsed.primaryLanguage === 'string' ? parsed.primaryLanguage : null,
    secondaryLanguages: Array.isArray(parsed.secondaryLanguages)
      ? parsed.secondaryLanguages.filter((s: any) => typeof s === 'string')
      : [],
    marketRegion: typeof parsed.marketRegion === 'string' ? parsed.marketRegion : null,
    contentCategories: Array.isArray(parsed.contentCategories)
      ? parsed.contentCategories.filter((s: any) => typeof s === 'string')
      : [],
    audienceSize: typeof parsed.audienceSize === 'string' ? parsed.audienceSize : null,
    ageRange: typeof parsed.ageRange === 'string' ? parsed.ageRange : null,
    location: typeof parsed.location === 'string' ? parsed.location : null,
    educationLevel: typeof parsed.educationLevel === 'string' ? parsed.educationLevel : null,
    keyDemographics: typeof parsed.keyDemographics === 'string' ? parsed.keyDemographics : null,
    culturalContext: typeof parsed.culturalContext === 'string' ? parsed.culturalContext : null,
    values: Array.isArray(parsed.values)
      ? parsed.values.filter((s: any) => typeof s === 'string').slice(0, 10)
      : [],
    fears: Array.isArray(parsed.fears)
      ? parsed.fears.filter((s: any) => typeof s === 'string').slice(0, 10)
      : [],
    aspirations: Array.isArray(parsed.aspirations)
      ? parsed.aspirations.filter((s: any) => typeof s === 'string').slice(0, 10)
      : [],
    preferredTone: validTones.includes(parsed.preferredTone) ? parsed.preferredTone : null,
    depthPreference: validDepths.includes(parsed.depthPreference) ? parsed.depthPreference : null,
    politicalSensitivity: typeof parsed.politicalSensitivity === 'number'
      && parsed.politicalSensitivity >= 1
      && parsed.politicalSensitivity <= 10
      ? Math.round(parsed.politicalSensitivity)
      : null,
  };
}

import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = [
  'Technology',
  'Health',
  'Economy',
  'Business',
  'Environment',
  'Politics',
  'Security',
  'Science',
  'Education',
  'Sports',
  'Entertainment',
  'General',
] as const;

type Category = (typeof CATEGORIES)[number];

interface SummaryResult {
  summary: string;
  category: Category;
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
 * Generate a summary and category for a news article using Claude Haiku.
 * Returns null if AI processing fails (allows graceful degradation).
 */
export async function summarizeArticle(
  title: string,
  content: string | null,
  existingCategory?: string
): Promise<SummaryResult | null> {
  // Skip if no API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  // Skip if content is too short to summarize
  const text = content || title;
  if (text.length < 50) {
    return null;
  }

  try {
    const anthropic = getClient();

    const prompt = `Analyze this news article and provide:
1. A concise 1-2 sentence summary (max 200 characters)
2. The most appropriate category from this list: ${CATEGORIES.join(', ')}

Article Title: ${title}

Article Content: ${text.slice(0, 2000)}

Respond in this exact JSON format only, no other text:
{"summary": "your summary here", "category": "Category"}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    // Validate category
    const category = CATEGORIES.includes(parsed.category)
      ? parsed.category
      : existingCategory || 'General';

    return {
      summary: parsed.summary?.slice(0, 300) || null,
      category,
    };
  } catch (error) {
    console.error('[ai-summarizer] Error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Batch process multiple articles with rate limiting.
 * Processes up to maxConcurrent articles at a time.
 */
export async function summarizeArticlesBatch(
  articles: Array<{ title: string; content: string | null; existingCategory?: string }>,
  maxConcurrent = 5
): Promise<Array<SummaryResult | null>> {
  const results: Array<SummaryResult | null> = [];

  // Process in chunks to avoid rate limits
  for (let i = 0; i < articles.length; i += maxConcurrent) {
    const chunk = articles.slice(i, i + maxConcurrent);
    const chunkResults = await Promise.all(
      chunk.map((article) =>
        summarizeArticle(article.title, article.content, article.existingCategory)
      )
    );
    results.push(...chunkResults);

    // Small delay between chunks to avoid rate limits
    if (i + maxConcurrent < articles.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

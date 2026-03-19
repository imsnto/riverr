'use server';
/**
 * @fileOverview A flow for crawling a website and extracting business knowledge for an AI Agent.
 *
 * - crawlWebsiteKnowledge - A function that fetches and processes a URL to extract business context.
 * - CrawlWebsiteInput - The input type for the flow.
 * - CrawlWebsiteOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CrawlWebsiteInputSchema = z.object({
  url: z.string().url().describe('The website URL to crawl.'),
});
export type CrawlWebsiteInput = z.infer<typeof CrawlWebsiteInputSchema>;

const CrawlWebsiteOutputSchema = z.object({
  businessContext: z.object({
    businessName: z.string().optional(),
    location: z.string().optional(),
    whatYouDo: z.string().optional(),
    whoYourCustomersAre: z.string().optional(),
    hours: z.string().optional(),
    minOrder: z.string().optional(),
    turnaround: z.string().optional(),
    differentiation: z.string().optional(),
  }).optional(),
  products: z.array(z.object({
    name: z.string(),
    price: z.string().optional(),
    description: z.string(),
    triggers: z.string(),
  })).optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
});
export type CrawlWebsiteOutput = z.infer<typeof CrawlWebsiteOutputSchema>;

export async function crawlWebsiteKnowledge(input: CrawlWebsiteInput): Promise<CrawlWebsiteOutput> {
  return crawlWebsiteKnowledgeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'crawlWebsiteKnowledgePrompt',
  input: {schema: z.object({ html: z.string(), url: z.string() })},
  output: {schema: CrawlWebsiteOutputSchema},
  prompt: `You are an expert business analyst and AI trainer. 
I am providing you with the text content extracted from a business's website (URL: {{{url}}}).

**WEBSITE CONTENT:**
---
{{{html}}}
---

**YOUR TASK:**
Extract as much structured information as possible to help train an AI agent for this business. 
Focus on identifying the core value proposition, product categories, and common logistical details.

**FIELDS TO EXTRACT:**
1.  **Business Context**:
    *   **businessName**: The official name.
    *   **location**: Physical location or primary service area.
    *   **whatYouDo**: Detailed explanation of services/products.
    *   **whoYourCustomersAre**: Target demographic or audience.
    *   **hours**: Business operating hours.
    *   **minOrder**: Minimum order amounts or service thresholds.
    *   **turnaround**: Delivery or production lead times.
    *   **differentiation**: Why they are better than competitors.
2.  **Products**: Extract up to 5 key product/service categories. For each, provide a name, a detailed description, and "triggers" (situations where this should be recommended).
3.  **FAQs**: Extract up to 5 frequently asked questions and their answers found on the site.

If a field cannot be found, leave it empty. Do not invent facts.`,
});

const crawlWebsiteKnowledgeFlow = ai.defineFlow(
  {
    name: 'crawlWebsiteKnowledgeFlow',
    inputSchema: CrawlWebsiteInputSchema,
    outputSchema: CrawlWebsiteOutputSchema,
  },
  async input => {
    try {
      // Basic fetch to get the HTML content
      const response = await fetch(input.url);
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      
      const html = await response.text();
      // Simple text extraction (strip script/style/html tags for token efficiency)
      const cleanText = html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000); // Limit context size for Gemini

      const {output} = await prompt({ html: cleanText, url: input.url });
      return output!;
    } catch (e: any) {
      console.error("Crawl Flow Error:", e);
      throw e;
    }
  }
);

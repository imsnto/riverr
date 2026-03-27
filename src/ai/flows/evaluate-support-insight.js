"use strict";
'use server';
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluateInsightOutputSchema = exports.EvaluateInsightInputSchema = void 0;
exports.evaluateSupportInsight = evaluateSupportInsight;
/**
 * @fileOverview AI flow to evaluate if a human support response contains a reusable resolution.
 *
 * - evaluateSupportInsight - Decides if an insight should be created and extracts content.
 */
const genkit_1 = require("@/ai/genkit");
const genkit_2 = require("genkit");
exports.EvaluateInsightInputSchema = genkit_2.z.object({
    messageText: genkit_2.z.string().describe('The content of the agent message to evaluate.'),
    conversationContext: genkit_2.z.string().optional().describe('Recent message history for context.'),
});
exports.EvaluateInsightOutputSchema = genkit_2.z.object({
    shouldCreateInsight: genkit_2.z.boolean().describe('Whether this response contains a valuable, reusable resolution.'),
    confidence: genkit_2.z.number().min(0).max(1).describe('Confidence score for the decision.'),
    reason: genkit_2.z.string().describe('Why this was or was not selected.'),
    title: genkit_2.z.string().optional().describe('A concise, internal-facing title for this insight. Normalized and reusable.'),
    issueLabel: genkit_2.z.string().optional().describe('A machine-readable label for the issue type.'),
    resolutionLabel: genkit_2.z.string().optional().describe('A machine-readable label for the resolution type.'),
    structuredContent: genkit_2.z.object({
        issue: genkit_2.z.string().describe('Normalized description of the customer problem. Root cause focus.'),
        resolution: genkit_2.z.string().describe('The specific steps or explanation that solved it. Reusable finding.'),
        context: genkit_2.z.string().optional().describe('System requirements, constraints, or channel-specific details.'),
    }).optional(),
});
async function evaluateSupportInsight(input) {
    return evaluateSupportInsightFlow(input);
}
const prompt = genkit_1.ai.definePrompt({
    name: 'evaluateSupportInsightPrompt',
    input: { schema: exports.EvaluateInsightInputSchema },
    output: { schema: exports.EvaluateInsightOutputSchema },
    prompt: `You are an expert Knowledge Management AI. Your job is to analyze human support responses and identify "Insights" — reusable pieces of internal knowledge.

**CREATION RULES:**
Only create an Insight if the message contains:
- Root cause of a problem
- Troubleshooting findings or workarounds
- Explanation of complex system behavior
- Repeatable resolution steps
- Onboarding clarification

**DO NOT CREATE IF:**
- Greeting or filler (thanks, hello, checking now)
- Short status updates (sent to team, escalating)
- General conversation with no reusable resolution

**MESSAGE TO EVALUATE:**
---
{{{messageText}}}
---

**CONTEXT:**
---
{{{conversationContext}}}
---

**TASK:**
Decide if this message contains a high-signal support resolution. If yes, extract the issue, the resolution, and a professional internal title. 
Focus on identifying the core problem solved. Output a stable title and labels.`,
});
const evaluateSupportInsightFlow = genkit_1.ai.defineFlow({
    name: 'evaluateSupportInsightFlow',
    inputSchema: exports.EvaluateInsightInputSchema,
    outputSchema: exports.EvaluateInsightOutputSchema,
}, async (input) => {
    const { output } = await prompt(input);
    return output;
});

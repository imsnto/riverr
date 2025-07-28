// src/ai/flows/suggest-project-from-meeting.ts
'use server';

/**
 * @fileOverview Suggests project assignments for unmapped Slack Meeting Logs, based on channel name and admin mappings.
 *
 * - suggestProjectFromMeeting - A function that suggests a project for a given Slack meeting log.
 * - SuggestProjectFromMeetingInput - The input type for the suggestProjectFromMeeting function.
 * - SuggestProjectFromMeetingOutput - The return type for the suggestProjectFromMeeting function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestProjectFromMeetingInputSchema = z.object({
  channelName: z.string().describe('The name of the Slack channel the meeting occurred in.'),
  adminMappings: z
    .record(z.string(), z.string())
    .describe(
      'A map of admin defined mappings from slack channel id to project id.'
    ),
});

export type SuggestProjectFromMeetingInput = z.infer<
  typeof SuggestProjectFromMeetingInputSchema
>;

const SuggestProjectFromMeetingOutputSchema = z.object({
  suggestedProjectId: z
    .string()
    .optional()
    .describe('The suggested project ID for the meeting log.'),
  reason: z.string().describe('The reason for the project suggestion.'),
});

export type SuggestProjectFromMeetingOutput = z.infer<
  typeof SuggestProjectFromMeetingOutputSchema
>;

export async function suggestProjectFromMeeting(
  input: SuggestProjectFromMeetingInput
): Promise<SuggestProjectFromMeetingOutput> {
  return suggestProjectFromMeetingFlow(input);
}

const suggestProjectFromMeetingPrompt = ai.definePrompt({
  name: 'suggestProjectFromMeetingPrompt',
  input: {schema: SuggestProjectFromMeetingInputSchema},
  output: {schema: SuggestProjectFromMeetingOutputSchema},
  prompt: `Based on the Slack channel name and admin mappings provided, suggest the most relevant project for this meeting.

Slack Channel Name: {{{channelName}}}
Admin Mappings: {{{JSON.stringify adminMappings}}}

Consider both the channel name and any available admin mappings to determine the best project. If a fuzzy match is found between the channel name and a project name, or if there's a direct mapping in adminMappings, suggest that project. Explain your reasoning for the suggestion.

If no suitable project is found, leave suggestedProjectId empty.`,
});

const suggestProjectFromMeetingFlow = ai.defineFlow(
  {
    name: 'suggestProjectFromMeetingFlow',
    inputSchema: SuggestProjectFromMeetingInputSchema,
    outputSchema: SuggestProjectFromMeetingOutputSchema,
  },
  async input => {
    const {output} = await suggestProjectFromMeetingPrompt(input);
    return output!;
  }
);

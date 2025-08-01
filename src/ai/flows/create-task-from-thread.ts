
'use server';
/**
 * @fileOverview Creates a task draft from a message thread.
 *
 * - createTaskFromThread - A function that creates a task from a thread.
 * - CreateTaskFromThreadInput - The input type for the createTaskFromThread function.
 * - CreateTaskFrom-ThreadOutput - The return type for the createTaskFromThread function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Note: We don't use the full User/Project objects here, just what the AI needs.
const SimplifiedUserSchema = z.object({ id: z.string(), name: z.string() });
const SimplifiedProjectSchema = z.object({ id: z.string(), name: z.string() });

const CreateTaskFromThreadInputSchema = z.object({
  threadContent: z.string().describe('The full content of the message thread.'),
  channelMembersAsJson: z.string().describe('A JSON string of members in the channel to help suggest assignees.'),
  projectsAsJson: z.string().describe('A JSON string of available projects to associate the task with.'),
});
// This is the internal type for the flow
type CreateTaskFromThreadFlowInput = z.infer<typeof CreateTaskFromThreadInputSchema>;


// This is the public interface for the component
export interface CreateTaskFromThreadInput {
  threadContent: string;
  channelMembers: z.infer<typeof SimplifiedUserSchema>[];
  projects: z.infer<typeof SimplifiedProjectSchema>[];
}

const CreateTaskFromThreadOutputSchema = z.object({
  title: z.string().describe('A concise, action-oriented title for the task. For example, for "Hey @Brad, can you look at the latest mockups for the homepage?", a good title would be "Review homepage mockups".'),
  description: z.string().describe('A detailed summary of the conversation and the action items.'),
  suggestedAssigneeId: z.string().optional().describe('The ID of the user suggested to be the assignee, based on who was mentioned or responded.'),
  suggestedProjectId: z.string().optional().describe('The ID of the project suggested for this task based on context.'),
  suggestedDueDate: z.string().optional().describe("The suggested due date in ISO format (e.g., '2024-08-20T23:59:59Z'), extracted or inferred from the conversation (e.g., 'by Friday')."),
  suggestedPriority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional().describe('The suggested priority based on tone or urgency.'),
});
export type CreateTaskFromThreadOutput = z.infer<typeof CreateTaskFromThreadOutputSchema>;


export async function createTaskFromThread(input: CreateTaskFromThreadInput): Promise<CreateTaskFromThreadOutput> {
  // Convert arrays to JSON strings before calling the flow
  const flowInput: CreateTaskFromThreadFlowInput = {
    threadContent: input.threadContent,
    channelMembersAsJson: JSON.stringify(input.channelMembers),
    projectsAsJson: JSON.stringify(input.projects),
  };
  return createTaskFromThreadFlow(flowInput);
}

const prompt = ai.definePrompt({
  name: 'createTaskFromThreadPrompt',
  input: {schema: CreateTaskFromThreadInputSchema},
  output: {schema: CreateTaskFromThreadOutputSchema},
  prompt: `You are an intelligent project management assistant. Your task is to analyze a conversation thread from a messaging app and convert it into a structured task.

Current Date: ${new Date().toISOString()}

Analyze the following thread content:
---
{{{threadContent}}}
---

Based on the conversation, generate a task with the following properties:
- **Task Title:** Create a concise, action-oriented title that summarizes the core task. For example, for "Hey @Brad, can you look at the latest mockups for the homepage?", a good title would be "Review homepage mockups".
- **Description:** Write a summary of the conversation, focusing on the problem and the required actions. Include the original thread content for reference.
- **Suggested Assignee:** From the provided list of channel members, identify the best person to assign this task to. This is often the person being asked a question, who is mentioned by name, or who volunteers. Use the user's 'id' field for 'suggestedAssigneeId'. If no one is mentioned, leave it empty.
- **Suggested Project:** From the provided list of projects, determine the most relevant project for this task based on the conversation's context. Use the project's 'id' field for 'suggestedProjectId'. If no project seems relevant, leave it empty.
- **Due Date:** If the conversation mentions a deadline (e.g., "by Friday," "end of day," "next week"), infer the specific date and provide it in ISO format.
- **Priority:** Based on the language used (e.g., "ASAP," "urgent," "blocker"), suggest a priority level. Default to 'Medium' if no urgency is implied.

Here are the available channel members (use their 'id' for the suggestion):
{{{channelMembersAsJson}}}

Here are the available projects (use their 'id' for the suggestion):
{{{projectsAsJson}}}

Provide your response in the requested JSON format.
`,
});

const createTaskFromThreadFlow = ai.defineFlow(
  {
    name: 'createTaskFromThreadFlow',
    inputSchema: CreateTaskFromThreadInputSchema,
    outputSchema: CreateTaskFromThreadOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

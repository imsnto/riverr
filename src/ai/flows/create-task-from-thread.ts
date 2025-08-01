'use server';
/**
 * @fileOverview Creates a task draft from a message thread.
 *
 * - createTaskFromThread - A function that creates a task from a thread.
 * - CreateTaskFromThreadInput - The input type for the createTaskFromThread function.
 * - CreateTaskFromThreadOutput - The return type for the createTaskFromThread function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { User, Project } from '@/lib/data';

const CreateTaskFromThreadInputSchema = z.object({
  threadContent: z.string().describe('The full content of the message thread.'),
  channelMembers: z.array(z.custom<User>()).describe('A list of members in the channel to help suggest assignees.'),
  projects: z.array(z.custom<Project>()).describe('A list of available projects to associate the task with.'),
});
export type CreateTaskFromThreadInput = z.infer<typeof CreateTaskFromThreadInputSchema>;

const CreateTaskFromThreadOutputSchema = z.object({
  title: z.string().describe('A concise, auto-generated title for the task based on the thread summary.'),
  description: z.string().describe('A detailed summary of the conversation and the action items.'),
  suggestedAssigneeId: z.string().optional().describe('The ID of the user suggested to be the assignee, based on who was mentioned or responded.'),
  suggestedProjectId: z.string().optional().describe('The ID of the project suggested for this task based on context.'),
  suggestedDueDate: z.string().optional().describe("The suggested due date in ISO format (e.g., '2024-08-20T23:59:59Z'), extracted or inferred from the conversation (e.g., 'by Friday')."),
  suggestedPriority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional().describe('The suggested priority based on tone or urgency.'),
});
export type CreateTaskFromThreadOutput = z.infer<typeof CreateTaskFromThreadOutputSchema>;


export async function createTaskFromThread(input: CreateTaskFromThreadInput): Promise<CreateTaskFromThreadOutput> {
  return createTaskFromThreadFlow(input);
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
- **Task Title:** Create a short, clear title that summarizes the main action item.
- **Description:** Write a summary of the conversation, focusing on the problem and the required actions.
- **Suggested Assignee:** From the provided list of channel members, identify the best person to assign this task to. This is often the person being asked a question, who is mentioned by name, or who volunteers.
- **Suggested Project:** From the provided list of projects, determine the most relevant project for this task based on the conversation's context.
- **Due Date:** If the conversation mentions a deadline (e.g., "by Friday," "end of day," "next week"), infer the specific date and provide it in ISO format.
- **Priority:** Based on the language used (e.g., "ASAP," "urgent," "blocker"), suggest a priority level. Default to 'Medium' if no urgency is implied.

Here are the available channel members:
{{{JSON.stringify channelMembers}}}

Here are the available projects:
{{{JSON.stringify projects}}}

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

'use server';
/**
 * @fileOverview Suggests a lucide-react icon for a given library name.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestLibraryIconInputSchema = z.string().describe("The name of the library.");
export type SuggestLibraryIconInput = z.infer<typeof SuggestLibraryIconInputSchema>;

const SuggestLibraryIconOutputSchema = z.object({
  iconName: z.string().describe("The name of a single suitable icon from the lucide-react library, in PascalCase. E.g., 'BookOpen', 'FileText', 'Briefcase'."),
});
export type SuggestLibraryIconOutput = z.infer<typeof SuggestLibraryIconOutputSchema>;

const availableIcons = [
  'Book', 'BookOpen', 'Folder', 'Users', 'Settings', 'DollarSign', 'Briefcase',
  'HelpCircle', 'MessageSquare', 'Code', 'Database', 'GitBranch', 'FileText',
  'Archive', 'Inbox', 'Shield', 'Globe', 'Home', 'Rocket', 'Lightbulb', 'Server',
  'Cloud', 'Component', 'Package', 'Puzzle', 'Heart'
];

export async function suggestLibraryIcon(name: SuggestLibraryIconInput): Promise<SuggestLibraryIconOutput> {
  return suggestLibraryIconFlow(name);
}

const prompt = ai.definePrompt({
  name: 'suggestLibraryIconPrompt',
  input: {schema: SuggestLibraryIconInputSchema},
  output: {schema: SuggestLibraryIconOutputSchema},
  prompt: `You are an expert at selecting the perfect icon for a given name.
Given the library name "{{{input}}}", choose the single best icon name from the following list.
The icon name must be one of these exact values, in PascalCase.

Available icons: ${availableIcons.join(', ')}

Return only the JSON object with the "iconName" key.`,
});

const suggestLibraryIconFlow = ai.defineFlow(
  {
    name: 'suggestLibraryIconFlow',
    inputSchema: SuggestLibraryIconInputSchema,
    outputSchema: SuggestLibraryIconOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

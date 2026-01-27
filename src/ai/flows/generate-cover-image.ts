'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateCoverImageInputSchema = z.string().describe('A text prompt for generating a cover image.');
export type GenerateCoverImageInput = z.infer<typeof GenerateCoverImageInputSchema>;

const GenerateCoverImageOutputSchema = z.object({
    imageUrl: z.string().describe("The generated image as a data URI."),
});
export type GenerateCoverImageOutput = z.infer<typeof GenerateCoverImageOutputSchema>;

export async function generateCoverImage(prompt: GenerateCoverImageInput): Promise<GenerateCoverImageOutput> {
    return generateCoverImageFlow(prompt);
}

const generateCoverImageFlow = ai.defineFlow(
  {
    name: 'generateCoverImageFlow',
    inputSchema: GenerateCoverImageInputSchema,
    outputSchema: GenerateCoverImageOutputSchema,
  },
  async (prompt) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `A professional, abstract, high-resolution cover image for a knowledge base. The image should be visually appealing as a background. Prompt: ${prompt}`,
    });
    if (!media?.url) {
        throw new Error('Image generation failed.');
    }
    return { imageUrl: media.url };
  }
);

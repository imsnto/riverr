import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-project-from-meeting.ts';
import '@/ai/flows/create-task-from-thread.ts';
import '@/ai/flows/assist-in-document.ts';
import '@/ai/flows/generate-cover-image.ts';
import '@/ai/flows/distill-support-intent.ts';
import '@/ai/flows/distill-sales-intelligence.ts';
import '@/ai/flows/summarize-sales-cluster.ts';
import '@/ai/flows/recommend-next-sales-action.ts';

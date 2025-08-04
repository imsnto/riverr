
'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminMappings, SlackMeetingLog, Project, User } from '@/lib/data';
import { Bot, Calendar, Clock, Loader2, Tag } from 'lucide-react';
import { suggestProjectFromMeeting } from '@/ai/flows/suggest-project-from-meeting';
import { useToast } from '@/hooks/use-toast';

interface SuggestionState {
  [key: string]: {
    loading: boolean;
    suggestion?: {
      suggestedProjectId?: string;
      reason: string;
    };
    error?: string;
  };
}

interface MeetingReviewProps {
  slackMeetingLogs: SlackMeetingLog[];
  projects: Project[];
  allUsers: User[];
}

export default function MeetingReview({ slackMeetingLogs, projects, allUsers }: MeetingReviewProps) {
  const unassignedMeetings = slackMeetingLogs.filter(log => !log.project_id);
  const [suggestions, setSuggestions] = useState<SuggestionState>({});
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSuggest = (meeting: SlackMeetingLog) => {
    setSuggestions(prev => ({ ...prev, [meeting.id]: { loading: true } }));

    startTransition(async () => {
      try {
        const result = await suggestProjectFromMeeting({
          channelName: meeting.channel_name,
          adminMappings,
        });
        setSuggestions(prev => ({ ...prev, [meeting.id]: { loading: false, suggestion: result } }));
      } catch (error) {
        setSuggestions(prev => ({ ...prev, [meeting.id]: { loading: false, error: 'Failed to get suggestion.' } }));
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch project suggestion.',
        });
      }
    });
  };

  const handleAssign = (meetingId: string, projectId: string) => {
    console.log(`Assigning meeting ${meetingId} to project ${projectId}`);
    toast({
      title: "Project Assigned",
      description: "The meeting has been successfully assigned."
    });
  };

  if (unassignedMeetings.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Slack Meetings</CardTitle>
        <CardDescription>Assign projects to your unlogged meetings from Slack.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {unassignedMeetings.map(meeting => {
          const user = allUsers.find(u => u.id === meeting.user_id);
          const suggestionState = suggestions[meeting.id];

          return (
            <div key={meeting.id} className="flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <p className="font-semibold">Meeting in #{meeting.channel_name}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(meeting.meeting_start).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{meeting.duration} hr{meeting.duration > 1 ? 's' : ''}</span>
                  </div>
                  {user && (
                    <div className="flex items-center gap-1.5">
                      <img src={user.avatarUrl} alt={user.name} className="h-4 w-4 rounded-full" />
                      <span>{user.name}</span>
                    </div>
                  )}
                </div>
                 {suggestionState?.suggestion && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-primary/5 p-2 text-sm text-primary">
                    <Bot className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <p>
                      <span className="font-semibold">AI Suggestion:</span> {suggestionState.suggestion.reason}
                    </p>
                  </div>
                )}
                 {suggestionState?.error && (
                  <p className="mt-2 text-sm text-destructive">{suggestionState.error}</p>
                )}
              </div>
              <div className="flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                <Select
                  onValueChange={(projectId) => handleAssign(meeting.id, projectId)}
                  defaultValue={suggestionState?.suggestion?.suggestedProjectId}
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Assign Project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleSuggest(meeting)}
                  disabled={isPending || suggestionState?.loading}
                  aria-label="Suggest Project"
                >
                  {suggestionState?.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

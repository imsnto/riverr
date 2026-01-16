'use client';

import { HelpCenterArticle } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface HelpCenterArticleListProps {
  articles: HelpCenterArticle[];
  onSelectArticle: (articleId: string) => void;
}

export default function HelpCenterArticleList({ articles, onSelectArticle }: HelpCenterArticleListProps) {
  return (
    <div className="space-y-4">
      {articles.map(article => (
        <Card key={article.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectArticle(article.id)}>
          <CardHeader>
            <CardTitle className="text-lg flex justify-between items-center">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                {article.title}
              </span>
              <Badge variant={article.status === 'published' ? 'default' : 'secondary'} className={article.status === 'published' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                {article.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Updated {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      ))}
      {articles.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-foreground">No articles found</h3>
          <p className="mt-1 text-sm text-muted-foreground">There are no articles in this view. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}

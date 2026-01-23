'use client';

import { HelpCenter, HelpCenterArticle, HelpCenterCollection } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { Folder, FileText, Lock, Globe } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';

interface HelpCenterArticleListProps {
  items: (HelpCenterArticle | HelpCenterCollection)[];
  helpCenters: HelpCenter[];
  onSelectItem: (id: string, type: 'article' | 'collection') => void;
  selectedItems: string[];
  onToggleSelectItem: (id: string) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
}

export default function HelpCenterArticleList({ 
  items, 
  helpCenters,
  onSelectItem, 
  selectedItems,
  onToggleSelectItem,
  onToggleAll,
  isAllSelected
}: HelpCenterArticleListProps) {

  const getItemType = (item: HelpCenterArticle | HelpCenterCollection): 'article' | 'collection' => {
    return 'title' in item ? 'article' : 'collection';
  }

  const renderType = (item: HelpCenterArticle | HelpCenterCollection) => {
    const type = getItemType(item);
    if (type === 'collection') {
        return <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-muted-foreground" /> Folder</div>;
    }
    
    const article = item as HelpCenterArticle;
    switch(article.type) {
        case 'pdf': return <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> PDF</div>;
        case 'snippet': return <Badge variant="outline">Snippet</Badge>;
        case 'article': 
        default:
            return <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Article</div>
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox checked={isAllSelected} onCheckedChange={onToggleAll} />
          </TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Audience</TableHead>
          <TableHead>Last updated</TableHead>
          <TableHead>Help Center</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => {
          const type = getItemType(item);
          return (
            <TableRow key={item.id}>
              <TableCell>
                <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => onToggleSelectItem(item.id)} />
              </TableCell>
              <TableCell>
                <Button variant="link" className="p-0 h-auto font-semibold" onClick={() => onSelectItem(item.id, type)}>
                  {type === 'collection' ? item.name : (item as HelpCenterArticle).title}
                </Button>
              </TableCell>
              <TableCell>{renderType(item)}</TableCell>
              <TableCell>
                {type === 'article' ? (
                    (item as HelpCenterArticle).isPublic === false ? (
                        <Badge variant="secondary" className="flex items-center gap-1.5"><Lock className="h-3 w-3" />Private</Badge>
                    ) : (
                        <Badge variant="outline" className="flex items-center gap-1.5"><Globe className="h-3 w-3" />Public</Badge>
                    )
                ) : (
                    '—'
                )}
              </TableCell>
              <TableCell>
                {('updatedAt' in item && item.updatedAt) ? 
                  formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : 
                  '—'
                }
              </TableCell>
              <TableCell>
                {item.helpCenterIds && item.helpCenterIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                        {item.helpCenterIds.map(hcId => {
                            const hc = helpCenters.find(h => h.id === hcId);
                            return hc ? <Badge key={hc.id} variant="secondary">{hc.name}</Badge> : null;
                        })}
                    </div>
                ) : (
                    '—'
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  );
}

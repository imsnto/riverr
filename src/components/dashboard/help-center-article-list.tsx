
'use client';

import { HelpCenter, HelpCenterArticle, HelpCenterCollection } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { Folder, FileText, Lock, Globe, GitBranch, Bot, Circle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';

interface HelpCenterArticleListProps {
  items: (HelpCenterArticle | HelpCenterCollection)[];
  helpCenters: HelpCenter[];
  onSelectItem: (id: string, type: 'article' | 'collection') => void;
  selectedItems: string[];
  onToggleSelectItem: (id: string) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
  isMobile: boolean;
}

export default function HelpCenterArticleList({ 
  items, 
  helpCenters,
  onSelectItem, 
  selectedItems,
  onToggleSelectItem,
  onToggleAll,
  isAllSelected,
  isMobile
}: HelpCenterArticleListProps) {

  const getItemType = (item: HelpCenterArticle | HelpCenterCollection): 'article' | 'collection' => {
    return 'title' in item ? 'article' : 'collection';
  }

  const renderType = (item: HelpCenterArticle | HelpCenterCollection) => {
    const type = getItemType(item);
    if (type === 'collection') {
        return <div className="flex items-center gap-2"><Folder className="h-4 w-4 text-muted-foreground" /> Collection</div>;
    }
    
    const article = item as HelpCenterArticle;
    switch(article.type) {
        case 'pdf': return <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> PDF</div>;
        case 'snippet': return <Badge variant="outline">Snippet</Badge>;
        case 'playbook': return <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-muted-foreground" /> Playbook</div>;
        case 'article': 
        default:
            return <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Article</div>
    }
  }

  if (isMobile) {
    return (
      <div className="space-y-2">
        <div className="flex items-center px-2 py-2">
          <Checkbox checked={isAllSelected} onCheckedChange={onToggleAll} id="select-all-mobile"/>
          <Label htmlFor="select-all-mobile" className="ml-3 text-sm font-medium text-muted-foreground">Select All</Label>
        </div>
        <Separator />
        <div className="divide-y divide-border">
          {items.map(item => {
            const type = getItemType(item);
            const name = type === 'collection' ? item.name : (item as HelpCenterArticle).title;
            return (
              <div key={item.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50" onClick={() => onSelectItem(item.id, type)}>
                 <Checkbox
                    className="mt-1 flex-shrink-0"
                    checked={selectedItems.includes(item.id)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectItem(item.id);
                    }}
                 />
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{name || "Untitled Article"}</p>
                    <div className="text-sm text-muted-foreground mt-1">
                        {renderType(item)}
                    </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox checked={isAllSelected} onCheckedChange={onToggleAll} />
          </TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Library</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => {
          const type = getItemType(item);
          const name = type === 'collection' ? item.name : ((item as HelpCenterArticle).title || "Untitled Article");
          const status = 'status' in item ? item.status : 'N/A';
          const kb = 'helpCenterId' in item ? helpCenters.find(hc => hc.id === item.helpCenterId) : null;


          return (
            <TableRow key={item.id}>
              <TableCell>
                <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => onToggleSelectItem(item.id)} />
              </TableCell>
              <TableCell>
                <Button variant="link" className="p-0 h-auto font-semibold text-foreground hover:text-primary" onClick={() => onSelectItem(item.id, type)}>
                  {name}
                </Button>
              </TableCell>
              <TableCell>
                {kb ? <Badge variant="secondary">{kb.name}</Badge> : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                {status !== 'N/A' && (
                  status === 'published' ? (
                    <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20">
                      <Circle className="mr-2 h-2 w-2 fill-current text-emerald-400" />
                      Published
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-500/10 text-zinc-300 border border-zinc-500/20 hover:bg-zinc-500/20">
                      <Circle className="mr-2 h-2 w-2 fill-current text-zinc-400" />
                      Draft
                    </Badge>
                  )
                )}
              </TableCell>
              <TableCell>
                {('updatedAt' in item && item.updatedAt) ? 
                  formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : 
                  '—'
                }
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  );
}

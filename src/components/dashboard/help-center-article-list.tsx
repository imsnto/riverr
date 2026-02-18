
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
        return <div className="flex items-center gap-2"><Folder className="h-3.5 w-3.5 text-muted-foreground" /> Collection</div>;
    }
    
    const article = item as HelpCenterArticle;
    switch(article.type) {
        case 'pdf': return <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> PDF</div>;
        case 'snippet': return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Snippet</Badge>;
        case 'playbook': return <div className="flex items-center gap-2"><GitBranch className="h-3.5 w-3.5 text-muted-foreground" /> Playbook</div>;
        case 'article': 
        default:
            return <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> Article</div>
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
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50" onClick={() => onSelectItem(item.id, type)}>
                 <Checkbox
                    className="mt-1 flex-shrink-0"
                    checked={selectedItems.includes(item.id)}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectItem(item.id);
                    }}
                 />
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{name || "Untitled Article"}</p>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
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
    <div className="w-full overflow-hidden">
        <Table>
        <TableHeader>
            <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[40px] px-2">
                <Checkbox checked={isAllSelected} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">Title</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">Library</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">Status</TableHead>
            <TableHead className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 text-right">Last updated</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {items.map(item => {
            const type = getItemType(item);
            const name = type === 'collection' ? item.name : ((item as HelpCenterArticle).title || "Untitled Article");
            const status = 'status' in item ? item.status : 'N/A';
            const kb = 'helpCenterId' in item ? helpCenters.find(hc => hc.id === item.helpCenterId) : null;

            return (
                <TableRow key={item.id} className="h-14 transition-colors group">
                <TableCell className="px-2 py-0">
                    <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => onToggleSelectItem(item.id)} />
                </TableCell>
                <TableCell className="py-0">
                    <button 
                        className="text-xs font-medium hover:text-primary transition-colors text-left truncate max-w-[300px]" 
                        onClick={() => onSelectItem(item.id, type)}
                    >
                    {name}
                    </button>
                </TableCell>
                <TableCell className="py-0">
                    {kb ? <Badge variant="secondary" className="text-[9px] font-medium h-4 px-1">{kb.name}</Badge> : <span className="text-muted-foreground text-[10px]">—</span>}
                </TableCell>
                <TableCell className="py-0">
                    {status !== 'N/A' && (
                    status === 'published' ? (
                        <div className="flex items-center text-[10px] text-emerald-500 font-semibold">
                        <Circle className="mr-1 h-1 w-1 fill-current" />
                        Published
                        </div>
                    ) : (
                        <div className="flex items-center text-[10px] text-muted-foreground font-semibold">
                        <Circle className="mr-1 h-1 w-1 fill-current" />
                        Draft
                        </div>
                    )
                    )}
                </TableCell>
                <TableCell className="py-0 text-right text-[10px] text-muted-foreground whitespace-nowrap">
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
    </div>
  );
}

// src/app/hc/[hcId]/articles/[articleId]/page.tsx
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenter, HelpCenterArticle, HelpCenterCollection, User } from '@/lib/data';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import React from 'react';

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

async function getArticleData(articleId: string) {
    const articleRef = adminDB.collection('help_center_articles').doc(articleId);
    const articleSnap = await articleRef.get();

    if (!articleSnap.exists) {
        return null;
    }
    
    const article = { id: articleSnap.id, ...articleSnap.data() } as HelpCenterArticle;
    
    const [authorSnap, allCollectionsSnap] = await Promise.all([
        adminDB.collection('users').doc(article.authorId).get(),
        adminDB.collection('help_center_collections').get(),
    ]);

    const author = authorSnap.exists() ? { id: authorSnap.id, ...authorSnap.data() } as User : null;
    
    const allCollections = allCollectionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
    
    const breadcrumbs: HelpCenterCollection[] = [];
    let currentFolderId = article.folderId;
    while(currentFolderId) {
        const folder = allCollections.find(c => c.id === currentFolderId);
        if (folder) {
            breadcrumbs.unshift(folder);
            currentFolderId = folder.parentId;
        } else {
            currentFolderId = null;
        }
    }

    return { article, author, breadcrumbs };
}

export default async function ArticlePage({ params }: { params: { hcId: string; articleId: string } }) {
    const data = await getArticleData(params.articleId);

    if (!data) {
        return <div>Article not found.</div>;
    }

    const { article, author, breadcrumbs } = data;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <nav className="flex items-center text-sm text-muted-foreground mb-8">
                <Link href={`/hc/${params.hcId}`} className="hover:underline">Help Center</Link>
                {breadcrumbs.map(crumb => (
                     <React.Fragment key={crumb.id}>
                        <ChevronRight className="h-4 w-4 mx-1" />
                        <Link href={`/hc/${params.hcId}/collections/${crumb.id}`} className="hover:underline">{crumb.name}</Link>
                     </React.Fragment>
                ))}
            </nav>

            <article>
                <h1 className="text-4xl font-bold tracking-tight mb-4">{article.title}</h1>
                
                {author && (
                    <div className="flex items-center gap-3 mb-8 text-sm">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={author.avatarUrl} />
                            <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{author.name}</p>
                            <p className="text-muted-foreground">
                                Written on {format(parseISO(article.createdAt), 'MMMM d, yyyy')}
                            </p>
                        </div>
                    </div>
                )}
                
                <div
                    className="prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                />
            </article>
        </div>
    );
}

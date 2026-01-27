// src/app/hc/[hcId]/articles/[articleId]/page.tsx
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenterArticle, HelpCenterCollection, User } from '@/lib/data';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, parseISO } from 'date-fns';
import React from 'react';

const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

async function getArticleData(articleId: string) {
    const articleRef = adminDB.collection('help_center_articles').doc(articleId);
    const articleSnap = await articleRef.get();

    if (!articleSnap.exists) {
        return null;
    }
    
    const article = { id: articleSnap.id, ...articleSnap.data() } as HelpCenterArticle;
    
    // TOC Generation
    const toc: { level: number; text: string; slug: string }[] = [];
    if (article.content) {
        const headingRegex = /<h([2-3])(.*?)>(.*?)<\/h\1>/gi; // Only h2 and h3
        article.content = article.content.replace(headingRegex, (match, level, attrs, innerText) => {
            const slug = innerText.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
            toc.push({ level: parseInt(level), text: innerText, slug });
            // Avoid adding id if one already exists
            if (attrs.includes('id=')) {
                return match;
            }
            return `<h${level} id="${slug}"${attrs}>${innerText}</h${level}>`;
        });
    }

    const [authorSnap, allCollectionsSnap] = await Promise.all([
        adminDB.collection('users').doc(article.authorId).get(),
        adminDB.collection('help_center_collections').get(),
    ]);

    const author = authorSnap.exists ? { id: authorSnap.id, ...authorSnap.data() } as User : null;
    
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

    return { article, author, breadcrumbs, toc };
}

export default async function ArticlePage({ params }: { params: { hcId: string; articleId: string } }) {
    const data = await getArticleData(params.articleId);

    if (!data) {
        return <div>Article not found.</div>;
    }

    const { article, author, breadcrumbs, toc } = data;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <nav className="flex items-center text-sm text-muted-foreground mb-8">
                <Link href={`/hc/${params.hcId}`} className="hover:underline">All Collections</Link>
                {breadcrumbs.map(crumb => (
                     <React.Fragment key={crumb.id}>
                        <ChevronRight className="h-4 w-4 mx-1" />
                        <Link href={`/hc/${params.hcId}/collections/${crumb.id}`} className="hover:underline">{crumb.name}</Link>
                     </React.Fragment>
                ))}
            </nav>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-12">
                <article>
                    <header className="mb-8">
                        <h1 className="text-4xl font-bold tracking-tight mb-2">{article.title}</h1>
                        {article.subtitle && (
                            <p className="text-lg text-muted-foreground">{article.subtitle}</p>
                        )}
                        
                        {author && (
                            <div className="flex items-center gap-3 mt-6 text-sm text-muted-foreground">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={author.avatarUrl} />
                                    <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p>Written by <span className="text-foreground font-semibold">{author.name}</span></p>
                                    <p>
                                        Updated {formatDistanceToNow(parseISO(article.updatedAt), { addSuffix: true })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </header>
                    
                    <div
                        className="prose max-w-none"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                    />
                </article>
                <aside className="hidden md:block">
                    <div className="sticky top-20">
                        <h3 className="font-semibold mb-4">On this page</h3>
                        <ul className="space-y-2 text-sm border-l">
                            {toc.map(item => (
                                <li key={item.slug} style={{ paddingLeft: `${(item.level - 1) * 1}rem`}}>
                                    <a href={`#${item.slug}`} className="block pl-4 text-muted-foreground hover:text-foreground hover:border-primary border-l-2 border-transparent transition-colors">{item.text}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}

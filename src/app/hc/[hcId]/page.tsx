// src/app/hc/[hcId]/page.tsx
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle, User } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Book, Settings, Bot, ChevronsRight, Users, BookOpen } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import React from 'react';

async function getHelpCenterData(hcId: string) {
    const hcRef = adminDB.collection('help_centers').doc(hcId);
    const collectionsRef = adminDB.collection('help_center_collections').where('helpCenterIds', 'array-contains', hcId);
    const articlesRef = adminDB.collection('help_center_articles').where('helpCenterIds', 'array-contains', hcId);
    
    const [hcSnap, collectionsSnap, articlesSnap] = await Promise.all([
        hcRef.get(),
        collectionsRef.get(),
        articlesRef.get(),
    ]);

    if (!hcSnap.exists) {
        return null;
    }

    const helpCenter = { id: hcSnap.id, ...hcSnap.data() } as HelpCenter;
    const collections = collectionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
    const articles = articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
    
    // For simplicity, I'll mock author counts. In a real app, you'd fetch users.
    const allUsers: User[] = []; // fetch all users if needed for author counts

    const collectionsWithCounts = collections.map(collection => {
        const articlesInCollection = articles.filter(a => a.folderId === collection.id);
        const authorIds = new Set(articlesInCollection.map(a => a.authorId));
        return {
            ...collection,
            articleCount: articlesInCollection.length,
            authorCount: authorIds.size,
        };
    });

    return { helpCenter, collections: collectionsWithCounts, articles };
}

// Map icons to collection names or IDs for a better look
const iconMap: { [key: string]: React.ReactNode } = {
  'default': <BookOpen className="h-6 w-6" />,
  'getting started': <Settings className="h-6 w-6" />,
  'fin ai agent': <Bot className="h-6 w-6" />,
  // Add more mappings as needed
};

const getIconForCollection = (name: string) => {
    const lowerName = name.toLowerCase();
    for (const key in iconMap) {
        if (lowerName.includes(key)) {
            return iconMap[key];
        }
    }
    return iconMap['default'];
};


export default async function HelpCenterPage({ params }: { params: { hcId: string } }) {
    const data = await getHelpCenterData(params.hcId);

    if (!data) {
        return <div className="text-center p-8">Help Center not found.</div>;
    }

    const { helpCenter, collections, articles } = data;
    const topLevelCollections = collections.filter(c => !c.parentId);
    const rootArticles = articles.filter(a => !a.folderId);
    const featuredLinks = topLevelCollections.slice(0, 5);

    const gridItems = [...topLevelCollections, ...rootArticles];

    return (
        <div className="bg-background text-foreground">
            {/* Hero Section */}
            <div className="relative h-64 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-center p-4">
                <Image
                    src="https://picsum.photos/seed/hchero/1600/400"
                    alt="Help Center background"
                    fill
                    className="object-cover opacity-20"
                    data-ai-hint="landscape painting"
                />
                <div className="relative z-10 w-full max-w-2xl">
                    <h1 className="text-4xl font-bold mb-4">Search for articles...</h1>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input placeholder="e.g., how to add a user" className="w-full h-12 pl-10 text-lg" />
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-8">
                 {/* Top Links */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6">Get the most out of {helpCenter.name}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                        {featuredLinks.map(collection => (
                            <Link key={collection.id} href={`/hc/${params.hcId}/collections/${collection.id}`} className="flex items-center justify-between p-3 rounded-md hover:bg-muted">
                                <span>{collection.name}</span>
                                <ChevronsRight className="h-4 w-4" />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Collection and Article Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gridItems.map(item => {
                         if ('articleCount' in item) {
                            const collection = item as (HelpCenterCollection & { articleCount: number; authorCount: number });
                            return (
                                <Link href={`/hc/${params.hcId}/collections/${collection.id}`} key={collection.id}>
                                    <Card className="hover:shadow-lg transition-shadow h-full">
                                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                            <div className="bg-muted p-3 rounded-lg">
                                                {getIconForCollection(collection.name)}
                                            </div>
                                            <CardTitle className="text-lg">{collection.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center text-sm text-muted-foreground gap-2">
                                                <Users className="h-4 w-4"/> 
                                                <span>{collection.authorCount} authors</span>
                                                <span>•</span>
                                                <span>{collection.articleCount} articles</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                         } else {
                            const article = item as HelpCenterArticle;
                            return (
                                <Link href={`/hc/${params.hcId}/articles/${article.id}`} key={article.id}>
                                    <Card className="hover:shadow-lg transition-shadow h-full">
                                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                            <div className="bg-muted p-3 rounded-lg">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <CardTitle className="text-lg">{article.title}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground line-clamp-2">{article.subtitle || 'Click to read more...'}</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            )
                         }
                    })}
                </div>
            </main>
        </div>
    );
}

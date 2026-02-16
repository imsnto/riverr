// src/app/hc/[hcId]/collections/[collectionId]/page.tsx
import { adminDB } from '@/lib/firebase-admin';
import { HelpCenter, HelpCenterCollection, HelpCenterArticle } from '@/lib/data';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronRight, FileText, Folder } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import React from 'react';


async function getCollectionData(hcId: string, collectionId: string) {
    const hcRef = adminDB.collection('help_centers').doc(hcId);
    const collectionRef = adminDB.collection('help_center_collections').doc(collectionId);
    
    const [hcSnap, collectionSnap] = await Promise.all([
        hcRef.get(),
        collectionRef.get(),
    ]);

    if (!hcSnap.exists || !collectionSnap.exists) {
        return null;
    }

    const helpCenter = { id: hcSnap.id, ...hcSnap.data() } as HelpCenter;
    const collection = { id: collectionSnap.id, ...collectionSnap.data() } as HelpCenterCollection;

    if (!helpCenter.hubId) {
        return null; // Or handle error
    }

    // Now fetch related data based on the hubId
    const allCollectionsRef = adminDB.collection('help_center_collections').where('hubId', '==', helpCenter.hubId);
    const articlesRef = adminDB.collection('help_center_articles').where('folderId', '==', collectionId);

    const [allCollectionsSnap, articlesSnap] = await Promise.all([
        allCollectionsRef.get(),
        articlesRef.get(),
    ]);

    const articles = articlesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterArticle));
    const allCollections = allCollectionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpCenterCollection));
    
    const breadcrumbs: HelpCenterCollection[] = [];
    let current: HelpCenterCollection | undefined = collection;
    while(current) {
        breadcrumbs.unshift(current);
        current = allCollections.find(c => c.id === current?.parentId);
    }
    
    const subCollections = allCollections.filter(c => c.parentId === collectionId);

    return { helpCenter, collection, articles, breadcrumbs, subCollections };
}


export default async function CollectionPage({ params }: { params: { hcId: string; collectionId: string } }) {
    const data = await getCollectionData(params.hcId, params.collectionId);

    if (!data) {
        return <div className="text-center p-8">Collection not found.</div>;
    }
    
    const { helpCenter, collection, articles, breadcrumbs, subCollections } = data;

    return (
        <div>
             {/* Hero Section */}
            <div className="relative h-48 bg-zinc-100 dark:bg-zinc-800 flex items-end p-8 text-left">
                <Image
                    src="https://picsum.photos/seed/hchero/1600/400"
                    alt="Help Center background"
                    fill
                    className="object-cover opacity-20"
                    data-ai-hint="landscape painting"
                />
                <div className="relative z-10 w-full max-w-5xl mx-auto">
                    <nav className="flex items-center text-sm text-muted-foreground mb-4">
                        <Link href={`/hc/${helpCenter.id}`} className="hover:underline">{helpCenter.name}</Link>
                        {breadcrumbs.map(crumb => (
                             <React.Fragment key={crumb.id}>
                                <ChevronRight className="h-4 w-4 mx-1" />
                                <Link href={`/hc/${params.hcId}/collections/${crumb.id}`} className="hover:underline">{crumb.name}</Link>
                             </React.Fragment>
                        ))}
                    </nav>
                     <h1 className="text-4xl font-bold">{collection.name}</h1>
                </div>
            </div>
            
            <main className="max-w-5xl mx-auto p-8">
                 <div className="relative mb-8 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search in this collection..." className="w-full h-11 pl-10" />
                </div>
                
                <ul className="space-y-4">
                    {subCollections.map(sub => (
                        <li key={sub.id}>
                            <Link href={`/hc/${params.hcId}/collections/${sub.id}`} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors">
                                <Folder className="h-6 w-6 text-primary" />
                                <div>
                                    <h3 className="font-semibold">{sub.name}</h3>
                                    <p className="text-sm text-muted-foreground">{sub.description}</p>
                                </div>
                            </Link>
                        </li>
                    ))}
                    {articles.map(article => (
                        <li key={article.id}>
                            <Link href={`/hc/${params.hcId}/articles/${article.id}`} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                                <div>
                                    <h3 className="font-semibold">{article.title}</h3>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </main>
        </div>
    );
}

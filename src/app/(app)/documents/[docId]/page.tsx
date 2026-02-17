
// src/app/(app)/documents/[docId]/page.tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { getDocument, getAllUsers, updateDocument, deleteDocument, getDocumentsInHub } from '@/lib/db';
import { Document, User } from '@/lib/data';
import React, { useState, useEffect } from 'react';
import DocumentEditor from '@/components/dashboard/document-editor';
import { useRouter, useParams } from 'next/navigation';
import { ContentSkeleton } from '@/components/dashboard/content-skeleton';

export default function DocumentPage() {
    const params = useParams() as { docId: string };
    const { docId } = params;
    const { appUser, userSpaces } = useAuth();
    const router = useRouter();

    const [document, setDocument] = useState<Document | null>(null);
    const [allDocuments, setAllDocuments] = useState<Document[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!appUser || userSpaces.length === 0) {
            return;
        }

        const fetchDoc = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const docData = await getDocument(docId);
                
                if (docData) {
                    const userIsInSpace = userSpaces.some(space => space.id === docData.spaceId);
                    const userHasAccess = docData.isPublic || (docData.allowedUserIds && docData.allowedUserIds.includes(appUser.id));

                    if (userIsInSpace && userHasAccess) {
                        const [usersData, hubDocuments] = await Promise.all([
                            getAllUsers(),
                            getDocumentsInHub(docData.hubId),
                        ]);
                        setDocument(docData);
                        setAllUsers(usersData);
                        setAllDocuments(hubDocuments);
                    } else {
                        setError("You don't have permission to view this document.");
                    }
                } else {
                    setError("Document not found.");
                }
            } catch (err) {
                console.error("Error fetching document:", err);
                setError("Failed to load the document.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDoc();
    }, [docId, appUser, userSpaces]);

    const handleSave = async (doc: Document) => {
        // This function is passed to the editor to persist changes.
        await updateDocument(doc.id, doc);
        // We update the state here to ensure the parent component is aware of the latest version,
        // although the editor primarily manages its own state during an editing session.
        setDocument(doc);
    };
    
    const handleDelete = async (id: string) => {
        await deleteDocument(id);
        router.push('/?view=documents');
    };

    if (isLoading) {
        return <ContentSkeleton />;
    }

    if (error) {
        return <div className="flex h-screen items-center justify-center text-destructive">{error}</div>;
    }

    if (!document) {
        return <div className="flex h-screen items-center justify-center">Document not found or access denied.</div>;
    }

    return (
        <DocumentEditor
            initialDocument={document}
            docId={docId}
            allUsers={allUsers}
            allDocuments={allDocuments}
            onSave={handleSave}
            onDelete={handleDelete}
        />
    );
}

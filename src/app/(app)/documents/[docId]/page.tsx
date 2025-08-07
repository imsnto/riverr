
// src/app/(app)/documents/[docId]/page.tsx
'use client';
import { useAuth } from '@/hooks/use-auth';
import { getDocument, getAllUsers, updateDocument, deleteDocument } from '@/lib/db';
import { Document, User } from '@/lib/data';
import React, { useState, useEffect } from 'react';
import DocumentEditor from '@/components/dashboard/document-editor';

const LoadingState = () => (
    <div className="flex h-screen items-center justify-center">
        <p>Loading document...</p>
    </div>
);

interface DocumentPageProps {
  params: {
    docId: string;
  };
}

export default function DocumentPage({ params }: DocumentPageProps) {
    const { docId } = params;
    const { appUser, userSpaces } = useAuth();

    const [document, setDocument] = useState<Document | null>(null);
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
                const [docData, usersData] = await Promise.all([
                    getDocument(docId),
                    getAllUsers()
                ]);
                
                if (docData) {
                    const userHasAccess = userSpaces.some(space => space.id === docData.spaceId && space.members[appUser.id]);
                    if (userHasAccess) {
                        setDocument(docData);
                        setAllUsers(usersData);
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
        await updateDocument(doc.id, doc);
        setDocument(doc);
    };
    
    const handleDelete = async (id: string) => {
        await deleteDocument(id);
    };

    if (isLoading) {
        return <LoadingState />;
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
            allUsers={allUsers}
            onSave={handleSave}
            onDelete={handleDelete}
        />
    );
}

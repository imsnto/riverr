'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contact } from '@/lib/data';
import * as db from '@/lib/db';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import CreateContactDialog from './create-contact-dialog';

interface ContactComboboxProps {
  contacts: Contact[];
  value: string | null;
  onChange: (contactId: string | null) => void;
  onDataRefresh: () => void;
}

export default function ContactCombobox({ contacts, value, onChange, onDataRefresh }: ContactComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { activeSpace, appUser } = useAuth();
  const { toast } = useToast();

  const selectedContact = contacts.find(c => c.id === value);

  const recentContacts = useMemo(() => {
    return [...contacts]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [contacts]);
  
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return [];
    const lowercasedQuery = searchQuery.toLowerCase();
    return contacts.filter(contact => 
      contact.name?.toLowerCase().includes(lowercasedQuery) || 
      contact.primaryEmail?.toLowerCase().includes(lowercasedQuery)
    );
  }, [contacts, searchQuery]);

  const handleSelect = (contactId: string | null) => {
    onChange(contactId);
    setOpen(false);
  };
  
  const handleCreateNew = () => {
    setOpen(false);
    setIsCreateDialogOpen(true);
  }
  
  const handleSaveNewContact = async (values: { name?: string; company?: string; email?: string; phone?: string; }) => {
    if (!activeSpace || !appUser) return;
    
    const now = new Date();
    const newContactData: Omit<Contact, 'id'> = {
        spaceId: activeSpace.id,
        name: values.name || null,
        company: values.company || null,
        emails: values.email ? [values.email.toLowerCase()] : [],
        phones: values.phone ? [values.phone] : [],
        primaryEmail: values.email ? values.email.toLowerCase() : null,
        primaryPhone: values.phone || null,
        source: 'manual',
        externalIds: {},
        tags: [],
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        lastMessageAt: null,
        lastOrderAt: null,
        lastCallAt: null,
        mergeParentId: null,
        isMerged: false,
    };
    
    try {
        const newContact = await db.addContact(newContactData);
        await db.addContactEvent(newContact.id, {
            type: 'identity_added',
            summary: `Contact created manually by ${appUser.name}.`,
            timestamp: new Date(),
            ref: { createdBy: appUser.id },
        });

        toast({ title: "Contact Created", description: `${values.name || 'New contact'} has been added.` });
        onDataRefresh(); // Refresh the main contact list
        onChange(newContact.id); // Select the new contact
    } catch (e) {
        toast({ variant: 'destructive', title: 'Failed to create contact.' });
    }
  };


  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedContact
              ? selectedContact.name || selectedContact.primaryEmail
              : "Select a contact..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput 
              placeholder="Search by name or email..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No contact found.</CommandEmpty>

              {searchQuery.length === 0 && (
                <CommandGroup heading="Recent Contacts">
                  {recentContacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.name}-${contact.primaryEmail}`}
                      onSelect={() => handleSelect(contact.id)}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", value === contact.id ? "opacity-100" : "opacity-0")}
                      />
                      <div>
                        <p>{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.primaryEmail}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              
              <CommandGroup heading={searchQuery.length > 0 ? "Search Results" : "All Contacts"}>
                {filteredContacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={`${contact.name}-${contact.primaryEmail}`}
                    onSelect={() => handleSelect(contact.id)}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === contact.id ? "opacity-100" : "opacity-0")}
                    />
                     <div>
                        <p>{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.primaryEmail}</p>
                      </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              {searchQuery.length > 0 && (
                 <CommandItem onSelect={handleCreateNew} className="text-primary hover:!bg-primary/10">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Create new contact: "{searchQuery}"
                </CommandItem>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <CreateContactDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleSaveNewContact}
      />
    </>
  );
}

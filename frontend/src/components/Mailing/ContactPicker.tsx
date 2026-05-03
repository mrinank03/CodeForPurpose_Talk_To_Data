import React, { useState, useEffect } from 'react';
import { X, Search, Users, Mail, Check, Loader2 } from 'lucide-react';
import { MailingGroup, MailingContact } from '../../types/mailing';
import { getGroups, getAllContacts, getGroupContacts } from '../../services/mailingApi';

interface ContactPickerProps {
  onClose: () => void;
  onConfirm: (emails: string[]) => void;
  initialSelectedEmails?: string[];
}

export const ContactPicker: React.FC<ContactPickerProps> = ({ onClose, onConfirm, initialSelectedEmails = [] }) => {
  const [groups, setGroups] = useState<MailingGroup[]>([]);
  const [contacts, setContacts] = useState<MailingContact[]>([]);
  const [groupMemberships, setGroupMemberships] = useState<Record<string, MailingContact[]>>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set(initialSelectedEmails.filter(e => e.trim())));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [groupsData, contactsData] = await Promise.all([
        getGroups(),
        getAllContacts()
      ]);
      setGroups(groupsData);
      setContacts(contactsData);

      // Fetch contacts for each group to allow group-level selection
      const memberships: Record<string, MailingContact[]> = {};
      await Promise.all(groupsData.map(async (g) => {
        const members = await getGroupContacts(g.group_id);
        memberships[g.group_id] = members;
      }));
      setGroupMemberships(memberships);
      
    } catch (err) {
      console.error("Failed to load contacts", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEmail = (email: string) => {
    const next = new Set(selectedEmails);
    if (next.has(email)) {
      next.delete(email);
    } else {
      next.add(email);
    }
    setSelectedEmails(next);
  };

  const toggleGroup = (groupId: string) => {
    const members = groupMemberships[groupId] || [];
    const memberEmails = members.map(m => m.email);
    
    // Check if all members are currently selected
    const allSelected = memberEmails.length > 0 && memberEmails.every(e => selectedEmails.has(e));
    
    const next = new Set(selectedEmails);
    if (allSelected) {
      // Deselect all
      memberEmails.forEach(e => next.delete(e));
    } else {
      // Select all
      memberEmails.forEach(e => next.add(e));
    }
    setSelectedEmails(next);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfirm(Array.from(selectedEmails));
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[#0a0714] border border-white/10 w-full max-w-2xl h-[70vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-natwest-teal/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-natwest-teal" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white leading-none">Select Recipients</h2>
              <p className="text-xs text-white/50 mt-1">{selectedEmails.size} recipients selected</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/10 bg-black/20 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search groups, names, or emails..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-natwest-teal transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
            </div>
          ) : (
            <>
              {/* Groups Section */}
              {filteredGroups.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Mailing Groups</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredGroups.map(g => {
                      const members = groupMemberships[g.group_id] || [];
                      const memberEmails = members.map(m => m.email);
                      const allSelected = memberEmails.length > 0 && memberEmails.every(e => selectedEmails.has(e));
                      const someSelected = memberEmails.length > 0 && memberEmails.some(e => selectedEmails.has(e)) && !allSelected;

                      return (
                        <div 
                          key={g.group_id}
                          onClick={() => toggleGroup(g.group_id)}
                          className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                            allSelected ? 'bg-natwest-teal/20 border-natwest-teal/50' : 
                            someSelected ? 'bg-white/10 border-natwest-teal/30' : 
                            'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div>
                            <div className={`text-sm font-bold ${allSelected ? 'text-natwest-teal' : 'text-white/90'}`}>{g.name}</div>
                            <div className="text-xs text-white/40">{members.length} members</div>
                          </div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            allSelected ? 'bg-natwest-teal border-natwest-teal text-[#0a0714]' : 
                            someSelected ? 'bg-natwest-teal/50 border-natwest-teal text-[#0a0714]' :
                            'border-white/20'
                          }`}>
                            {(allSelected || someSelected) && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Individual Contacts Section */}
              {filteredContacts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Individual Contacts</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredContacts.map(c => {
                      const isSelected = selectedEmails.has(c.email);
                      return (
                        <div 
                          key={c.contact_id}
                          onClick={() => toggleEmail(c.email)}
                          className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                            isSelected ? 'bg-natwest-teal/20 border-natwest-teal/50' : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isSelected ? 'bg-natwest-teal text-[#0a0714]' : 'bg-white/10 text-white/50'
                            }`}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                              <div className={`text-sm font-bold truncate ${isSelected ? 'text-natwest-tealLight' : 'text-white/90'}`}>{c.name}</div>
                              <div className="text-xs text-white/40 truncate">{c.email}</div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 ${
                            isSelected ? 'bg-natwest-teal border-natwest-teal text-[#0a0714]' : 'border-white/20'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredGroups.length === 0 && filteredContacts.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">
                  No groups or contacts found matching "{searchQuery}"
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-white/50">
            {selectedEmails.size} recipient{selectedEmails.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2.5 bg-natwest-teal hover:bg-natwest-teal/80 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-natwest-teal/20"
            >
              Confirm Selection
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { X, Users, Mail, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { MailingGroup, MailingContact } from '../../types/mailing';
import {
  getGroups, createGroup, deleteGroup,
  getAllContacts, createContact, deleteContact,
  getGroupContacts, addContactToGroup, removeContactFromGroup
} from '../../services/mailingApi';

interface MailingListManagerProps {
  onClose: () => void;
}

export const MailingListManager: React.FC<MailingListManagerProps> = ({ onClose }) => {
  const [groups, setGroups] = useState<MailingGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  
  // Right pane state
  const [groupContacts, setGroupContacts] = useState<MailingContact[]>([]);
  const [allContacts, setAllContacts] = useState<MailingContact[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // Search existing contacts to add to group
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchAllContacts();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupContacts(selectedGroupId);
    } else {
      setGroupContacts([]);
    }
  }, [selectedGroupId]);

  const fetchGroups = async () => {
    try {
      const data = await getGroups();
      setGroups(data);
      if (data.length > 0 && !selectedGroupId) {
        setSelectedGroupId(data[0].group_id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllContacts = async () => {
    try {
      const data = await getAllContacts();
      setAllContacts(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchGroupContacts = async (groupId: string) => {
    try {
      const data = await getGroupContacts(groupId);
      setGroupContacts(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      const group = await createGroup({ name: newGroupName, description: newGroupDesc });
      setGroups([...groups, group]);
      setSelectedGroupId(group.group_id);
      setIsCreatingGroup(false);
      setNewGroupName('');
      setNewGroupDesc('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteGroup(groupId);
      setGroups(groups.filter(g => g.group_id !== groupId));
      if (selectedGroupId === groupId) setSelectedGroupId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateAndAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !newContactEmail.trim() || !newContactName.trim()) return;
    
    try {
      // 1. Create or update contact globally
      const contact = await createContact({ name: newContactName, email: newContactEmail });
      
      // 2. Add to current group
      await addContactToGroup(selectedGroupId, contact.contact_id);
      
      // Refresh
      await fetchGroupContacts(selectedGroupId);
      await fetchAllContacts();
      
      setIsAddingContact(false);
      setNewContactName('');
      setNewContactEmail('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddExistingContact = async (contactId: string) => {
    if (!selectedGroupId) return;
    try {
      await addContactToGroup(selectedGroupId, contactId);
      await fetchGroupContacts(selectedGroupId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!selectedGroupId) return;
    try {
      await removeContactFromGroup(selectedGroupId, contactId);
      setGroupContacts(groupContacts.filter(c => c.contact_id !== contactId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Filter existing contacts that aren't already in the group
  const availableContacts = allContacts.filter(
    c => !groupContacts.find(gc => gc.contact_id === c.contact_id) && 
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedGroup = groups.find(g => g.group_id === selectedGroupId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0a0714] border border-white/10 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-natwest-primary/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-natwest-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white leading-none">Mailing Lists</h2>
              <p className="text-xs text-white/50 mt-1">Manage groups and contacts for report distribution</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Pane - Groups */}
          <div className="w-1/3 border-r border-white/10 flex flex-col bg-[#0a0714]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider">Groups</h3>
              <button 
                onClick={() => setIsCreatingGroup(true)}
                className="p-1.5 rounded-lg bg-natwest-primary hover:bg-natwest-primary/80 text-white transition-colors"
                title="Create Group"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
              {isCreatingGroup && (
                <form onSubmit={handleCreateGroup} className="p-3 bg-white/5 border border-natwest-primary/30 rounded-xl flex flex-col gap-3 mb-2 animate-in slide-in-from-top-2">
                  <input 
                    type="text" placeholder="Group Name (e.g., HR Team)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                    className="w-full bg-[#0a0714] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-natwest-primary outline-none" autoFocus required
                  />
                  <input 
                    type="text" placeholder="Description (optional)" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)}
                    className="w-full bg-[#0a0714] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-natwest-primary outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsCreatingGroup(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 bg-natwest-primary text-white text-xs font-bold rounded shadow-lg shadow-natwest-primary/20">Save</button>
                  </div>
                </form>
              )}

              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
              ) : groups.length === 0 && !isCreatingGroup ? (
                <div className="text-center py-8 text-white/30 text-sm">No groups created yet.</div>
              ) : (
                groups.map(g => (
                  <div 
                    key={g.group_id}
                    onClick={() => setSelectedGroupId(g.group_id)}
                    className={`p-3 rounded-xl cursor-pointer flex items-center justify-between group transition-all ${selectedGroupId === g.group_id ? 'bg-natwest-primary border border-transparent shadow-lg shadow-natwest-primary/20' : 'bg-transparent border border-transparent hover:bg-white/5'}`}
                  >
                    <div>
                      <div className={`text-sm font-bold ${selectedGroupId === g.group_id ? 'text-white' : 'text-white/80'}`}>{g.name}</div>
                      {g.description && <div className={`text-xs mt-0.5 ${selectedGroupId === g.group_id ? 'text-white/80' : 'text-white/40'}`}>{g.description}</div>}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteGroup(g.group_id, e)}
                      className="p-1.5 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Pane - Contacts */}
          <div className="w-2/3 flex flex-col bg-[#0f0c1b]">
            {selectedGroupId && selectedGroup ? (
              <>
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div>
                    <h3 className="text-sm font-bold text-white">{selectedGroup.name} Contacts</h3>
                    <p className="text-xs text-white/40">{groupContacts.length} members</p>
                  </div>
                  <button 
                    onClick={() => setIsAddingContact(!isAddingContact)}
                    className="px-3 py-1.5 rounded-lg bg-natwest-teal hover:bg-natwest-teal/80 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-natwest-teal/20"
                  >
                    {isAddingContact ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {isAddingContact ? 'Cancel' : 'Add Contact'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                  
                  {isAddingContact && (
                    <div className="mb-6 bg-[#0a0714] border border-natwest-teal/30 p-4 rounded-xl shadow-lg shadow-natwest-teal/10 animate-in slide-in-from-top-2">
                      <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">Add New Contact</h4>
                      <form onSubmit={handleCreateAndAddContact} className="flex gap-3 items-start">
                        <input type="text" placeholder="Name" value={newContactName} onChange={e => setNewContactName(e.target.value)} required className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-natwest-teal outline-none" />
                        <input type="email" placeholder="Email Address" value={newContactEmail} onChange={e => setNewContactEmail(e.target.value)} required className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-natwest-teal outline-none" />
                        <button type="submit" className="px-4 py-2 bg-natwest-teal text-white text-sm font-bold rounded-lg shadow-lg shadow-natwest-teal/20 whitespace-nowrap">Add</button>
                      </form>

                      {availableContacts.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5" /> Or Select Existing
                          </h4>
                          <input 
                            type="text" placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white mb-3 outline-none focus:border-white/20"
                          />
                          <div className="max-h-32 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                            {availableContacts.slice(0, 10).map(c => (
                              <div key={c.contact_id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 group">
                                <div>
                                  <div className="text-xs font-bold text-white/90">{c.name}</div>
                                  <div className="text-[10px] text-white/50">{c.email}</div>
                                </div>
                                <button onClick={() => handleAddExistingContact(c.contact_id)} className="px-2 py-1 bg-natwest-teal/20 text-natwest-teal text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-natwest-teal/40">Add</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {groupContacts.map(c => (
                      <div key={c.contact_id} className="p-3 bg-[#0a0714] border border-white/5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 font-bold text-xs flex-shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-sm font-bold text-white/90 truncate">{c.name}</div>
                            <div className="text-xs text-white/40 truncate flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveContact(c.contact_id)}
                          className="p-1.5 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                          title="Remove from group"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {groupContacts.length === 0 && !isAddingContact && (
                      <div className="col-span-2 text-center py-12 text-white/30 text-sm">
                        No contacts in this group.<br/>Click "Add Contact" to populate this list.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/30">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p>Select a group from the left to view contacts</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

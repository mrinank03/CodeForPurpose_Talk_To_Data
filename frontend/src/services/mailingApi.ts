import api from './api';
import { MailingGroup, MailingContact, GroupCreate, ContactCreate } from '../types/mailing';

const BASE = '/api/mailing';

// --- Groups ---

export async function getGroups(): Promise<MailingGroup[]> {
  const res = await api.get(`${BASE}/groups`);
  return res.data;
}

export async function createGroup(data: GroupCreate): Promise<MailingGroup> {
  const res = await api.post(`${BASE}/groups`, data);
  return res.data;
}

export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(`${BASE}/groups/${groupId}`);
}

// --- Contacts ---

export async function getAllContacts(): Promise<MailingContact[]> {
  const res = await api.get(`${BASE}/contacts`);
  return res.data;
}

export async function createContact(data: ContactCreate): Promise<MailingContact> {
  const res = await api.post(`${BASE}/contacts`, data);
  return res.data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await api.delete(`${BASE}/contacts/${contactId}`);
}

// --- Memberships ---

export async function getGroupContacts(groupId: string): Promise<MailingContact[]> {
  const res = await api.get(`${BASE}/groups/${groupId}/contacts`);
  return res.data;
}

export async function addContactToGroup(groupId: string, contactId: string): Promise<void> {
  await api.post(`${BASE}/groups/${groupId}/contacts/${contactId}`);
}

export async function removeContactFromGroup(groupId: string, contactId: string): Promise<void> {
  await api.delete(`${BASE}/groups/${groupId}/contacts/${contactId}`);
}

export interface MailingGroup {
  group_id: string;
  name: string;
  description?: string;
}

export interface MailingContact {
  contact_id: string;
  name: string;
  email: string;
}

export interface GroupCreate {
  name: string;
  description?: string;
}

export interface ContactCreate {
  name: string;
  email: string;
}

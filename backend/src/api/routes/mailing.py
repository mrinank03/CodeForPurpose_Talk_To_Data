import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.scheduler.metadata_db import get_db, MailingGroup, MailingContact, GroupMembership

router = APIRouter()

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None

class GroupResponse(BaseModel):
    group_id: str
    name: str
    description: Optional[str] = None

class ContactCreate(BaseModel):
    name: str
    email: str

class ContactResponse(BaseModel):
    contact_id: str
    name: str
    email: str

# --- Groups ---

@router.get("/mailing/groups", response_model=List[GroupResponse])
def get_groups(db: Session = Depends(get_db)):
    return db.query(MailingGroup).all()

@router.post("/mailing/groups", response_model=GroupResponse)
def create_group(req: GroupCreate, db: Session = Depends(get_db)):
    existing = db.query(MailingGroup).filter(MailingGroup.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")
    
    group = MailingGroup(
        group_id=str(uuid.uuid4()),
        name=req.name,
        description=req.description
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/mailing/groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    group = db.query(MailingGroup).filter(MailingGroup.group_id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Delete memberships
    db.query(GroupMembership).filter(GroupMembership.group_id == group_id).delete()
    db.delete(group)
    db.commit()
    return {"status": "deleted"}

# --- Contacts ---

@router.get("/mailing/contacts", response_model=List[ContactResponse])
def get_all_contacts(db: Session = Depends(get_db)):
    return db.query(MailingContact).all()

@router.post("/mailing/contacts", response_model=ContactResponse)
def create_contact(req: ContactCreate, db: Session = Depends(get_db)):
    existing = db.query(MailingContact).filter(MailingContact.email == req.email).first()
    if existing:
        # Update name if exists
        existing.name = req.name
        db.commit()
        db.refresh(existing)
        return existing
        
    contact = MailingContact(
        contact_id=str(uuid.uuid4()),
        name=req.name,
        email=req.email
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/mailing/contacts/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(MailingContact).filter(MailingContact.contact_id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    db.query(GroupMembership).filter(GroupMembership.contact_id == contact_id).delete()
    db.delete(contact)
    db.commit()
    return {"status": "deleted"}

# --- Group Memberships ---

@router.get("/mailing/groups/{group_id}/contacts", response_model=List[ContactResponse])
def get_group_contacts(group_id: str, db: Session = Depends(get_db)):
    memberships = db.query(GroupMembership).filter(GroupMembership.group_id == group_id).all()
    contact_ids = [m.contact_id for m in memberships]
    if not contact_ids:
        return []
    contacts = db.query(MailingContact).filter(MailingContact.contact_id.in_(contact_ids)).all()
    return contacts

@router.post("/mailing/groups/{group_id}/contacts/{contact_id}")
def add_contact_to_group(group_id: str, contact_id: str, db: Session = Depends(get_db)):
    existing = db.query(GroupMembership).filter(
        GroupMembership.group_id == group_id, 
        GroupMembership.contact_id == contact_id
    ).first()
    
    if not existing:
        membership = GroupMembership(
            membership_id=str(uuid.uuid4()),
            group_id=group_id,
            contact_id=contact_id
        )
        db.add(membership)
        db.commit()
        
    return {"status": "added"}

@router.delete("/mailing/groups/{group_id}/contacts/{contact_id}")
def remove_contact_from_group(group_id: str, contact_id: str, db: Session = Depends(get_db)):
    db.query(GroupMembership).filter(
        GroupMembership.group_id == group_id, 
        GroupMembership.contact_id == contact_id
    ).delete()
    db.commit()
    return {"status": "removed"}

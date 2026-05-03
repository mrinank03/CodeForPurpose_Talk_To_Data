import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.scheduler.metadata_db import get_db, MailingGroup, MailingContact, GroupMembership
from src.api.dependencies import get_current_user

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
def get_groups(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return db.query(MailingGroup).filter(MailingGroup.user_id == current_user["id"]).all()

@router.post("/mailing/groups", response_model=GroupResponse)
def create_group(req: GroupCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.query(MailingGroup).filter(MailingGroup.name == req.name, MailingGroup.user_id == current_user["id"]).first()
    if existing:
        raise HTTPException(status_code=400, detail="Group name already exists")
    
    group = MailingGroup(
        group_id=str(uuid.uuid4()),
        user_id=current_user["id"],
        name=req.name,
        description=req.description
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.delete("/mailing/groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    group = db.query(MailingGroup).filter(MailingGroup.group_id == group_id, MailingGroup.user_id == current_user["id"]).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or unauthorized")
    
    # Delete memberships
    db.query(GroupMembership).filter(GroupMembership.group_id == group_id).delete()
    db.delete(group)
    db.commit()
    return {"status": "deleted"}

# --- Contacts ---

@router.get("/mailing/contacts", response_model=List[ContactResponse])
def get_all_contacts(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return db.query(MailingContact).filter(MailingContact.user_id == current_user["id"]).all()

@router.post("/mailing/contacts", response_model=ContactResponse)
def create_contact(req: ContactCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.query(MailingContact).filter(MailingContact.email == req.email, MailingContact.user_id == current_user["id"]).first()
    if existing:
        # Update name if exists
        existing.name = req.name
        db.commit()
        db.refresh(existing)
        return existing
        
    contact = MailingContact(
        contact_id=str(uuid.uuid4()),
        user_id=current_user["id"],
        name=req.name,
        email=req.email
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@router.delete("/mailing/contacts/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    contact = db.query(MailingContact).filter(MailingContact.contact_id == contact_id, MailingContact.user_id == current_user["id"]).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found or unauthorized")
    
    db.query(GroupMembership).filter(GroupMembership.contact_id == contact_id).delete()
    db.delete(contact)
    db.commit()
    return {"status": "deleted"}

# --- Group Memberships ---

@router.get("/mailing/groups/{group_id}/contacts", response_model=List[ContactResponse])
def get_group_contacts(group_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    group = db.query(MailingGroup).filter(MailingGroup.group_id == group_id, MailingGroup.user_id == current_user["id"]).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    memberships = db.query(GroupMembership).filter(GroupMembership.group_id == group_id).all()
    contact_ids = [m.contact_id for m in memberships]
    if not contact_ids:
        return []
    contacts = db.query(MailingContact).filter(MailingContact.contact_id.in_(contact_ids)).all()
    return contacts

@router.post("/mailing/groups/{group_id}/contacts/{contact_id}")
def add_contact_to_group(group_id: str, contact_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    group = db.query(MailingGroup).filter(MailingGroup.group_id == group_id, MailingGroup.user_id == current_user["id"]).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    contact = db.query(MailingContact).filter(MailingContact.contact_id == contact_id, MailingContact.user_id == current_user["id"]).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
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
def remove_contact_from_group(group_id: str, contact_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    group = db.query(MailingGroup).filter(MailingGroup.group_id == group_id, MailingGroup.user_id == current_user["id"]).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.query(GroupMembership).filter(
        GroupMembership.group_id == group_id, 
        GroupMembership.contact_id == contact_id
    ).delete()
    db.commit()
    return {"status": "removed"}

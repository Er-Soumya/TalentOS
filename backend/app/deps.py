from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer), db: Session = Depends(get_db)):
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_owned(db, model, obj_id, org_id, label="Record"):
    """Fetch a row that must belong to the caller's organization, or 404."""
    obj = db.get(model, obj_id)
    if obj is None or obj.org_id != org_id:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj

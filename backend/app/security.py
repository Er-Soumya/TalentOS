import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings

_ITER = 600_000


def hash_password(password):
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITER)
    return f"pbkdf2_sha256${_ITER}${salt.hex()}${dk.hex()}"


def verify_password(password, stored):
    try:
        algo, iters, salt, digest = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iters))
        return algo == "pbkdf2_sha256" and hmac.compare_digest(dk.hex(), digest)
    except (ValueError, AttributeError):
        return False


def create_token(user_id, org_id):
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "org": org_id, "exp": exp}, settings.jwt_secret, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])

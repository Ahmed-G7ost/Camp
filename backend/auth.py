"""JWT authentication & role-based access for مخيم العائدين."""
import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException, Request

import firebase_service as fs

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_HOURS = 12


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def find_user_by_email(email: str):
    email = email.strip().lower()
    users = fs.list_records("users")
    for u in users:
        if u.get("email") == email:
            return u
    return None


def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="غير مصرّح. الرجاء تسجيل الدخول")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="رمز غير صالح")
        user = fs.get_record("users", payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="المستخدم غير موجود")
        user = dict(user)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة. سجّل الدخول مجدداً")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="رمز غير صالح")


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="هذه العملية متاحة للمدير فقط")
    return user


def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@camp.com").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "مدير النظام")
    existing = find_user_by_email(admin_email)
    if existing is None:
        fs.push("users", {
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        fs.update_record("users", existing["id"], {"password_hash": hash_password(admin_password)})

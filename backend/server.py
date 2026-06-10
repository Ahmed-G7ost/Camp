"""Minimal stub — the entire app now runs in the frontend with Firebase directly.

The old FastAPI/Firebase-Admin backend was removed. This file only exists to keep
the platform's backend service healthy.
"""
from fastapi import FastAPI

app = FastAPI(title="مخيم العائدين — frontend-only")


@app.get("/api/")
def root():
    return {"message": "كل المنطق يعمل الآن في الواجهة الأمامية مع Firebase مباشرة"}

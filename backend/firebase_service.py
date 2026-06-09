"""Firebase Realtime Database service layer for مخيم العائدين."""
import os
import firebase_admin
from firebase_admin import credentials, db as fb_db
from pathlib import Path

ROOT_DIR = Path(__file__).parent


def init_firebase():
    if not firebase_admin._apps:
        cred_path = ROOT_DIR / os.environ["FIREBASE_CRED_PATH"]
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred, {"databaseURL": os.environ["FIREBASE_DB_URL"]})
    return True


def ref(path: str):
    """Get a reference to a node in the Realtime Database."""
    return fb_db.reference(path)


def push(collection: str, data: dict) -> dict:
    """Create a new record under collection with a generated id, returns stored data with id."""
    node = ref(collection).push()
    record = {**data, "id": node.key}
    node.set(record)
    return record


def set_record(collection: str, record_id: str, data: dict) -> dict:
    record = {**data, "id": record_id}
    ref(f"{collection}/{record_id}").set(record)
    return record


def get_record(collection: str, record_id: str):
    return ref(f"{collection}/{record_id}").get()


def update_record(collection: str, record_id: str, data: dict):
    ref(f"{collection}/{record_id}").update(data)
    return get_record(collection, record_id)


def delete_record(collection: str, record_id: str):
    ref(f"{collection}/{record_id}").delete()


def list_records(collection: str) -> list:
    """Return all records of a collection as a list (values)."""
    data = ref(collection).get()
    if not data:
        return []
    if isinstance(data, dict):
        result = []
        for k, v in data.items():
            if isinstance(v, dict):
                v.setdefault("id", k)
                result.append(v)
        return result
    return []


def query_by_child(collection: str, child: str, value) -> list:
    data = ref(collection).order_by_child(child).equal_to(value).get()
    if not data:
        return []
    return [{**v, "id": v.get("id", k)} for k, v in data.items() if isinstance(v, dict)]

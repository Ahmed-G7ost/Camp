"""Backend tests for the 'Special Categories' feature.

Endpoints under test:
- /api/categories (GET seeded list of 7, POST/DELETE)
- /api/category-fields (GET/POST/DELETE per category)
- /api/category-records (GET/POST/PUT/DELETE per category)
- /api/category-records/export (xlsx)
- /api/category-records/import (xlsx)

Admin auth via classic /api/auth/login.
"""
import io
import os
import time
import pytest
import requests
import openpyxl

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@camp.com"
ADMIN_PASSWORD = "admin123"
TEST_PREFIX = f"TEST_{int(time.time())}_"

EXPECTED_KEYS = {"widows", "pregnant", "nursing", "children", "patients", "elderly", "injuries"}
EXPECTED_NAMES = {"أرامل", "حوامل", "مرضعات", "أطفال", "مرضى", "كبار السن", "إصابات"}


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"login: {r.status_code} {r.text}"
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def categories(admin_headers):
    r = requests.get(f"{BASE_URL}/api/categories", headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"list categories: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def family_for_record(admin_headers):
    """Pick an existing family with a usable name field; if none, create one."""
    # Make sure at least one family-field exists
    ff = requests.get(f"{BASE_URL}/api/family-fields", headers=admin_headers, timeout=20).json()
    if not ff:
        fr = requests.post(f"{BASE_URL}/api/family-fields",
                           json={"label": f"{TEST_PREFIX}name", "type": "text", "order": 0},
                           headers=admin_headers, timeout=20)
        assert fr.status_code == 200
        ff = [fr.json()]
    name_key = sorted(ff, key=lambda f: f.get("order", 0))[0]["key"]

    fams = requests.get(f"{BASE_URL}/api/families", headers=admin_headers, timeout=20).json()
    if fams:
        # return the first existing family + name_key
        return {"family": fams[0], "name_key": name_key, "created": False}
    cr = requests.post(f"{BASE_URL}/api/families",
                       json={"data": {name_key: f"{TEST_PREFIX}fam"}},
                       headers=admin_headers, timeout=20)
    assert cr.status_code == 200
    return {"family": cr.json(), "name_key": name_key, "created": True}


# ----------------------- Categories list -----------------------
class TestCategoriesSeed:
    def test_seven_categories_seeded(self, categories):
        assert isinstance(categories, list)
        keys = {c.get("key") for c in categories}
        names = {c.get("name") for c in categories}
        # All expected keys/names must be present (extra custom categories allowed)
        missing_keys = EXPECTED_KEYS - keys
        missing_names = EXPECTED_NAMES - names
        assert not missing_keys, f"missing category keys: {missing_keys}"
        assert not missing_names, f"missing category names: {missing_names}"

    def test_categories_have_count_and_id(self, categories):
        for c in categories:
            assert "id" in c
            assert "count" in c
            assert isinstance(c["count"], int)

    def test_categories_sorted_by_order(self, categories):
        orders = [c.get("order", 999) for c in categories]
        assert orders == sorted(orders)


# ----------------------- Category-fields CRUD -----------------------
class TestCategoryFields:
    def test_add_and_list_field(self, admin_headers, categories):
        injuries = next(c for c in categories if c["key"] == "injuries")
        label = f"{TEST_PREFIX}نوع الإصابة"
        r = requests.post(f"{BASE_URL}/api/category-fields",
                          json={"category_id": injuries["id"], "label": label,
                                "type": "text", "order": 1},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["label"] == label
        assert rec["category_id"] == injuries["id"]
        assert "key" in rec and rec["key"]

        # GET verify
        lr = requests.get(f"{BASE_URL}/api/category-fields?category_id={injuries['id']}",
                          headers=admin_headers, timeout=20)
        assert lr.status_code == 200
        assert any(f["id"] == rec["id"] for f in lr.json())
        # cleanup
        requests.delete(f"{BASE_URL}/api/category-fields/{rec['id']}",
                        headers=admin_headers, timeout=20)

    def test_delete_field(self, admin_headers, categories):
        widows = next(c for c in categories if c["key"] == "widows")
        r = requests.post(f"{BASE_URL}/api/category-fields",
                          json={"category_id": widows["id"], "label": f"{TEST_PREFIX}tmp",
                                "type": "text", "order": 0},
                          headers=admin_headers, timeout=20)
        fid = r.json()["id"]
        d = requests.delete(f"{BASE_URL}/api/category-fields/{fid}",
                            headers=admin_headers, timeout=20)
        assert d.status_code == 200
        lr = requests.get(f"{BASE_URL}/api/category-fields?category_id={widows['id']}",
                          headers=admin_headers, timeout=20).json()
        assert all(f["id"] != fid for f in lr)


# ----------------------- Category-records full flow -----------------------
class TestCategoryRecords:
    def test_full_record_lifecycle(self, admin_headers, categories, family_for_record):
        injuries = next(c for c in categories if c["key"] == "injuries")
        # create a field for this category
        label = f"{TEST_PREFIX}نوع_الإصابة"
        fr = requests.post(f"{BASE_URL}/api/category-fields",
                           json={"category_id": injuries["id"], "label": label,
                                 "type": "text", "order": 1},
                           headers=admin_headers, timeout=20)
        assert fr.status_code == 200
        field = fr.json()
        fkey = field["key"]

        family = family_for_record["family"]

        # CREATE record
        cr = requests.post(f"{BASE_URL}/api/category-records",
                           json={"category_id": injuries["id"],
                                 "family_id": family["id"],
                                 "data": {fkey: "كسر"}},
                           headers=admin_headers, timeout=20)
        assert cr.status_code == 200, cr.text
        rec = cr.json()
        rec_id = rec["id"]
        assert rec["family_id"] == family["id"]
        assert rec["data"][fkey] == "كسر"

        # GET list
        lr = requests.get(
            f"{BASE_URL}/api/category-records?category_id={injuries['id']}",
            headers=admin_headers, timeout=20)
        assert lr.status_code == 200
        assert any(r["id"] == rec_id for r in lr.json())

        # category count incremented
        cats2 = requests.get(f"{BASE_URL}/api/categories", headers=admin_headers, timeout=20).json()
        inj2 = next(c for c in cats2 if c["key"] == "injuries")
        assert inj2["count"] >= 1

        # UPDATE record
        ur = requests.put(f"{BASE_URL}/api/category-records/{rec_id}",
                          json={"category_id": injuries["id"],
                                "family_id": family["id"],
                                "data": {fkey: "جرح"}},
                          headers=admin_headers, timeout=20)
        assert ur.status_code == 200
        assert ur.json()["data"][fkey] == "جرح"

        # EXPORT xlsx
        ex = requests.get(
            f"{BASE_URL}/api/category-records/export?category_id={injuries['id']}",
            headers=admin_headers, timeout=30)
        assert ex.status_code == 200, ex.text[:300]
        ct = ex.headers.get("content-type", "")
        assert "spreadsheetml" in ct
        wb = openpyxl.load_workbook(io.BytesIO(ex.content))
        ws = wb.active
        header_row = [c.value for c in next(ws.iter_rows(max_row=1))]
        assert header_row[0] == "الاسم (العائلة)"
        assert label in header_row

        # DELETE record
        dr = requests.delete(f"{BASE_URL}/api/category-records/{rec_id}",
                             headers=admin_headers, timeout=20)
        assert dr.status_code == 200
        # verify gone
        lr2 = requests.get(
            f"{BASE_URL}/api/category-records?category_id={injuries['id']}",
            headers=admin_headers, timeout=20).json()
        assert all(r["id"] != rec_id for r in lr2)

        # cleanup field
        requests.delete(f"{BASE_URL}/api/category-fields/{field['id']}",
                        headers=admin_headers, timeout=20)


# ----------------------- Custom category CRUD -----------------------
class TestCustomCategory:
    def test_create_and_delete_custom_category(self, admin_headers):
        name = f"{TEST_PREFIX}مخصص"
        r = requests.post(f"{BASE_URL}/api/categories",
                          json={"name": name, "icon": "Layers"},
                          headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        cat = r.json()
        assert cat["name"] == name
        assert cat["system"] is False
        cid = cat["id"]

        # delete
        d = requests.delete(f"{BASE_URL}/api/categories/{cid}",
                            headers=admin_headers, timeout=20)
        assert d.status_code == 200
        # verify gone
        cats = requests.get(f"{BASE_URL}/api/categories",
                            headers=admin_headers, timeout=20).json()
        assert all(c["id"] != cid for c in cats)


# ----------------------- Role enforcement -----------------------
class TestCategoryRoleEnforcement:
    """Staff should not be able to create/delete categories or fields."""

    @pytest.fixture(scope="class")
    def staff_headers(self, admin_headers):
        email = f"{TEST_PREFIX}staffcat@test.com".lower()
        body = {"email": email, "password": "staffpass123",
                "name": "TEST staff cat", "role": "staff"}
        cr = requests.post(f"{BASE_URL}/api/users", json=body,
                           headers=admin_headers, timeout=20)
        assert cr.status_code == 200, cr.text
        uid = cr.json()["id"]
        lr = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": email, "password": "staffpass123"}, timeout=20)
        assert lr.status_code == 200
        token = lr.json()["token"]
        yield {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        requests.delete(f"{BASE_URL}/api/users/{uid}", headers=admin_headers, timeout=20)

    def test_staff_cannot_create_category(self, staff_headers):
        r = requests.post(f"{BASE_URL}/api/categories",
                          json={"name": "x"}, headers=staff_headers, timeout=20)
        assert r.status_code == 403

    def test_staff_cannot_create_category_field(self, staff_headers, categories):
        injuries = next(c for c in categories if c["key"] == "injuries")
        r = requests.post(f"{BASE_URL}/api/category-fields",
                          json={"category_id": injuries["id"], "label": "x",
                                "type": "text", "order": 0},
                          headers=staff_headers, timeout=20)
        assert r.status_code == 403

    def test_staff_can_list_categories(self, staff_headers):
        r = requests.get(f"{BASE_URL}/api/categories", headers=staff_headers, timeout=20)
        assert r.status_code == 200

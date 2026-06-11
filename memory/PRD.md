
## Special-categories: remove family-link requirement (2026-06-11)
- Per user request, category records (الفئات الخاصة: أطفال etc.) no longer require linking to a family. The name (which already includes the father's name in the roster) is taken directly from the record/Excel.
- `api.js` `importCategoryRecords`: removed family fuzzy/exact matching & "unmatched skip". Now stores `name` from the chosen name column; all rows with a name are imported (family_id = "").
- `api.js` POST/PUT `/category-records`: persist `name`; `exportCategoryRecords`: name column = `r.name || family name`.
- `CategoryRecords.jsx`: removed "no families" blockers (import + add); added `recName(r)=r.name||famName`; used in list/search/sort/display. Add/Edit modal: new required "الاسم" field, family link now "(اختياري)", save enabled by name. Import modal: removed fuzzy toggle + "طابق الأسماء حسب" selector; kept "عمود الاسم في الملف"; reworded helper.
- Scope strictly limited to special categories. Families & aid-records matching untouched.
- Verified live (admin@camp.com): add modal works without family; import modal opens with matching UI removed.

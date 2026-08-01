---
paths:
  - 'lib/vcard-export.ts'
  - 'lib/__tests__/vcard-export.test.ts'
  - 'app/admin/dugsi/**'
  - 'app/admin/mahad/**'
---

## vCard Export Invariants

- **vCard export `skippedDuplicate` is contact-level, not family-level.** It counts each record that resolves to an already-seen contact (a bridge merge of 3 families into 1 contact yields `skippedDuplicate = 2`). Mahad omits `skippedDuplicate` entirely (the field is `undefined`, not `0`) because it has no cross-contact dedup. Do not rename this field to `skippedFamilies` or repurpose it for family-level counts.
- **vCard export family-key is a superset of `getFamilyKey()`.** The inline grouping in `_generateDugsiVCardContent` adds phone as a tertiary fallback and normalizes email. Do not replace it with a call to `getFamilyKey()` — they have intentionally different semantics. Phone-only families would silently break.

# YAJUR VEDA &bull; RESEARCH ADMINISTRATION & INCENTIVES (BOUNDARY AUDIT)

**Domain:** Research Administration, Grant Compliance & Faculty Incentives  
**Subsystem Code:** `yajur_veda`  
**Current Audit Date:** November 7, 2026  
**Implementation Classification:** **ARCHITECTURAL BOUNDARY (PLANNED FOR PHASE 3)**  

---

## 1. Domain Scope & Objectives

Yajur Veda models the operational administrative machinery supporting research at CSJMU:
- Institutional project sanctioning and research grant accounting.
- Institutional Ethics Committee (IEC) and Animal Ethics Committee approvals.
- Faculty research publication incentive disbursements.
- Utilization Certificate (UC) and Statement of Expenditure (SE) audits.

---

## 2. Current Verified Implementation State

In accordance with [`ADR-005`](file:///c:/Projects/VYASA/docs/decisions/ADR-005-veda-based-module-architecture.md), Yajur Veda is designated as an upcoming domain. Its structural architectural boundary is established in the codebase without premature or unverified mock business logic.

### Verified Artifacts:
1. **Backend Route Boundary:**
   - **File:** [`backend/app/modules/yajur_veda/router.py`](file:///c:/Projects/VYASA/backend/app/modules/yajur_veda/router.py)
   - **Endpoint:** `GET /api/modules/yajur-veda/status`
   - **Behavior:** Queries the module registry and returns active boundary confirmation:
     ```json
     {
       "success": true,
       "message": "Yajur Veda architectural boundary active. Domain business logic planned.",
       "data": {
         "key": "yajur_veda",
         "name": "Yajur Veda",
         "status": "planned"
       }
     }
     ```
2. **Frontend Placeholder & Status Page:**
   - **Files:** [`YajurVedaDashboardPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/yajur-veda/pages/YajurVedaDashboardPage.tsx), [`YajurVedaPlaceholder.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/yajur-veda/components/YajurVedaPlaceholder.tsx)
   - **Route:** `/modules/yajur-veda`
   - **Behavior:** Renders an informative institutional card detailing upcoming capabilities (Grant Sanctioning Ledger, Ethics Review Board, Faculty Incentive Calculator) while clearly indicating Phase 3 scheduling.
3. **Database Model Directory:**
   - **Directory:** [`backend/app/modules/yajur_veda/models/`](file:///c:/Projects/VYASA/backend/app/modules/yajur_veda/models)
   - **Status:** Empty directory initialized with package marker `__init__.py`.

---

## 3. Required Future Developments (Roadmap)

To bring Yajur Veda to operational maturity, the following components must be developed:
1. **Grant Financial Ledger:** Multi-year grant budgeting, expenditure line-item tracking, and PFMS integration.
2. **Institutional Ethics Review Pipeline:** Application submission, reviewer blinding, and formal ethical clearance certification.
3. **Automated Incentive Calculator:** Algorithmic calculation of faculty incentive grants based on journal impact factor, Scopus citation metrics, and patent grants.

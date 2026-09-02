# Role-Based Access Control (RBAC) & City-Scope Authorization Model

## 1. Multi-Dimensional Authorization Formula

Access decisions evaluate six strict server-side dimensions:
$$\text{Access Granted} \iff (\text{User Active}) \land (\text{Role Match}) \land (\text{Dept Scope} \lor \text{Approved Sharing Grant}) \land (\text{City Scope})$$

---

## 2. Multi-Role Hierarchy

A single user may possess multiple platform roles (e.g. `["OFFICER", "INVESTIGATOR"]`).

| Role | Authority Scope |
|---|---|
| `STATE_ADMIN` | Statewide global authority across all departments, users, cameras, overrides, and audit logs. |
| `DEPARTMENT_HEAD` | Departmental administration (manage department users, subordinate city scopes, cameras, approve/reject access requests, alert rules, final investigation decisions, department audit). |
| `OFFICER` | Operational execution (view authorized cameras, submit camera access requests, search detections, work on investigations, view/acknowledge alerts, export evidence). |
| `OPERATOR` | Real-time monitoring focus (view authorized live streams, monitor camera health and AI state, view recent detections, acknowledge permitted alerts). |
| `INVESTIGATOR` | Investigative focus (authorized detection search, lead investigation casebooks, attach evidence, case-specific watchlists, alert triage). |

---

## 3. City-Based RBAC Enforcement

Users are assigned zero or more city scopes (e.g., `['Ahmedabad', 'Rajkot']`).
- Non-admin users are restricted to accessing resources located within their assigned cities.
- A user attempting to query a camera or detection in an unassigned city is rejected with `AUTHORIZATION_DENIED`.
- Department Heads can assign subordinate users only to cities within their own administrative scope.
- State Admins have statewide authority across all Gujarat cities automatically.

---

## 4. Cross-Department Camera Sharing Lifecycle

```
[Requesting Department User]
          |
          v
  Submit Access Request (Single / Multi / City-level cameras, Duration, Reason)
          |
          v
     [PENDING]
          |
    +-----+-----+
    |           |
    v           v
[APPROVED]   [REJECTED]
 (By Dept Head / State Admin)
    |
    +---> [EXPIRED] (When time-bound duration elapses)
    |
    +---> [REVOKED] (When managing department revokes grant)
```

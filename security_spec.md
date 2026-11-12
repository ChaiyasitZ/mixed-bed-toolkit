# Security Specification - Mixed Bed Toolkit

## 1. Data Invariants
- Each user profile (`/users/{userId}`) can only be accessed, created, or updated by the authenticated user whose `request.auth.uid == userId`.
- All subcollections (`/users/{userId}/salt_records/{recordId}`, `/users/{userId}/silica_records/{recordId}`, `/users/{userId}/cycle_predictions/{predictionId}`) are strictly isolated to the user who owns them (`request.auth.uid == userId`).
- Records must strictly validate incoming data types, positive numeric values for conductivity/silica, string lengths, and enforce immutable `userId` and `createdAt` fields.
- Document paths must conform to alphanumeric IDs (`isValidId`), preventing path manipulation or Denial of Wallet attacks.

## 2. Hardened Access Rules
- Global Safety Net default-deny for all unauthorized paths.
- Unauthenticated requests are completely rejected.
- No cross-tenant access: user A cannot read, list, update, or delete user B's records.

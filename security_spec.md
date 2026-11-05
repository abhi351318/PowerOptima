# Security Specification & Threat Model

## Data Invariants
1. `UserProfile`: Belongs strictly to the authenticated user matching `{userId} == request.auth.uid`. Users cannot read or modify other users' profiles.
2. `UserHistoryItem`: Must belong to the parent `{userId}` (`resource.data.userId == request.auth.uid`). Users can only create, list, view, and delete their own history entries.
3. `TariffConfiguration`: Must belong to the parent `{userId}` (`resource.data.userId == request.auth.uid`). Subcollection access is strictly gated by authentication and owner match.
4. Catch-All Deny: All unmatched collections and documents are denied by default.

## The Dirty Dozen Payloads
1. **Unauthenticated Read of User Profile**: Anonymous or null auth attempting `get /users/user123` -> Rejected.
2. **Cross-User Profile Write**: Authenticated user `userA` attempting `set /users/userB` -> Rejected.
3. **Cross-User History Creation**: Authenticated user `userA` attempting `create /users/userB/history/run1` -> Rejected.
4. **History Injection with Mismatched UID**: User `userA` writing into `/users/userA/history/run1` with `userId: 'userB'` -> Rejected.
5. **Unauthorized History Listing**: User `userA` executing `list /users/userB/history` -> Rejected.
6. **Malicious Tariff Rate Update**: Unauthenticated or cross-tenant write to `/users/userB/tariffs/t1` -> Rejected.
7. **Junk-Character ID Poisoning**: Attempting to create document with path containing illegal characters or >128 chars -> Rejected.
8. **Shadow Field Injection**: Injecting unexpected internal keys into profile or history records -> Rejected.
9. **Blanket Read Exploit**: Running query without scoping to authenticated user's collection -> Rejected.
10. **Tampering with Another User's Tariff**: User `userA` sending `delete /users/userB/tariffs/t1` -> Rejected.
11. **Negative Energy/Cost Spoofing**: Attempting invalid negative values or non-numeric types for energy calculations -> Handled by schema constraints.
12. **Root Document Snooping**: Scanning root collection queries without target subcollection scoping -> Denied by default-deny catch-all.

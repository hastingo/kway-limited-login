# Cartrack Fleet Access Findings

Validated on 8 September 2026 against the Tanzania Cartrack services.

The corrected Fleetweb administrator credentials authenticate successfully at `https://fleetweb-tz.cartrack.com/map/fleet` for account `KWAY00016`. Fleetweb shows two visible vehicles: `T197EMW` and `T757EQF`.

The ordinary Fleetweb password is not accepted by the official Fleet API, confirming that Cartrack requires a separate API credential. With the user's explicit approval, an Admin API credential was generated in Cartrack API Settings. Its password is intentionally omitted from this file and must only be stored as a server-side WebDev secret.

The live integration should use read-only Fleet API endpoints even though the generated Admin credential technically has broader account permissions.

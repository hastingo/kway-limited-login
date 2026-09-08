# Data, Trip Allocation, Fuel, and Tracking QA

## Data management

The authenticated header displays Sync Data, Back Up, and Import controls. Manual synchronization completed against the live portal database and reported 2 trucks, 3 cargo records, and 5 expenses. Backup download produced a valid `kway-transport-backup` JSON file containing trucks, documents, income, income attachments, expenses, expense attachments, custom expense types, and maintenance records. Import validation rejects unrelated or unsupported JSON files, while valid imports use non-destructive merge behavior.

## Trip and expense allocation

Selecting a trip in Record Expenses automatically displays and assigns that trip's truck. A second horizontal expense row can be added independently without losing the first row's trip or truck. Return cargo automatically reuses the original trip's truck on both the client and server. The income trip-detail view displays registration, model, driver, telephone, cargo details, and all expenses grouped under the selected trip.

## Fuel volume

Fuel expense rows display a required Liters field. Server validation rejects a fuel expense without a positive liter quantity. Fuel volume appears in expense detail, exports, trip expense summaries, and aggregate fuel metrics, ready for later GPS fuel-efficiency calculations.

## Truck Tracking

The Truck Tracking navigation and workspace render correctly. Every trip row shows its allocated truck and driver, cargo dates, trip status, GPS distance placeholder, fuel volume, fuel rate, and last sync. GPS distance and sync timestamp fields are persisted and included in backups. The Connect & Sync action clearly reports that the GPS provider login URL is still required before live data retrieval can be implemented.

## Responsive verification

Authenticated mobile QA at 390 px width shows the header data controls as compact icon buttons with no horizontal overflow. Dashboard metric cards, recent trips, and the cargo chart stack cleanly. Desktop browser QA verified the complete Truck Tracking table and all data controls.

## Automated verification

TypeScript checking passed. Five Vitest suites passed with 10 tests, including backup validation, fuel-liter requirements, portal authentication, trip-reference generation, and logout. The production build completed successfully.

## Historical fuel backfill

Two existing Fuel records had unambiguous descriptions of `1850l`. A narrowly scoped database backfill populated only descriptions matching a number followed by `l`. Live synchronization verified 1,850 L on TRIP-60001 and 1,850 L on TRIP-30001, for a 3,700 L portal total.

A follow-up automated mobile run confirmed `window.innerWidth = 390` and `documentElement.scrollWidth = 390` on both Dashboard and Truck Tracking. The Sync, Backup, and Import controls, Connect & Sync action, and trip rows were all present. The recent-trips table was contained within its card to eliminate the previously detected page-level overflow.

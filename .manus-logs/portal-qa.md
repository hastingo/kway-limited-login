# Portal QA

The upgraded login page loads successfully through the live preview with the supplied account email prefilled. The original K-Way visual identity, responsive split layout, password masking, and secure sign-in controls remain intact. The managed screenshot endpoint did not yet expose a refreshed preview URL immediately after the full-stack upgrade, so browser-based verification is being used for the upgraded experience.

## Authentication and Dashboard

The configured temporary credentials authenticate successfully and establish the signed portal session. The dashboard loads all five navigation areas, empty-state metrics, fleet and trip summaries, and the cargo chart container without API errors or layout collisions.

## Income Workflow

The Income tab renders its summary cards, active-trip queue, cargo-type chart, record filters, and empty states correctly. The Add Income dialog includes going/return cargo selection, automatic trip-reference behavior, truck selection, loading date, customer, container, destination, income amount, description, and multi-file attachments.

## Fleet Registry

The Trucks tab presents a clean fleet empty state and clear Add Truck actions. The surrounding sidebar and toolbar remain stable while switching between the Income and Trucks workspaces.

The Add Truck dialog contains the requested registration number, truck model, driver name, and driver telephone fields, with responsive two-column presentation and no persistent test records created during QA.

## Expense Workflow

The Expenses tab displays total, count, and average summaries; all/by-trip/by-truck/by-type views; and PDF/Excel export actions. The entry dialog supports trip selection, expense date, standard or custom expense types, description, amount, multiple attachments, and adding multiple expense lines before one save.

## Profit and Loss

The Profit & Loss workspace renders global income, global expenses, and net position cards, plus global, trip-wise, truck-wise, and service/maintenance report switches. The chart, report table, and PDF/Excel export actions are visible and responsive in the empty-data state.

## Responsive QA

An authenticated 390-pixel mobile run completed successfully. The mobile dashboard switches to a compact top bar, stacks all summary cards and panels cleanly, remains fully readable, and reports no horizontal overflow. The generated page width exactly matches the 390-pixel viewport.

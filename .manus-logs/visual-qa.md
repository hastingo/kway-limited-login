# Visual QA Findings

- Desktop (1440 × 900): Split-screen composition renders correctly; hero image, overlays, wordmark, metrics, form controls, and footer are fully visible with strong contrast.
- Mobile (390 × 844): Hero condenses into a branded header image; form becomes single-column, remains legible, and has no horizontal overflow or clipped controls.
- Brand styling is consistent across breakpoints: deep navy, safety orange, warm off-white, condensed display type, and Manrope body copy.
- No visible broken assets, layout collisions, or unreadable labels were observed.

## Interaction QA

Submitting the blank form correctly displays distinct inline validation messages for both the username and password fields without navigation or layout breakage.

Entering valid test credentials clears prior field errors, preserves password masking, and submits successfully. The loading state resolves to a confirmation toast stating that the form is ready to connect to real authentication.

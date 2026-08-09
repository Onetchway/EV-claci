# V-Green Stage & Form Field Mapping

Source: V-Green India "Setup Playbook" (Version 1.2, English Edition, Revision 19 June 2026).

This document is the single source of truth translating the Playbook into the app's data model:
each numbered stage below becomes one seeded `StageTemplate` row (in this order, via `order`), and
every field/checklist item/table/photo listed under it becomes seeded `FormFieldDef` / photo-slot
rows (see `backend/prisma/seed.js`). Field `type` values match the `FormFieldDef.type` enum:
`text | number | date | select | checkbox | table | photo | file`.

Every stage implicitly also has: PPE confirmation (checkbox, required — "wore full PPE kit"),
and every `photo` field is captured with GPS lat/lng + timestamp (server stamps it, see
`backend/src/services/storage`). This is not repeated per stage below.

---

## 1. `SURVEY` — Site Survey
Playbook §2.1. Output: **Site Survey Report**.

Fields:
- `siteAddress` (text, required)
- `gpsLocation` (text, required — captured automatically from device, editable)
- `contactPersonName` / `contactPersonPhone` (text)
- `dedicatedLoadRequirementKw` (number)
- `existingDiscomName` (text)
- `nearestPoleOrTransformerDistanceM` (number)
- `parkingType` (select: Open / Covered / Basement)
- `siteRemarks` (text, multiline)
- `electricityBillFile` (file, required — "scan/soft copy, merged into a single PDF, all pages readable")

Photos (required slots):
- `siteEntry`, `siteExit`, `proposedChargerLocation`, `parkingArea`, `nearestElectricalPole`,
  `boundaryOrStructureForCameraMount`, `electricityMeter`

---

## 2. `DISCOM` — DISCOM Application
Playbook §2.3. Output: **DISCOM Checklist**. Required for payment milestone "30% Appendix Signing"
(needs proof of DISCOM application submission).

Fields — Checklist groups (each item: `checkbox` collected/verified + optional `file` upload):
- Company Documents: Authorized Person/Director Aadhaar, PAN Card, MOA/AOA, Company Registration
  Docs, State GST Certificate, Bank Details/Cancelled Cheque, Authorization Letter/Board Resolution
- Site Documents: Property Owner Deed/Ownership Proof, Property Owner NOC, Lease/Rent Agreement
  (if applicable), Site Address Proof & Location Details
- Technical Documents: EV Charger Technical Datasheet, Panel Technical Datasheet, Transformer
  Technical Datasheet, RMU/VCB Technical Datasheet, Load Calculation & SLD, Other Technical Specs

Other fields:
- `connectionCategory` (select: LT / HT)
- `loadRequirementKw` (number)
- `discomOfficeName` (text), `concernedOfficerName` / `designation` (select: JE/AE/EE-EXEN/Help Desk/
  New Connection Dept/Commercial Dept)
- `applicationDate` (date), `applicationNumber` (text), `feePaid` (number)
- SLA tracker `table`: rows = [Application Scrutiny(5d), Site Survey(3d), Estimate Generation(5d),
  DN Payment Confirmation(2d), Meter Installation(3d), Connection Energization(2d)], columns =
  [Target SLA (readonly), Actual Date, Status]

Photos: `applicationReceipt`, `discomOfficeVisit`

---

## 3. `LAYOUT_APPROVAL` — Site Layout Approval
Playbook §2.4. Gate: **no civil/electrical work may start without this stage APPROVED.**

Fields:
- `layoutDrawingFile` (file, required)
- `approvalEmailFile` (file, required — "this approval email is very important for final payment")
- `approvedByName` (text), `approvalDate` (date)
- Checklist (checkbox, all required): Vehicle Entry Point marked, Vehicle Exit Point marked, Main/
  Service Road direction shown, Exact EVCS position marked, Dedicated parking marked, ACDB mounting
  location marked, Earthing pit location marked, CCTV pole location marked, Sign board location
  marked, Cable route/trench path marked (if applicable), DWC pipe route marked (if applicable),
  Safe clearance space confirmed

Photos: `approvedLayoutOnSite` (layout as marked on the ground)

---

## 4. `ELECTRICAL_DRAWING_APPROVAL` — Electrical Drawing Approval
Playbook §2.5. Gate: **no electrical work may start without this stage APPROVED.**

Fields:
- `electricalDrawingFile` (file, required)
- `approvalEmailFile` (file, required)
- `approvedByName` (text), `approvalDate` (date)
- Checklist (checkbox): ACDB panel location shown, Charger (EVCS) location shown, Cable route/trench
  path shown, DWC pipe route shown, Earthing pit connection details shown, Incomer cable route & size
  shown (as per BOQ), CCTV & sign board power route shown

---

## 5. `CIVIL` — Civil Work Execution
Playbook §5. Output: **Civil Work Inspection Report** (2nd payment milestone — "10% Civil Work
Completion").

Fields:
- `boqReference` (text)
- Foundation dimensions `table` (rows = EVCS Foundation, ACDB Foundation, Camera Pole Foundation,
  Bollard Foundation ×2, Earthing Pit Foundation, Sign Board Foundation, Do's & Don'ts Board
  Foundation; columns = Approved L×W×H (mm), Actual L×W×H (mm), Level OK?)
- `concreteGrade` (select, default M20), `rccRatio` (text, default "1:1.5:3 (Cement:Sand:Aggregate)")
- `dwcPipeSizeMm` (select: 130 / 100), `dwcPipeRouteConfirmed` (checkbox)
- Floor paint: `paintBrand` (select: Asian Paints / Nerolac / Berger), `paintColor` (text, default
  Yellow), `markingWidthMm` (number, default 100)
- Curing log `table`, 5 required rows (Day 1..Day 5): Date, Wet jute bag maintained? (checkbox),
  Photo (photo)

Photos (required slots): `evcsFoundationExcavation`, `ironMeshInstalled`, `rccCastingInProgress`,
`evcsFoundationFinished`, `acdbFoundationFinished`, `cameraPoleFoundationFinished`,
`bollardsInstalled`, `earthingPitFoundationFinished`, `signBoardFoundationFinished`,
`floorMarkingFinished`, `dwcPipeRouteBeforeBackfill`, `emptyPaintCans` ("submit empty paint cans
geotagged photos for verification after paint work completion")

---

## 6. `EARTHING` — Chemical Earthing
Playbook §6.2.

Fields:
- `pitCount` (number), `pitDiameterM` (number, default 3), `soilCondition` (select: Normal / Rocky /
  High moisture)
- `rodType` (text, default "Chemical Earthing Rod / CCPE")
- `chemicalCompoundPackets` (number, default 2), `chemicalCompoundKgPerPacket` (number, default 50)
- `waterAddedGradually` (checkbox, required)

Photos: `pitDigging`, `rodInstallationVertical`, `chemicalCompoundFilling`, `pitBackfilled`

---

## 7. `WIRING` — Cable Installation, Lugging, Ferruling & IR Testing
Playbook §6.4–6.6.

Fields:
- `continuityTestResult` (select: Pass / Fail, required — "before installing the main incoming
  cable")
- `cableSize` (text), `cableType` (text), `cableRouteDescription` (text)
- Cable lugging/ferruling checklist (checkbox): Correct lug size used, Heavy-duty crimping tool used
  (no hammer/temp fixing), Ferruling clear & machine-printed (no handwritten), Phase color heat
  sleeve correct (R-Red/Y-Yellow/B-Blue/N-Black/E-Green)
- IR Test readings `table` (required), rows = [Phase-Phase, Phase-Neutral, Phase-Earth,
  Neutral-Earth], column = Reading (MΩ)
- `meggerMeterModel` (text), `testedByName` (text), `testDate` (date)

Photos: `cableLayingInTrench`, `cableLuggingCrimping`, `ferrulingCloseUp`, `meggerTestInProgress`,
`meggerReadingDisplay`

---

## 8. `ACDB` — ACDB Panel Installation & Testing
Playbook §6.3, §6.7.

Fields:
- `panelModel` (text), `mountingMethod` (select: Crane / Chain Pulley Block / Manpower)
- `fastenerType` (select: Chemical Fastener / Anchor Fastener), `levelAlignmentOk` (checkbox,
  required)
- Inspection checklist (checkbox, all required): Outgoing MCCB/MCB rating & tightening OK, Busbar
  connections tight, Incoming/outgoing cable terminations tight with heat sleeves, Neutral & earth
  bar connections tight, MCCB/MCB/indicators/meters working, No loose wiring/burn marks, Ferruling &
  cable ID complete
- Voltage Test readings `table` (required), rows = [R-Y, Y-B, B-R, R-N, Y-N, B-N], column = Voltage
  (V)
- `multimeterModel` (text), `testedByName` (text), `testDate` (date)
- `noAbnormalSoundHeatingSparking` (checkbox, required)

Photos: `panelMountedExterior`, `panelInternalWiring`, `testingInProgress`, `panelClosedFinal`

---

## 9. `CHARGER_INSTALL` — Charger Delivery & Installation
Playbook §7.1–7.2.

Fields — Delivery inspection:
- `chargerModel` (text), `serialNumber` (text), `capacityKw` (number), `quantity` (number)
- `matchesApprovedBoq` (checkbox, required)
- `physicalDamageFound` (select: Yes / No), `damageNotes` (text, shown if Yes)
- Accessories checklist (checkbox): Gun holder present, Cable present, Mounting items present,
  Documents present

Fields — Installation:
- `foundationReadyConfirmed` (checkbox, required)
- `mountingMethod` (select: Crane / Hydra), `fastenerType` (select: Chemical Fastener / Anchor
  Fastener)
- `alignmentLevelOk` (checkbox, required), `clearanceMaintained` (checkbox, required)

Photos: `deliveryFrontView`, `deliveryBackView`, `deliverySideView1`, `deliverySideView2`,
`unboxingAccessories`, `chargerInstalledFront`, `chargerInstalledSide`, `chargerFoundationClose`

---

## 10. `TESTING` — Electrical Testing & Pre-Energization
Playbook §8. Outputs: **Earthing Test Report, Voltage Test Report, Pre-Energization Test Report.**

Fields:
- Safety checklist (checkbox, required): All electrical work complete, All fasteners/mounts tight,
  PPE used, No unauthorized person near station, Site clean & safe
- `earthingResistanceOhm` (number, required — "Submit the Earthing Test Report")
- Electrical checklist (checkbox): Phase/neutral/earth connections checked, Incoming/outgoing
  voltage & phase sequence verified, Cable connections tight, Cable dressing OK / no exposed
  conductor, Lug crimping/heat sleeve/color coding verified, MCB/MCCB/protection devices OK, Busbar
  tightness OK
- `incomingVoltageV` / `phaseSequenceOk` (number / checkbox)
- Panel & charger internal checklist (checkbox): Panel/charger internal area clean, no loose wire/
  tools/tape left inside, All waste & packing material removed

Photos: `earthingTestMeterReading`, `voltageTestReading`, `panelInternalCleanFinal`

---

## 11. `COMMISSIONING` — Final Energization & Commissioning
Playbook §9. Includes Charger Power ON Test (§9.2) and Vehicle Trial Charging (§9.3).

Fields:
- `simCardAvailable` (checkbox, required), `simCardNumber` (text)
- `electricalPowerAvailable` (checkbox, required)
- `finalElectricalInspectionDone` (checkbox, required)
- Charger Power ON checklist (checkbox, required): Incomer MCCB ON, Voltage & phase sequence
  verified before outgoing ON, Outgoing MCCB ON — no abnormal sound/smell/heat/spark/trip, Charger
  booted, display OK, Power ON/Healthy/No Fault shown, E-Stop tested OK, Gun lock/unlock verified,
  Display/LED/communication OK
- `simInstalled` (checkbox), `cmsOnlineStatus` (select: Online / Offline, required — "must be
  Online")
- `functionalTestPassed` (checkbox, required)
- Vehicle Trial Charging: `vehicleType` (text), `connectorType` (select: CCS2 / GB/T / AC Type-2 /
  Other), `chargingSessionStarted` (checkbox, required)
- Trial reading `table`: Voltage (V), Current (A), Charging Time (min), Energy Consumed (kWh),
  Fault/Error Alarm (Yes/No — must be No)
- `gunLockUnlockAfterChargingOk` (checkbox, required)
- `goLiveConfirmedBy` (text — V-Green Setup Manager name)

Photos: `chargerPowerOnDisplay`, `cmsOnlineScreenshot`, `vehicleConnectedCharging`,
`trialChargingScreenDisplay`
Video (file, optional but recommended per Playbook): `powerOnAndTrialChargingVideo`

---

## 12. `HOTO` — Handover Takeover
Playbook §10. Gate for **Final V-Green Site Inspection Approval** and **25% Go-Live payment**.

Fields — HOTO checklist (checkbox, required, per V-Green HOTO Check Sheet): Site details correct,
Charger details/serial number correct, Location/date correct, No missing photo, No incomplete
document

Fields — Final Documents Handover checklist (per Playbook §10.3 table — each item: `checkbox` +
`file` upload):
1. BOQ Soft Copy
2. Site Survey Report
3. Appendix File
4. DISCOM DN Payment Receipt (if any)
5. Approved Site Layout Drawing (ACDB + EVCS locations)
6. Approved Electrical Panel Drawing
7. Civil Work Inspection Report + geotagged photos
8. Cable Continuity Test Report + geotagged photos
9. Voltage Test Report + geotagged photos
10. Insulation Resistance (IR) Test Report + geotagged photos
11. Earthing Resistance Test Report + geotagged photos
12. HOTO Checklist
13. Final HOTO Photos (geotagged)
14. Site Inspection Final Report — email confirmation
15. Tax Invoice

Fields — Final Site Inspection: `inspectionMode` (select: Physical / Video Call), `inspectorName`
(text), `inspectionDate` (date), `finalApprovalEmailFile` (file, required)

Photos (HOTO sample set, required slots): `chargerFrontFinal`, `chargerSideFinal`, `acdbPanelFinal`,
`earthingPitFinal`, `bollardsFinal`, `signBoardFinal`, `cctvCameraFinal`, `siteOverallFinal`,
`fireExtinguisherFinal`

---

## Payment Milestones (project-level, derived — not a stage form)
Playbook §12. Shown on the admin Project page as a computed tracker, not a submission:

| Milestone | % | Unlocked when |
|---|---|---|
| Appendix Signing | 30% | `DISCOM` stage SUBMITTED (proof of application) + Appendix/Tax invoice on file |
| Civil Work Completion | 10% | `CIVIL` stage APPROVED |
| Construction Handover | 30% | `CHARGER_INSTALL` + `TESTING` stages APPROVED (all work done except meter) |
| Go-Live | 25% | `COMMISSIONING` + `HOTO` stages APPROVED |
| 1-Year Warranty Ends | 5% | manual admin mark, 1 year after Go-Live |

## Stage order & keys (seed order)
`SURVEY(1) → DISCOM(2) → LAYOUT_APPROVAL(3) → ELECTRICAL_DRAWING_APPROVAL(4) → CIVIL(5) →
EARTHING(6) → WIRING(7) → ACDB(8) → CHARGER_INSTALL(9) → TESTING(10) → COMMISSIONING(11) → HOTO(12)`

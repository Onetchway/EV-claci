/**
 * Seeds V-Green India as the first client, with its 12 execution stages and every
 * field/checklist/table/photo requirement from docs/vgreen-stage-forms.md (itself derived
 * from the V-Green Setup Playbook). Also seeds a demo admin, a demo engineer, and one sample
 * project so the whole system can be exercised end-to-end immediately after seeding.
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { createProjectStages } = require('../src/modules/projects/stageGating');
const { ROLES, PERMISSION_LIST } = require('../src/config/permissions');
const { CONFIG_DEFS } = require('../src/config/configDefs');

const prisma = new PrismaClient();

/**
 * Seeds/syncs RoleDef + PermissionDef + RolePermission from src/config/permissions.js — the
 * single source of truth for the RBAC matrix. Safe to re-run: upserts roles/permissions and
 * reconciles each role's permission set to exactly match the config (adds new grants, removes
 * ones no longer listed), so editing permissions.js and re-seeding keeps the DB in sync.
 */
async function seedRolesAndPermissions() {
  const permissionByKey = new Map();
  for (const p of PERMISSION_LIST) {
    const rec = await prisma.permissionDef.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: { key: p.key, description: p.description },
    });
    permissionByKey.set(p.key, rec);
  }

  const roleByKey = new Map();
  for (const [roleKey, def] of Object.entries(ROLES)) {
    const rec = await prisma.roleDef.upsert({
      where: { key: roleKey },
      update: { name: def.name },
      create: { key: roleKey, name: def.name },
    });
    roleByKey.set(roleKey, rec);

    const desiredPermIds = def.permissions.map((k) => permissionByKey.get(k).id);
    for (const permissionId of desiredPermIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: rec.id, permissionId } },
        update: {},
        create: { roleId: rec.id, permissionId },
      });
    }
    await prisma.rolePermission.deleteMany({
      where: { roleId: rec.id, permissionId: { notIn: desiredPermIds.length ? desiredPermIds : ['__none__'] } },
    });
  }

  console.log(`Seeded ${permissionByKey.size} permissions and ${roleByKey.size} roles.`);
  return roleByKey;
}

/**
 * Seeds/syncs ConfigDef from src/config/configDefs.js — the source of truth for the
 * Client/Project configuration hierarchy. Safe to re-run: upserts each def's metadata without
 * touching any ClientConfig/ProjectConfig override rows already set by admins.
 */
async function seedConfigDefs() {
  for (const def of CONFIG_DEFS) {
    await prisma.configDef.upsert({
      where: { key: def.key },
      update: {
        label: def.label,
        description: def.description,
        valueType: def.valueType,
        scope: def.scope,
        defaultValueJson: def.defaultValue,
      },
      create: {
        key: def.key,
        label: def.label,
        description: def.description,
        valueType: def.valueType,
        scope: def.scope,
        defaultValueJson: def.defaultValue,
      },
    });
  }
  console.log(`Seeded ${CONFIG_DEFS.length} config def(s).`);
}

/** Existing users (e.g. accounts created before RBAC landed) get roleId backfilled from their legacy `role` enum. */
async function backfillUserRoles(roleByKey) {
  const usersMissingRole = await prisma.user.findMany({ where: { roleId: null } });
  for (const user of usersMissingRole) {
    const roleKey = user.role === 'ADMIN' ? 'SUPER_ADMIN' : 'FIELD_ENGINEER';
    await prisma.user.update({ where: { id: user.id }, data: { roleId: roleByKey.get(roleKey).id } });
  }
  if (usersMissingRole.length) {
    console.log(`Backfilled roleId for ${usersMissingRole.length} existing user(s).`);
  }
}

/** Existing projects' legacy assignedEngineerId gets a matching ProjectMember row. */
async function backfillProjectMembers(roleByKey) {
  const projects = await prisma.project.findMany({ where: { assignedEngineerId: { not: null } } });
  let created = 0;
  for (const project of projects) {
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: project.assignedEngineerId } },
    });
    if (existing) continue;
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: project.assignedEngineerId, roleId: roleByKey.get('FIELD_ENGINEER').id },
    });
    created++;
  }
  if (created) {
    console.log(`Backfilled ${created} project member(s) from legacy assignedEngineerId.`);
  }
}

/**
 * Gives every client that has no StageDependency rows yet a straight chain (stage N depends on
 * stage N-1, by StageTemplate.order) — this reproduces the old hardcoded "order+1" locking
 * behavior exactly, so existing clients (V-Green included) see no change in stage-unlock order.
 * Clients that already have a dependency graph (freshly seeded with one, or configured via the
 * admin UI) are left untouched.
 */
async function backfillStageDependencies() {
  const clients = await prisma.client.findMany();
  let clientsBackfilled = 0;
  for (const client of clients) {
    const templates = await prisma.stageTemplate.findMany({
      where: { clientId: client.id },
      orderBy: { order: 'asc' },
    });
    if (templates.length < 2) continue;
    const existingDepCount = await prisma.stageDependency.count({
      where: { stageTemplateId: { in: templates.map((t) => t.id) } },
    });
    if (existingDepCount > 0) continue;
    await prisma.stageDependency.createMany({
      data: templates.slice(1).map((t, idx) => ({
        stageTemplateId: t.id,
        dependsOnTemplateId: templates[idx].id,
      })),
    });
    clientsBackfilled++;
  }
  if (clientsBackfilled) {
    console.log(`Backfilled a linear stage dependency chain for ${clientsBackfilled} client(s).`);
  }
}

function f(key, label, type, opts = {}) {
  return {
    key,
    label,
    type,
    required: !!opts.required,
    groupLabel: opts.group || null,
    optionsJson: opts.options
      ? { options: opts.options }
      : opts.rows
        ? { rows: opts.rows, columns: opts.columns || [{ key: 'value', label: 'Value' }] }
        : null,
  };
}

function photo(key, label, required = true) {
  return { key, label, required };
}

const STAGES = [
  {
    key: 'SURVEY',
    name: 'Site Survey',
    fields: [
      f('siteAddress', 'Site Address', 'text', { required: true }),
      f('gpsLocation', 'GPS Location', 'text', { required: true }),
      f('contactPersonName', 'Contact Person Name', 'text'),
      f('contactPersonPhone', 'Contact Person Phone', 'text'),
      f('dedicatedLoadRequirementKw', 'Dedicated Load Requirement (kW)', 'number'),
      f('existingDiscomName', 'Existing DISCOM Name', 'text'),
      f('nearestPoleOrTransformerDistanceM', 'Nearest Pole/Transformer Distance (m)', 'number'),
      f('parkingType', 'Parking Type', 'select', { options: ['Open', 'Covered', 'Basement'] }),
      f('siteRemarks', 'Site Remarks', 'text'),
      f('electricityBillFile', 'Electricity Bill (merged PDF)', 'file', { required: true }),
    ],
    photos: [
      photo('siteEntry', 'Site Entry'),
      photo('siteExit', 'Site Exit'),
      photo('proposedChargerLocation', 'Proposed Charger Location'),
      photo('parkingArea', 'Parking Area'),
      photo('nearestElectricalPole', 'Nearest Electrical Pole'),
      photo('boundaryOrStructureForCameraMount', 'Boundary/Structure for Camera Mount'),
      photo('electricityMeter', 'Electricity Meter'),
    ],
  },
  {
    key: 'DISCOM',
    name: 'DISCOM Application',
    fields: [
      f('companyDocAadhaar', 'Authorized Person/Director Aadhaar Card', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocPan', 'PAN Card', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocMoaAoa', 'MOA/AOA', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocRegistration', 'Company Registration Documents', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocGst', 'State GST Certificate', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocBank', 'Bank Details / Cancelled Cheque', 'checkbox', { required: true, group: 'Company Documents' }),
      f('companyDocAuthLetter', 'Authorization Letter / Board Resolution (if required)', 'checkbox', { group: 'Company Documents' }),

      f('siteDocDeed', 'Property Owner Deed / Ownership Proof', 'checkbox', { required: true, group: 'Site Documents' }),
      f('siteDocNoc', 'Property Owner NOC', 'checkbox', { required: true, group: 'Site Documents' }),
      f('siteDocLease', 'Lease/Rent Agreement (if applicable)', 'checkbox', { group: 'Site Documents' }),
      f('siteDocAddressProof', 'Site Address Proof & Location Details', 'checkbox', { required: true, group: 'Site Documents' }),

      f('techDocChargerDatasheet', 'EV Charger Technical Datasheet', 'checkbox', { required: true, group: 'Technical Documents' }),
      f('techDocPanelDatasheet', 'Panel Technical Datasheet', 'checkbox', { required: true, group: 'Technical Documents' }),
      f('techDocTransformerDatasheet', 'Transformer Technical Datasheet', 'checkbox', { group: 'Technical Documents' }),
      f('techDocRmuVcbDatasheet', 'RMU / VCB Technical Datasheet', 'checkbox', { group: 'Technical Documents' }),
      f('techDocLoadCalcSld', 'Load Calculation & Single Line Diagram (SLD)', 'checkbox', { required: true, group: 'Technical Documents' }),
      f('techDocOther', 'Any Other Required Technical Specifications', 'checkbox', { group: 'Technical Documents' }),

      f('connectionCategory', 'Connection Category', 'select', { required: true, options: ['LT', 'HT'] }),
      f('loadRequirementKw', 'Load Requirement (kW)', 'number', { required: true }),
      f('discomOfficeName', 'DISCOM Office Name', 'text'),
      f('concernedOfficerName', 'Concerned Officer Name', 'text'),
      f('concernedOfficerDesignation', 'Concerned Officer Designation', 'select', {
        options: ['JE (Junior Engineer)', 'AE (Assistant Engineer)', 'EE/EXEN (Executive Engineer)', 'Customer Help Desk', 'New Connection Department', 'Commercial Department'],
      }),
      f('applicationDate', 'Application Date', 'date', { required: true }),
      f('applicationNumber', 'Application Number', 'text'),
      f('feePaid', 'Fee Paid (INR)', 'number'),
      f('slaTracker', 'DISCOM TAT Tracker (Target end-to-end: 25 working days)', 'table', {
        rows: [
          'Application Scrutiny (Target 5 Days)',
          'Site Survey (Target 3 Days)',
          'Estimate Generation (Target 5 Days)',
          'DN Payment Confirmation (Target 2 Days)',
          'Meter Installation (Target 3 Days)',
          'Connection Energization (Target 2 Days)',
        ],
        columns: [
          { key: 'actualDate', label: 'Actual Date' },
          { key: 'status', label: 'Status' },
        ],
      }),
    ],
    photos: [photo('applicationReceipt', 'Application Receipt'), photo('discomOfficeVisit', 'DISCOM Office Visit')],
  },
  {
    key: 'LAYOUT_APPROVAL',
    name: 'Site Layout Approval',
    fields: [
      f('layoutDrawingFile', 'Site Layout Drawing', 'file', { required: true }),
      f('approvalEmailFile', 'Approval Email (from V-Green Coordinator)', 'file', { required: true }),
      f('approvedByName', 'Approved By', 'text'),
      f('approvalDate', 'Approval Date', 'date'),
      f('chkVehicleEntry', 'Vehicle Entry Point Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkVehicleExit', 'Vehicle Exit Point Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkRoadDirection', 'Main/Service Road Direction Shown', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkEvcsPosition', 'Exact EVCS Position Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkParkingMarked', 'Dedicated Parking Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkAcdbLocation', 'ACDB Mounting Location Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkEarthingPit', 'Earthing Pit Location Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkCctvPole', 'CCTV Camera Pole Location Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkSignBoard', 'Sign Board Location Marked', 'checkbox', { required: true, group: 'Layout Checklist' }),
      f('chkCableRoute', 'Cable Route / Trench Path Marked (if applicable)', 'checkbox', { group: 'Layout Checklist' }),
      f('chkDwcRoute', 'DWC Pipe Route Marked (if applicable)', 'checkbox', { group: 'Layout Checklist' }),
      f('chkClearance', 'Safe Clearance Space Confirmed', 'checkbox', { required: true, group: 'Layout Checklist' }),
    ],
    photos: [photo('approvedLayoutOnSite', 'Approved Layout as Marked on Site')],
  },
  {
    key: 'ELECTRICAL_DRAWING_APPROVAL',
    name: 'Electrical Drawing Approval',
    fields: [
      f('electricalDrawingFile', 'Electrical Drawing', 'file', { required: true }),
      f('approvalEmailFile', 'Approval Email (from V-Green Coordinator)', 'file', { required: true }),
      f('approvedByName', 'Approved By', 'text'),
      f('approvalDate', 'Approval Date', 'date'),
      f('chkAcdbLocation', 'ACDB Panel Location Shown', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkChargerLocation', 'Charger (EVCS) Location Shown', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkCableRoute', 'Cable Route / Trench Path Shown', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkDwcRoute', 'DWC Pipe Route Shown', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkEarthingDetails', 'Earthing Pit Connection Details Shown', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkIncomerCable', 'Incomer Cable Route & Size Shown (as per BOQ)', 'checkbox', { required: true, group: 'Drawing Checklist' }),
      f('chkCctvSignPower', 'CCTV & Sign Board Power Route Shown', 'checkbox', { group: 'Drawing Checklist' }),
    ],
    photos: [],
  },
  {
    key: 'CIVIL',
    name: 'Civil Work Execution',
    fields: [
      f('boqReference', 'BOQ Reference', 'text'),
      f('foundationDimensions', 'Foundation Dimensions', 'table', {
        required: true,
        rows: [
          'EVCS Foundation',
          'ACDB Foundation',
          'Camera Pole Foundation',
          'Bollard Foundation',
          'Earthing Pit Foundation',
          'Sign Board Foundation',
          "Do's & Don'ts Board Foundation",
        ],
        columns: [
          { key: 'approvedDims', label: 'Approved L×W×H (mm)' },
          { key: 'actualDims', label: 'Actual L×W×H (mm)' },
          { key: 'levelOk', label: 'Level OK?' },
        ],
      }),
      f('concreteGrade', 'Concrete Grade', 'select', { options: ['M15', 'M20', 'M25'] }),
      f('rccRatio', 'RCC Ratio (Cement:Sand:Aggregate)', 'text'),
      f('dwcPipeSizeMm', 'DWC Pipe Size (mm)', 'select', { options: ['130', '100'] }),
      f('dwcPipeRouteConfirmed', 'DWC Pipe Route Confirmed per Drawing', 'checkbox', { required: true }),
      f('paintBrand', 'Floor Paint Brand', 'select', { options: ['Asian Paints', 'Nerolac', 'Berger'] }),
      f('paintColor', 'Floor Paint Color', 'text'),
      f('markingWidthMm', 'Floor Marking Line Width (mm)', 'number'),
      f('curingLog', 'RCC Curing Log (minimum 5 days)', 'table', {
        required: true,
        rows: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
        columns: [
          { key: 'date', label: 'Date' },
          { key: 'wetBagMaintained', label: 'Wet Jute Bag Maintained?' },
        ],
      }),
    ],
    photos: [
      photo('evcsFoundationExcavation', 'EVCS Foundation Excavation'),
      photo('ironMeshInstalled', 'Iron Mesh Installed'),
      photo('rccCastingInProgress', 'RCC Casting In Progress'),
      photo('evcsFoundationFinished', 'EVCS Foundation Finished'),
      photo('acdbFoundationFinished', 'ACDB Foundation Finished'),
      photo('cameraPoleFoundationFinished', 'Camera Pole Foundation Finished'),
      photo('bollardsInstalled', 'Bollards Installed'),
      photo('earthingPitFoundationFinished', 'Earthing Pit Foundation Finished'),
      photo('signBoardFoundationFinished', 'Sign Board Foundation Finished'),
      photo('floorMarkingFinished', 'Floor Marking Finished'),
      photo('dwcPipeRouteBeforeBackfill', 'DWC Pipe Route Before Backfill'),
      photo('emptyPaintCans', 'Empty Paint Cans (for verification)'),
      photo('curingDay1', 'Curing — Day 1'),
      photo('curingDay2', 'Curing — Day 2'),
      photo('curingDay3', 'Curing — Day 3'),
      photo('curingDay4', 'Curing — Day 4'),
      photo('curingDay5', 'Curing — Day 5'),
    ],
  },
  {
    key: 'EARTHING',
    name: 'Chemical Earthing',
    fields: [
      f('pitCount', 'Number of Earthing Pits', 'number', { required: true }),
      f('pitDiameterM', 'Pit Diameter (m)', 'number'),
      f('soilCondition', 'Soil Condition', 'select', { options: ['Normal', 'Rocky', 'High moisture'] }),
      f('rodType', 'Rod Type', 'text'),
      f('chemicalCompoundPackets', 'Chemical Compound Packets Used', 'number'),
      f('chemicalCompoundKgPerPacket', 'Kg per Packet', 'number'),
      f('waterAddedGradually', 'Water Added Gradually (not all at once)', 'checkbox', { required: true }),
    ],
    photos: [
      photo('pitDigging', 'Pit Digging'),
      photo('rodInstallationVertical', 'Rod Installed Vertically'),
      photo('chemicalCompoundFilling', 'Chemical Compound Filling'),
      photo('pitBackfilled', 'Pit Backfilled'),
    ],
  },
  {
    key: 'WIRING',
    name: 'Cable Installation, Lugging, Ferruling & IR Testing',
    fields: [
      f('continuityTestResult', 'Continuity Test Result (before installation)', 'select', { required: true, options: ['Pass', 'Fail'] }),
      f('cableSize', 'Cable Size', 'text'),
      f('cableType', 'Cable Type', 'text'),
      f('cableRouteDescription', 'Cable Route Description', 'text'),
      f('correctLugSize', 'Correct Lug Size Used', 'checkbox', { required: true, group: 'Lugging & Ferruling Checklist' }),
      f('crimpingToolUsed', 'Heavy-Duty Crimping Tool Used (no hammer/temp fixing)', 'checkbox', { required: true, group: 'Lugging & Ferruling Checklist' }),
      f('ferrulingClear', 'Ferruling Clear & Machine-Printed (no handwritten)', 'checkbox', { required: true, group: 'Lugging & Ferruling Checklist' }),
      f('phaseColorCorrect', 'Phase Color Heat Sleeve Correct (R-Red/Y-Yellow/B-Blue/N-Black/E-Green)', 'checkbox', { required: true, group: 'Lugging & Ferruling Checklist' }),
      f('irTestReadings', 'Insulation Resistance (IR) Test Readings', 'table', {
        required: true,
        rows: ['Phase to Phase', 'Phase to Neutral', 'Phase to Earth', 'Neutral to Earth'],
        columns: [{ key: 'readingMOhm', label: 'Reading (MΩ)' }],
      }),
      f('meggerMeterModel', 'Megger Meter Model', 'text'),
      f('testedByName', 'Tested By', 'text'),
      f('testDate', 'Test Date', 'date'),
    ],
    photos: [
      photo('cableLayingInTrench', 'Cable Laying in Trench'),
      photo('cableLuggingCrimping', 'Cable Lugging/Crimping'),
      photo('ferrulingCloseUp', 'Ferruling Close-Up'),
      photo('meggerTestInProgress', 'Megger Test In Progress'),
      photo('meggerReadingDisplay', 'Megger Reading Display'),
    ],
  },
  {
    key: 'ACDB',
    name: 'ACDB Panel Installation & Testing',
    fields: [
      f('panelModel', 'Panel Model', 'text'),
      f('mountingMethod', 'Mounting Method', 'select', { options: ['Crane', 'Chain Pulley Block', 'Manpower'] }),
      f('fastenerType', 'Fastener Type', 'select', { options: ['Chemical Fastener', 'Anchor Fastener'] }),
      f('levelAlignmentOk', 'Level & Alignment OK', 'checkbox', { required: true }),
      f('outgoingMccbMcbOk', 'Outgoing MCCB/MCB Rating & Tightening OK', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('busbarConnectionsTight', 'Busbar Connections Tight', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('cableTerminationsOk', 'Incoming/Outgoing Cable Terminations Tight, Heat Sleeves OK', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('neutralEarthBarTight', 'Neutral & Earth Bar Connections Tight', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('indicatorsMetersWorking', 'MCCB/MCB/Indicators/Meters Working', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('noLooseWiringBurnMarks', 'No Loose Wiring / Burn Marks', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('ferrulingCableIdComplete', 'Ferruling & Cable Identification Complete', 'checkbox', { required: true, group: 'Panel Inspection Checklist' }),
      f('voltageTestReadings', 'Voltage Test Readings', 'table', {
        required: true,
        rows: ['R-Y', 'Y-B', 'B-R', 'R-N', 'Y-N', 'B-N'],
        columns: [{ key: 'voltageV', label: 'Voltage (V)' }],
      }),
      f('multimeterModel', 'Multimeter Model', 'text'),
      f('testedByName', 'Tested By', 'text'),
      f('testDate', 'Test Date', 'date'),
      f('noAbnormalSoundHeatingSparking', 'No Abnormal Sound/Heating/Sparking/Tripping', 'checkbox', { required: true }),
    ],
    photos: [
      photo('panelMountedExterior', 'Panel Mounted (Exterior)'),
      photo('panelInternalWiring', 'Panel Internal Wiring'),
      photo('testingInProgress', 'Testing In Progress'),
      photo('panelClosedFinal', 'Panel Closed (Final)'),
    ],
  },
  {
    key: 'CHARGER_INSTALL',
    name: 'Charger Delivery & Installation',
    fields: [
      f('chargerModel', 'Charger Model', 'text', { required: true, group: 'Delivery Inspection' }),
      f('serialNumber', 'Serial Number', 'text', { required: true, group: 'Delivery Inspection' }),
      f('capacityKw', 'Charger Capacity (kW)', 'number', { required: true, group: 'Delivery Inspection' }),
      f('quantity', 'Quantity', 'number', { required: true, group: 'Delivery Inspection' }),
      f('matchesApprovedBoq', 'Matches Approved BOQ & Dispatch Details', 'checkbox', { required: true, group: 'Delivery Inspection' }),
      f('physicalDamageFound', 'Physical Damage Found', 'select', { required: true, options: ['Yes', 'No'], group: 'Delivery Inspection' }),
      f('damageNotes', 'Damage Notes (if any)', 'text', { group: 'Delivery Inspection' }),
      f('accessoriesComplete', 'Accessories Complete (gun holder, cable, mounting items, documents)', 'checkbox', { required: true, group: 'Delivery Inspection' }),

      f('foundationReadyConfirmed', 'RCC Foundation Ready Confirmed', 'checkbox', { required: true, group: 'Installation' }),
      f('mountingMethod', 'Mounting Method', 'select', { options: ['Crane', 'Hydra'], group: 'Installation' }),
      f('fastenerType', 'Fastener Type', 'select', { options: ['Chemical Fastener', 'Anchor Fastener'], group: 'Installation' }),
      f('alignmentLevelOk', 'Alignment & Level OK', 'checkbox', { required: true, group: 'Installation' }),
      f('clearanceMaintained', 'Clearance for Operation & Maintenance Maintained', 'checkbox', { required: true, group: 'Installation' }),
    ],
    photos: [
      photo('deliveryFrontView', 'Delivery — Front View'),
      photo('deliveryBackView', 'Delivery — Back View'),
      photo('deliverySideView1', 'Delivery — Side View 1'),
      photo('deliverySideView2', 'Delivery — Side View 2'),
      photo('unboxingAccessories', 'Unboxing / Accessories'),
      photo('chargerInstalledFront', 'Charger Installed — Front'),
      photo('chargerInstalledSide', 'Charger Installed — Side'),
      photo('chargerFoundationClose', 'Charger Foundation Close-Up'),
    ],
  },
  {
    key: 'TESTING',
    name: 'Electrical Testing & Pre-Energization',
    fields: [
      f('allElectricalWorkComplete', 'All Electrical Work Complete', 'checkbox', { required: true, group: 'Safety Checklist' }),
      f('fastenersMountsTight', 'All Fasteners & Mounting Supports Tight', 'checkbox', { required: true, group: 'Safety Checklist' }),
      f('ppeUsed', 'PPE Used', 'checkbox', { required: true, group: 'Safety Checklist' }),
      f('noUnauthorizedPerson', 'No Unauthorized Person Near Station', 'checkbox', { required: true, group: 'Safety Checklist' }),
      f('siteCleanSafe', 'Site Clean & Safe for Operation', 'checkbox', { required: true, group: 'Safety Checklist' }),

      f('earthingResistanceOhm', 'Earthing Resistance (Ω)', 'number', { required: true }),
      f('phaseNeutralEarthChecked', 'Phase/Neutral/Earth Connections Checked', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('voltagePhaseSequenceVerified', 'Incoming/Outgoing Voltage & Phase Sequence Verified', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('cableConnectionsTight', 'Cable Connections & Terminations Tight', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('cableDressingOk', 'Cable Dressing OK, No Exposed Conductor', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('lugCrimpingHeatSleeveOk', 'Lug Crimping / Heat Sleeve / Color Coding Verified', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('mcbMccbProtectionOk', 'MCB/MCCB/Protection Devices Working', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('busbarTightnessOk', 'Busbar Tightness & Internal Panel Connections OK', 'checkbox', { required: true, group: 'Electrical Checklist' }),
      f('incomingVoltageV', 'Incoming Voltage (V)', 'number'),
      f('phaseSequenceOk', 'Phase Sequence OK', 'checkbox'),

      f('internalAreaClean', 'ACDB/Charger Internal Area Clean, No Loose Wire/Tools', 'checkbox', { required: true, group: 'Panel & Charger Internal Checklist' }),
      f('wasteRemoved', 'All Waste & Packing Material Removed', 'checkbox', { required: true, group: 'Panel & Charger Internal Checklist' }),
    ],
    photos: [
      photo('earthingTestMeterReading', 'Earthing Test — Meter Reading'),
      photo('voltageTestReading', 'Voltage Test Reading'),
      photo('panelInternalCleanFinal', 'Panel Internal — Clean & Final'),
    ],
  },
  {
    key: 'COMMISSIONING',
    name: 'Final Energization & Commissioning',
    fields: [
      f('simCardAvailable', 'SIM Card Available at Site', 'checkbox', { required: true }),
      f('simCardNumber', 'SIM Card Number', 'text'),
      f('electricalPowerAvailable', 'Electrical Power Available', 'checkbox', { required: true }),
      f('finalElectricalInspectionDone', 'Final Electrical Inspection Done', 'checkbox', { required: true }),

      f('incomerMccbOn', 'Incomer MCCB ON', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('voltagePhaseSequenceVerified', 'Voltage & Phase Sequence Verified Before Outgoing ON', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('outgoingMccbOnNoAbnormal', 'Outgoing MCCB ON — No Abnormal Sound/Smell/Heat/Spark/Trip', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('chargerBootedDisplayOk', 'Charger Booted, Display Healthy, No Fault', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('eStopTestedOk', 'Emergency Stop (E-Stop) Tested OK', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('gunLockUnlockVerified', 'Gun Lock/Unlock Verified', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),
      f('displayLedCommsOk', 'Display/LED/Communication Status OK', 'checkbox', { required: true, group: 'Charger Power ON Checklist' }),

      f('simInstalled', 'SIM Installed', 'checkbox'),
      f('cmsOnlineStatus', 'CMS Online Status', 'select', { required: true, options: ['Online', 'Offline'] }),
      f('functionalTestPassed', 'Functional Test Passed (charging, connector, E-stop, interlocks)', 'checkbox', { required: true }),

      f('vehicleType', 'Vehicle Type', 'text'),
      f('connectorType', 'Connector Type', 'select', { options: ['CCS2', 'GB/T', 'AC Type-2', 'Other'] }),
      f('chargingSessionStarted', 'Trial Charging Session Started', 'checkbox', { required: true }),
      f('trialChargingReadings', 'Trial Charging Readings', 'table', {
        required: true,
        rows: ['Voltage (V)', 'Current (A)', 'Charging Time (min)', 'Energy Consumed (kWh)', 'Fault/Error Alarm'],
        columns: [{ key: 'value', label: 'Value' }],
      }),
      f('gunLockUnlockAfterChargingOk', 'Gun Lock/Unlock After Charging OK', 'checkbox', { required: true }),
      f('goLiveConfirmedBy', 'Go-Live Confirmed By (V-Green Setup Manager)', 'text'),
      f('powerOnAndTrialChargingVideo', 'Power ON & Trial Charging Video', 'file'),
    ],
    photos: [
      photo('chargerPowerOnDisplay', 'Charger Power ON — Display'),
      photo('cmsOnlineScreenshot', 'CMS Online Screenshot'),
      photo('vehicleConnectedCharging', 'Vehicle Connected & Charging'),
      photo('trialChargingScreenDisplay', 'Trial Charging Screen Display'),
    ],
  },
  {
    key: 'HOTO',
    name: 'HOTO (Handover Takeover)',
    fields: [
      f('siteDetailsCorrect', 'Site Details Correct', 'checkbox', { required: true, group: 'HOTO Checklist' }),
      f('chargerDetailsSerialCorrect', 'Charger Details / Serial Number Correct', 'checkbox', { required: true, group: 'HOTO Checklist' }),
      f('locationDateCorrect', 'Location / Date Correct', 'checkbox', { required: true, group: 'HOTO Checklist' }),
      f('noMissingPhoto', 'No Missing Photo', 'checkbox', { required: true, group: 'HOTO Checklist' }),
      f('noIncompleteDocument', 'No Incomplete Document', 'checkbox', { required: true, group: 'HOTO Checklist' }),

      f('docBoqSoftCopy', 'BOQ Soft Copy', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docSiteSurveyReport', 'Site Survey Report', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docAppendixFile', 'Appendix File', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docDiscomDnReceipt', 'DISCOM DN Payment Receipt (if any)', 'checkbox', { group: 'Final Documents Handover' }),
      f('docApprovedSiteLayout', 'Approved Site Layout Drawing (ACDB + EVCS Locations)', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docApprovedElectricalPanel', 'Approved Electrical Panel Drawing', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docCivilInspectionReport', 'Civil Work Inspection Report + Geotagged Photos', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docCableContinuityReport', 'Cable Continuity Test Report + Geotagged Photos', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docVoltageTestReport', 'Voltage Test Report + Geotagged Photos', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docIrTestReport', 'Insulation Resistance (IR) Test Report + Geotagged Photos', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docEarthingResistanceReport', 'Earthing Resistance Test Report + Geotagged Photos', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docHotoChecklist', 'HOTO Checklist', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docFinalHotoPhotos', 'Final HOTO Photos (Geotagged)', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docSiteInspectionEmail', 'Site Inspection Final Report — Email Confirmation', 'checkbox', { required: true, group: 'Final Documents Handover' }),
      f('docTaxInvoice', 'Tax Invoice', 'checkbox', { required: true, group: 'Final Documents Handover' }),

      f('inspectionMode', 'Final Inspection Mode', 'select', { required: true, options: ['Physical', 'Video Call'], group: 'Final Site Inspection' }),
      f('inspectorName', 'Inspector Name', 'text', { required: true, group: 'Final Site Inspection' }),
      f('inspectionDate', 'Inspection Date', 'date', { required: true, group: 'Final Site Inspection' }),
      f('finalApprovalEmailFile', 'Final Approval Email', 'file', { required: true, group: 'Final Site Inspection' }),
    ],
    photos: [
      photo('chargerFrontFinal', 'Charger — Front (Final)'),
      photo('chargerSideFinal', 'Charger — Side (Final)'),
      photo('acdbPanelFinal', 'ACDB Panel (Final)'),
      photo('earthingPitFinal', 'Earthing Pit (Final)'),
      photo('bollardsFinal', 'Bollards (Final)'),
      photo('signBoardFinal', 'Sign Board (Final)'),
      photo('cctvCameraFinal', 'CCTV Camera (Final)'),
      photo('siteOverallFinal', 'Site Overall (Final)'),
      photo('fireExtinguisherFinal', 'Fire Extinguisher (Final)'),
    ],
  },
];

async function seedUsers(roleByKey) {
  const demoPassword = 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nakjm.example' },
    update: {},
    create: {
      email: 'admin@nakjm.example',
      passwordHash,
      name: 'NaKJM Admin',
      role: 'ADMIN',
      roleId: roleByKey.get('SUPER_ADMIN').id,
    },
  });

  const engineer = await prisma.user.upsert({
    where: { email: 'engineer@nakjm.example' },
    update: {},
    create: {
      email: 'engineer@nakjm.example',
      passwordHash,
      name: 'Field Engineer (Demo)',
      role: 'ENGINEER',
      roleId: roleByKey.get('FIELD_ENGINEER').id,
    },
  });

  console.log(`Seeded users — admin@nakjm.example / engineer@nakjm.example (password: ${demoPassword})`);
  return { admin, engineer };
}

async function seedVGreen() {
  const client = await prisma.client.upsert({
    where: { name: 'V-Green India' },
    update: {},
    create: { name: 'V-Green India' },
  });

  const existingStageCount = await prisma.stageTemplate.count({ where: { clientId: client.id } });
  if (existingStageCount > 0) {
    console.log('V-Green stage templates already seeded, skipping.');
    return client;
  }

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    await prisma.stageTemplate.create({
      data: {
        clientId: client.id,
        key: stage.key,
        name: stage.name,
        order: i + 1,
        fieldDefs: {
          create: stage.fields.map((field, idx) => ({ ...field, order: idx + 1 })),
        },
        photoSlots: {
          create: stage.photos.map((p, idx) => ({ ...p, order: idx + 1 })),
        },
      },
    });
  }
  console.log(`Seeded ${STAGES.length} V-Green stage templates.`);
  return client;
}

async function seedSampleProject(client, engineer) {
  const existing = await prisma.project.findFirst({ where: { clientId: client.id } });
  if (existing) {
    console.log('Sample project already exists, skipping.');
    return;
  }
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        clientId: client.id,
        siteName: 'Sample EVCS — MG Road',
        address: 'MG Road Fuel Station, Bengaluru, Karnataka',
        lat: 12.9756,
        lng: 77.6068,
        assignedEngineerId: engineer.id,
      },
    });
    await createProjectStages(tx, { projectId: created.id, clientId: client.id });
    return created;
  });
  console.log(`Seeded sample project: ${project.siteName}`);
}

async function main() {
  const roleByKey = await seedRolesAndPermissions();
  await seedConfigDefs();
  const { engineer } = await seedUsers(roleByKey);
  await backfillUserRoles(roleByKey);
  const client = await seedVGreen();
  await backfillStageDependencies();
  await seedSampleProject(client, engineer);
  await backfillProjectMembers(roleByKey);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

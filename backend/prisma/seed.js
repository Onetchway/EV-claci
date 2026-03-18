const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Franchises
  const f1 = await prisma.franchise.upsert({ where: { id: 'franchise-1' }, update: {}, create: { id: 'franchise-1', name: 'Sharma Investments Pvt Ltd', contactName: 'Ravi Sharma', contactEmail: 'ravi@sharma.com', contactPhone: '+91-9876543210', franchiseType: 'INVESTOR', revenueSharePercent: 25, investmentAmount: 2500000, isActive: true } });
  const f2 = await prisma.franchise.upsert({ where: { id: 'franchise-2' }, update: {}, create: { id: 'franchise-2', name: 'Patel Land Holdings', contactName: 'Anita Patel', contactEmail: 'anita@patel.com', contactPhone: '+91-9876543211', franchiseType: 'LAND_OWNER', revenueSharePercent: 15, investmentAmount: 0, isActive: true } });

  // Stations
  const s1 = await prisma.station.upsert({ where: { id: 'station-1' }, update: {}, create: { id: 'station-1', name: 'Electriva Hub - Connaught Place', latitude: 28.6304, longitude: 77.2177, address: 'L Block, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', stationType: 'PUBLIC', electricityRate: 6.5, sellingRate: 14.0 } });
  const s2 = await prisma.station.upsert({ where: { id: 'station-2' }, update: {}, create: { id: 'station-2', name: 'Electriva Fleet Hub - Gurugram', latitude: 28.4595, longitude: 77.0266, address: 'Sector 44, Gurugram', city: 'Gurugram', state: 'Haryana', pincode: '122003', stationType: 'FLEET', electricityRate: 6.0, sellingRate: 12.5 } });
  const s3 = await prisma.station.upsert({ where: { id: 'station-3' }, update: {}, create: { id: 'station-3', name: 'Electriva BSS Hub - Noida', latitude: 28.5355, longitude: 77.3910, address: 'Sector 18, Noida', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301', stationType: 'BSS_HUB', electricityRate: 7.0, sellingRate: 15.0 } });

  // Assets & Chargers
  const a1 = await prisma.asset.upsert({ where: { id: 'asset-1' }, update: {}, create: { id: 'asset-1', stationId: s1.id, assetType: 'CHARGER', name: 'DC Fast Charger #1', capacity: 150, oem: 'ABB', installedBy: 'COMPANY', ownership: 'COMPANY', status: 'ACTIVE', commissionDate: new Date('2024-01-15') } });
  const a2 = await prisma.asset.upsert({ where: { id: 'asset-2' }, update: {}, create: { id: 'asset-2', stationId: s1.id, assetType: 'CHARGER', name: 'AC Charger #1', capacity: 22, oem: 'Exicom', installedBy: 'FRANCHISE', ownership: 'FRANCHISE', franchiseId: f1.id, status: 'ACTIVE', commissionDate: new Date('2024-02-01') } });
  const a3 = await prisma.asset.upsert({ where: { id: 'asset-3' }, update: {}, create: { id: 'asset-3', stationId: s2.id, assetType: 'CHARGER', name: 'CCS Charger #1', capacity: 60, oem: 'Delta', installedBy: 'COMPANY', ownership: 'FRANCHISE', franchiseId: f2.id, status: 'ACTIVE', commissionDate: new Date('2024-03-10') } });

  await prisma.charger.upsert({ where: { id: 'charger-1' }, update: {}, create: { id: 'charger-1', assetId: a1.id, connectorType: 'CCS', powerRating: 150, ocppId: 'ELEC-CP-001', status: 'AVAILABLE', lastHeartbeat: new Date() } });
  await prisma.charger.upsert({ where: { id: 'charger-2' }, update: {}, create: { id: 'charger-2', assetId: a2.id, connectorType: 'Type2 AC', powerRating: 22, ocppId: 'ELEC-CP-002', status: 'CHARGING', lastHeartbeat: new Date() } });
  await prisma.charger.upsert({ where: { id: 'charger-3' }, update: {}, create: { id: 'charger-3', assetId: a3.id, connectorType: 'CCS', powerRating: 60, ocppId: 'ELEC-CP-003', status: 'AVAILABLE', lastHeartbeat: new Date() } });

  // BSS
  await prisma.bSS.upsert({ where: { id: 'bss-1' }, update: {}, create: { id: 'bss-1', stationId: s3.id, name: 'BSS Unit 1', numberOfBatteries: 20, batteryType: 'LFP', batteryCapacityKwh: 1.5, swapPrice: 80, rentalPriceDaily: 150, rentalPriceMonthly: 3500 } });

  // Revenue (last 7 days)
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const cr = 3500 + Math.random() * 2000;
    const ec = cr * 0.45;
    const fp = cr * 0.2;
    await prisma.revenue.upsert({
      where: { stationId_date: { stationId: s1.id, date: d } }, update: {},
      create: { stationId: s1.id, date: d, chargingRevenue: cr, bssSwapRevenue: 0, bssRentalRevenue: 0, totalRevenue: cr, electricityCost: ec, grossMargin: cr - ec, franchisePayout: fp, netRevenue: cr - ec - fp, energyKwh: cr / 14, sessionsCount: Math.floor(15 + Math.random() * 20) },
    });
    const cr2 = 2000 + Math.random() * 1500;
    const ec2 = cr2 * 0.48;
    await prisma.revenue.upsert({
      where: { stationId_date: { stationId: s2.id, date: d } }, update: {},
      create: { stationId: s2.id, date: d, chargingRevenue: cr2, bssSwapRevenue: 0, bssRentalRevenue: 0, totalRevenue: cr2, electricityCost: ec2, grossMargin: cr2 - ec2, franchisePayout: cr2 * 0.15, netRevenue: cr2 - ec2 - cr2 * 0.15, energyKwh: cr2 / 12.5, sessionsCount: Math.floor(8 + Math.random() * 15) },
    });
  }

  // Settlement
  await prisma.settlement.upsert({ where: { id: 'settle-1' }, update: {}, create: { id: 'settle-1', franchiseId: f1.id, periodStart: new Date('2025-02-01'), periodEnd: new Date('2025-02-28'), totalRevenue: 85000, franchiseShare: 21250, companyShare: 63750, status: 'PAID', settledAt: new Date('2025-03-05') } });

  console.log('✅ Seed complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

const svc = require('../services/revenue.service');
const { sendCsv } = require('../utils/csvExport');

exports.list           = async (req, res, next) => { try { res.json(await svc.list(req.query)); } catch (e) { next(e); } };
exports.byStation      = async (req, res, next) => { try { res.json(await svc.byStation(req.params.stationId, req.query)); } catch (e) { next(e); } };
exports.computeRevenue = async (req, res, next) => { try { res.json(await svc.computeRevenue(req.body.stationId, req.body.date)); } catch (e) { next(e); } };
exports.summary        = async (req, res, next) => { try { res.json(await svc.summary(req.query)); } catch (e) { next(e); } };
exports.pnl            = async (req, res, next) => { try { res.json(await svc.pnl(req.query)); } catch (e) { next(e); } };

exports.exportCsv = async (req, res, next) => {
  try {
    const result = await svc.list({ ...req.query, limit: 10000 });
    const rows = result.data.map(r => ({
      Date: r.date, Station: r.station?.name, City: r.station?.city,
      ChargingRevenue: r.chargingRevenue, BSSSwapRevenue: r.bssSwapRevenue, BSSRentalRevenue: r.bssRentalRevenue,
      TotalRevenue: r.totalRevenue, ElectricityCost: r.electricityCost, GrossMargin: r.grossMargin,
      FranchisePayout: r.franchisePayout, NetRevenue: r.netRevenue, EnergyKwh: r.energyKwh, Sessions: r.sessionsCount,
    }));
    sendCsv(res, rows, `revenue-export-${new Date().toISOString().slice(0,10)}.csv`);
  } catch (e) { next(e); }
};

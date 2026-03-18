'use strict';

const service = require('./stations.service');

async function listStations(req, res) {
  try {
    const { city, state, station_type, status, page = 1, limit = 20 } = req.query;
    const result = await service.listStations({ city, state, station_type, status, page, limit });
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message: 'Stations retrieved successfully',
    });
  } catch (err) {
    console.error('listStations error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getStation(req, res) {
  try {
    const station = await service.getStationById(req.params.id);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    return res.status(200).json({ success: true, data: station, message: 'Station retrieved successfully' });
  } catch (err) {
    console.error('getStation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function createStation(req, res) {
  try {
    const { name, address, city, state, latitude, longitude, station_type, electricity_rate, selling_rate, status } = req.body;
    if (!name || !address || !city || !state || !station_type) {
      return res.status(400).json({ success: false, message: 'name, address, city, state, and station_type are required' });
    }
    const station = await service.createStation({ name, address, city, state, latitude, longitude, station_type, electricity_rate, selling_rate, status });
    return res.status(201).json({ success: true, data: station, message: 'Station created successfully' });
  } catch (err) {
    console.error('createStation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updateStation(req, res) {
  try {
    const station = await service.updateStation(req.params.id, req.body);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found or no valid fields to update' });
    }
    return res.status(200).json({ success: true, data: station, message: 'Station updated successfully' });
  } catch (err) {
    console.error('updateStation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteStation(req, res) {
  try {
    const deleted = await service.deleteStation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    return res.status(200).json({ success: true, data: null, message: 'Station deleted successfully' });
  } catch (err) {
    console.error('deleteStation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function getStationSummary(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const result = await service.getStationSummary(req.params.id, start_date, end_date);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    return res.status(200).json({ success: true, data: result, message: 'Station summary retrieved successfully' });
  } catch (err) {
    console.error('getStationSummary error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { listStations, getStation, createStation, updateStation, deleteStation, getStationSummary };

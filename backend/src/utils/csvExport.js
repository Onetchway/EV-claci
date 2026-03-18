'use strict';

const { createObjectCsvStringifier } = require('csv-writer');

/**
 * Send rows as CSV response
 * @param {Response} res - Express response
 * @param {Array<Object>} rows - Array of plain objects
 * @param {string} filename - Output filename
 */
const sendCsv = (res, rows, filename) => {
  if (!rows || rows.length === 0) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send('');
  }

  const headers = Object.keys(rows[0]).map(key => ({ id: key, title: key }));
  const csvStringifier = createObjectCsvStringifier({ header: headers });

  const output = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(output);
};

module.exports = { sendCsv };

const { stringify } = require('csv-stringify');

const sendCsv = (res, rows, filename) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  stringify(rows, { header: true }, (err, output) => {
    if (err) return res.status(500).json({ error: 'CSV generation failed.' });
    res.send(output);
  });
};

module.exports = { sendCsv };

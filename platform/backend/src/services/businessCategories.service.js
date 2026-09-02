'use strict';

const { query } = require('../config/database');

const list = async () => {
  const res = await query(`SELECT * FROM business_categories WHERE is_active = true ORDER BY sort_order, name`);
  return res.rows;
};

// The full feature catalog with this category's recommendation
// ('core'/'optional') attached where one exists -- null for a feature the
// category doesn't specifically recommend either way, so the wizard can
// still show every feature, just without a pre-checked/pre-highlighted
// state for those.
const getRecommendations = async (categoryKey) => {
  const categoryRes = await query(`SELECT * FROM business_categories WHERE key = $1`, [categoryKey]);
  const category = categoryRes.rows[0];
  if (!category) { const e = new Error('Unknown business category.'); e.status = 404; throw e; }

  const res = await query(
    `SELECT fc.key, fc.name, fc.description, fc.category AS module_category, fc.is_default_enabled,
            bcf.recommendation
     FROM feature_catalog fc
     LEFT JOIN business_category_features bcf ON bcf.feature_key = fc.key AND bcf.category_key = $1
     ORDER BY fc.category, fc.name`,
    [categoryKey]
  );
  return { category, features: res.rows };
};

module.exports = { list, getRecommendations };

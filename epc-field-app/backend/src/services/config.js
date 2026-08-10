const prisma = require('../config/prisma');

/** Resolution order for a project-scoped read: ProjectConfig > ClientConfig > ConfigDef default. */

function validateValue(configDef, value) {
  switch (configDef.valueType) {
    case 'STRING':
      if (typeof value !== 'string') throw badValue(configDef, 'a string');
      break;
    case 'NUMBER':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw badValue(configDef, 'a finite number');
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') throw badValue(configDef, 'a boolean');
      break;
    case 'JSON':
      break; // any JSON-serializable value is accepted
    default:
      break;
  }
}

function badValue(configDef, expected) {
  return Object.assign(new Error(`Value for "${configDef.key}" must be ${expected}`), { status: 400 });
}

async function getConfigDefOrThrow(key) {
  const def = await prisma.configDef.findUnique({ where: { key } });
  if (!def) throw Object.assign(new Error(`Unknown config key "${key}"`), { status: 404 });
  return def;
}

async function resolveClientConfig(clientId, key) {
  const def = await getConfigDefOrThrow(key);
  const override = await prisma.clientConfig.findUnique({
    where: { clientId_configDefId: { clientId, configDefId: def.id } },
  });
  return override ? override.valueJson : def.defaultValueJson;
}

async function resolveProjectConfig(project, key) {
  const def = await getConfigDefOrThrow(key);
  if (def.scope === 'CLIENT') return resolveClientConfig(project.clientId, key);
  const override = await prisma.projectConfig.findUnique({
    where: { projectId_configDefId: { projectId: project.id, configDefId: def.id } },
  });
  if (override) return override.valueJson;
  return resolveClientConfig(project.clientId, key);
}

/** Full editor view for a client: every CLIENT/BOTH-scoped def, its default, and any override. */
async function getResolvedClientConfigs(clientId) {
  const defs = await prisma.configDef.findMany({ where: { scope: { in: ['CLIENT', 'BOTH'] } } });
  const overrides = await prisma.clientConfig.findMany({ where: { clientId } });
  const overrideByDefId = new Map(overrides.map((o) => [o.configDefId, o]));
  return defs.map((def) => {
    const override = overrideByDefId.get(def.id);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      valueType: def.valueType,
      scope: def.scope,
      defaultValue: def.defaultValueJson,
      overrideValue: override ? override.valueJson : null,
      effectiveValue: override ? override.valueJson : def.defaultValueJson,
    };
  });
}

/** Full editor view for a project: every PROJECT/BOTH-scoped def, showing what it inherits. */
async function getResolvedProjectConfigs(project) {
  const defs = await prisma.configDef.findMany({ where: { scope: { in: ['PROJECT', 'BOTH'] } } });
  const clientOverrides = await prisma.clientConfig.findMany({ where: { clientId: project.clientId } });
  const clientOverrideByDefId = new Map(clientOverrides.map((o) => [o.configDefId, o]));
  const projectOverrides = await prisma.projectConfig.findMany({ where: { projectId: project.id } });
  const projectOverrideByDefId = new Map(projectOverrides.map((o) => [o.configDefId, o]));

  return defs.map((def) => {
    const clientOverride = clientOverrideByDefId.get(def.id);
    const clientValue = clientOverride ? clientOverride.valueJson : def.defaultValueJson;
    const projectOverride = projectOverrideByDefId.get(def.id);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      valueType: def.valueType,
      scope: def.scope,
      defaultValue: def.defaultValueJson,
      clientValue,
      overrideValue: projectOverride ? projectOverride.valueJson : null,
      effectiveValue: projectOverride ? projectOverride.valueJson : clientValue,
    };
  });
}

async function setClientConfig(clientId, key, value) {
  const def = await getConfigDefOrThrow(key);
  validateValue(def, value);
  await prisma.clientConfig.upsert({
    where: { clientId_configDefId: { clientId, configDefId: def.id } },
    update: { valueJson: value },
    create: { clientId, configDefId: def.id, valueJson: value },
  });
}

async function clearClientConfig(clientId, key) {
  const def = await getConfigDefOrThrow(key);
  await prisma.clientConfig.deleteMany({ where: { clientId, configDefId: def.id } });
}

async function setProjectConfig(projectId, key, value) {
  const def = await getConfigDefOrThrow(key);
  if (def.scope === 'CLIENT') {
    throw Object.assign(new Error(`"${key}" is a client-level setting and cannot be overridden per project`), { status: 400 });
  }
  validateValue(def, value);
  await prisma.projectConfig.upsert({
    where: { projectId_configDefId: { projectId, configDefId: def.id } },
    update: { valueJson: value },
    create: { projectId, configDefId: def.id, valueJson: value },
  });
}

async function clearProjectConfig(projectId, key) {
  const def = await getConfigDefOrThrow(key);
  await prisma.projectConfig.deleteMany({ where: { projectId, configDefId: def.id } });
}

module.exports = {
  resolveClientConfig,
  resolveProjectConfig,
  getResolvedClientConfigs,
  getResolvedProjectConfigs,
  setClientConfig,
  clearClientConfig,
  setProjectConfig,
  clearProjectConfig,
};

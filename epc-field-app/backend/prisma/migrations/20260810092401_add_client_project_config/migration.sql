-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "ConfigScope" AS ENUM ('CLIENT', 'PROJECT', 'BOTH');

-- CreateTable
CREATE TABLE "config_defs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "valueType" "ConfigValueType" NOT NULL,
    "scope" "ConfigScope" NOT NULL,
    "defaultValueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_configs" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "configDefId" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "configDefId" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_defs_key_key" ON "config_defs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "client_configs_clientId_configDefId_key" ON "client_configs"("clientId", "configDefId");

-- CreateIndex
CREATE UNIQUE INDEX "project_configs_projectId_configDefId_key" ON "project_configs"("projectId", "configDefId");

-- AddForeignKey
ALTER TABLE "client_configs" ADD CONSTRAINT "client_configs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_configs" ADD CONSTRAINT "client_configs_configDefId_fkey" FOREIGN KEY ("configDefId") REFERENCES "config_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_configs" ADD CONSTRAINT "project_configs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_configs" ADD CONSTRAINT "project_configs_configDefId_fkey" FOREIGN KEY ("configDefId") REFERENCES "config_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

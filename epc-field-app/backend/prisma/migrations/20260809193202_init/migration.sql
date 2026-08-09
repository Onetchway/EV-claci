-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ENGINEER');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('text', 'number', 'date', 'select', 'checkbox', 'table', 'photo', 'file');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('LOCKED', 'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ENGINEER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_templates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_field_defs" (
    "id" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "groupLabel" TEXT,
    "optionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_field_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_slots" (
    "id" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedEngineerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_stages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "projectStageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "dataJson" JSONB NOT NULL,
    "submittedById" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "photoSlotId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "stampedUrl" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "address" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stage_templates_clientId_key_key" ON "stage_templates"("clientId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "form_field_defs_stageTemplateId_key_key" ON "form_field_defs"("stageTemplateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "photo_slots_stageTemplateId_key_key" ON "photo_slots"("stageTemplateId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "project_stages_projectId_stageTemplateId_key" ON "project_stages"("projectId", "stageTemplateId");

-- AddForeignKey
ALTER TABLE "stage_templates" ADD CONSTRAINT "stage_templates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_field_defs" ADD CONSTRAINT "form_field_defs_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "stage_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_slots" ADD CONSTRAINT "photo_slots_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "stage_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_assignedEngineerId_fkey" FOREIGN KEY ("assignedEngineerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "stage_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_projectStageId_fkey" FOREIGN KEY ("projectStageId") REFERENCES "project_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_photoSlotId_fkey" FOREIGN KEY ("photoSlotId") REFERENCES "photo_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

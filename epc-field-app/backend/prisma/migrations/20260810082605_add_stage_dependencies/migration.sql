-- CreateTable
CREATE TABLE "stage_dependencies" (
    "id" TEXT NOT NULL,
    "stageTemplateId" TEXT NOT NULL,
    "dependsOnTemplateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stage_dependencies_stageTemplateId_dependsOnTemplateId_key" ON "stage_dependencies"("stageTemplateId", "dependsOnTemplateId");

-- AddForeignKey
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_stageTemplateId_fkey" FOREIGN KEY ("stageTemplateId") REFERENCES "stage_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_dependencies" ADD CONSTRAINT "stage_dependencies_dependsOnTemplateId_fkey" FOREIGN KEY ("dependsOnTemplateId") REFERENCES "stage_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

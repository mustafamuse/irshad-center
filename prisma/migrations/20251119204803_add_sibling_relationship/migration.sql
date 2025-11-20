-- CreateTable
CREATE TABLE "public"."SiblingRelationship" (
    "id" TEXT NOT NULL,
    "person1Id" TEXT NOT NULL,
    "person2Id" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiblingRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiblingRelationship_person1Id_person2Id_key" ON "public"."SiblingRelationship"("person1Id", "person2Id");

-- CreateIndex
CREATE INDEX "SiblingRelationship_person1Id_idx" ON "public"."SiblingRelationship"("person1Id");

-- CreateIndex
CREATE INDEX "SiblingRelationship_person2Id_idx" ON "public"."SiblingRelationship"("person2Id");

-- CreateIndex
CREATE INDEX "SiblingRelationship_isActive_idx" ON "public"."SiblingRelationship"("isActive");

-- AddForeignKey
ALTER TABLE "public"."SiblingRelationship" ADD CONSTRAINT "SiblingRelationship_person1Id_fkey" FOREIGN KEY ("person1Id") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SiblingRelationship" ADD CONSTRAINT "SiblingRelationship_person2Id_fkey" FOREIGN KEY ("person2Id") REFERENCES "public"."Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

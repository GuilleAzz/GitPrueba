-- CreateEnum
CREATE TYPE "TipoPlantillaOca" AS ENUM ('RENUNCIA', 'AUSENCIA', 'OTRO', 'ARCA');

-- AlterEnum
ALTER TYPE "MotivoCierreAdmin" ADD VALUE 'TRASPASO_CLIENTE';

-- AlterTable
ALTER TABLE "bitacora" ADD COLUMN     "plantillaOcaId" TEXT;

-- CreateTable
CREATE TABLE "tarea_alerta_mail" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "umbral" INTEGER NOT NULL,
    "enviadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarea_alerta_mail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_oca" (
    "id" TEXT NOT NULL,
    "tipoPlantilla" "TipoPlantillaOca" NOT NULL,
    "datos" JSONB NOT NULL,
    "archivoUrl" TEXT NOT NULL,
    "archivoStorageKey" TEXT NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "archivoTamanio" INTEGER NOT NULL,
    "descripcion" TEXT,
    "casoId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "eliminadoEn" TIMESTAMP(3),
    "eliminadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantilla_oca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarea_alerta_mail_tareaId_idx" ON "tarea_alerta_mail"("tareaId");

-- CreateIndex
CREATE INDEX "tarea_alerta_mail_userId_idx" ON "tarea_alerta_mail"("userId");

-- CreateIndex
CREATE INDEX "tarea_alerta_mail_enviadoAt_idx" ON "tarea_alerta_mail"("enviadoAt");

-- CreateIndex
CREATE UNIQUE INDEX "tarea_alerta_mail_tareaId_userId_umbral_key" ON "tarea_alerta_mail"("tareaId", "userId", "umbral");

-- CreateIndex
CREATE INDEX "plantilla_oca_casoId_idx" ON "plantilla_oca"("casoId");

-- CreateIndex
CREATE INDEX "plantilla_oca_tipoPlantilla_idx" ON "plantilla_oca"("tipoPlantilla");

-- CreateIndex
CREATE INDEX "plantilla_oca_creadoPorId_idx" ON "plantilla_oca"("creadoPorId");

-- CreateIndex
CREATE INDEX "plantilla_oca_eliminadoEn_idx" ON "plantilla_oca"("eliminadoEn");

-- AddForeignKey
ALTER TABLE "tarea_alerta_mail" ADD CONSTRAINT "tarea_alerta_mail_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_alerta_mail" ADD CONSTRAINT "tarea_alerta_mail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_plantillaOcaId_fkey" FOREIGN KEY ("plantillaOcaId") REFERENCES "plantilla_oca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_oca" ADD CONSTRAINT "plantilla_oca_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_oca" ADD CONSTRAINT "plantilla_oca_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_oca" ADD CONSTRAINT "plantilla_oca_eliminadoPorId_fkey" FOREIGN KEY ("eliminadoPorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

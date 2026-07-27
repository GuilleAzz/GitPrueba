-- AlterTable
ALTER TABLE "bitacora" ADD COLUMN     "historialMontoId" TEXT;

-- CreateTable
CREATE TABLE "historial_monto" (
    "id" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "esInicial" BOOLEAN NOT NULL DEFAULT false,
    "casoId" TEXT NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_monto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historial_monto_casoId_idx" ON "historial_monto"("casoId");

-- CreateIndex
CREATE INDEX "historial_monto_fechaCambio_idx" ON "historial_monto"("fechaCambio");

-- CreateIndex
CREATE INDEX "historial_monto_registradoPorId_idx" ON "historial_monto"("registradoPorId");

-- AddForeignKey
ALTER TABLE "historial_monto" ADD CONSTRAINT "historial_monto_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_monto" ADD CONSTRAINT "historial_monto_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_historialMontoId_fkey" FOREIGN KEY ("historialMontoId") REFERENCES "historial_monto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

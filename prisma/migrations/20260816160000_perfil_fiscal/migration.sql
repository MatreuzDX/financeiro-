-- CreateTable
CREATE TABLE "FiscalProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "independente" BOOLEAN NOT NULL DEFAULT false,
    "regimeIva" TEXT NOT NULL DEFAULT 'ISENTO_ART53',
    "retencaoNaFonte" BOOLEAN NOT NULL DEFAULT false,
    "inicioAtividade" TEXT,
    "taxaSs" INTEGER NOT NULL DEFAULT 2140,
    "coeficienteSs" INTEGER NOT NULL DEFAULT 7000,
    "taxaIva" INTEGER NOT NULL DEFAULT 2300,
    "taxaRetencao" INTEGER NOT NULL DEFAULT 2300,
    "reservaIrs" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalProfile_workspaceId_key" ON "FiscalProfile"("workspaceId");

-- AddForeignKey
ALTER TABLE "FiscalProfile" ADD CONSTRAINT "FiscalProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


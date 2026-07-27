// app/reportes/actividad-cliente/page.tsx
// Reporte: Actividad por Cliente
// Visibilidad: solo ABOGADO (vista personal de su cartera)
//
// Ex "Esfuerzo vs Resultado". Rediseñado para responder únicamente:
// ¿Qué clientes concentran mi actividad operativa?

import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import { ArrowLeft, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

import { ReporteActividadClienteView } from "./components/ReporteActividadClienteView"

export default async function ReporteActividadClientePage() {
  const user = await getUserSessionServer()
  if (!user) redirect("/api/auth/signin")

  const userRol = user.rol?.toUpperCase()

  // Solo abogados ven este reporte (es análisis de su cartera personal)
  if (userRol !== "ABOGADO") notFound()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">

            {/* Header del reporte */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Link href="/reportes">
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-blue-600" />
                    Actividad por Cliente
                  </h1>
                  <p className="text-sm text-slate-500">
                    Distribución del trabajo operativo entre los clientes de tu cartera.
                    Muestra qué clientes concentran más acciones registradas en el sistema.
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido interactivo (client component) */}
            <ReporteActividadClienteView />

          </div>
        </main>
      </div>
    </div>
  )
}
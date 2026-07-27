'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Download } from "lucide-react"

interface CasoUbicacion {
  id: string
  numero: string
  titulo: string
  tipo: string
  estado: string
  juzgado: string | null
  clienteNombre: string
  abogadoNombre: string
  abogadoId: string
  ultimoMovimiento: Date
  priority: string
  esUrgente: boolean
}

interface JuzgadoAgrupado {
  nombre: string
  casos: CasoUbicacion[]
  cantidadCasos: number
  urgentes: number
}

interface ZonaGeografica {
  id: string
  ciudad: string
  provincia: string
  coordenadas: { lat: number; lng: number } | null
  juzgados: JuzgadoAgrupado[]
  totalCasos: number
  casos: CasoUbicacion[]
}

interface GenerarPDFButtonProps {
  zonas: ZonaGeografica[]
  vistaGeneral: boolean
  disabled?: boolean
}

export function GenerarPDFButton({ zonas, vistaGeneral, disabled }: GenerarPDFButtonProps) {
  const [generando, setGenerando] = useState(false)

  const generarPDF = async () => {
    setGenerando(true)
    
    try {
      const html = generarHTMLReporte(zonas, vistaGeneral)
      
      const ventana = window.open('', '_blank')
      if (ventana) {
        ventana.document.write(html)
        ventana.document.close()
        ventana.onload = () => {
          setTimeout(() => { ventana.print() }, 500)
        }
      } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `casos-ubicacion-${new Date().toISOString().split('T')[0]}.html`
        document.body.appendChild(a)
        a.click()
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error generando reporte:', error)
      alert('Error al generar el reporte. Intente nuevamente.')
    } finally {
      setGenerando(false)
    }
  }

  const totalCasos = zonas.reduce((sum, z) => sum + z.totalCasos, 0)

  return (
    <Button 
      onClick={generarPDF}
      disabled={disabled || generando}
      className="gap-2 bg-blue-600 hover:bg-blue-700"
    >
      {generando ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Generar PDF ({totalCasos} expedientes)
        </>
      )}
    </Button>
  )
}

function generarHTMLReporte(zonas: ZonaGeografica[], vistaGeneral: boolean): string {
  const fecha = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

 const totalCasos = zonas.reduce((sum, z) => sum + z.totalCasos, 0)

  // Tabla resumen
  let tablaResumen = `
    <table class="tabla-resumen">
      <thead>
        <tr>
          <th>Ciudad</th>
          <th>Provincia</th>
          <th>Expedientes</th>
          <th>% Total</th>
        </tr>
      </thead>
      <tbody>
  `

  zonas.forEach((zona) => {
    const porcentaje = totalCasos > 0 ? Math.round((zona.totalCasos / totalCasos) * 100) : 0
    tablaResumen += `
      <tr>
        <td><strong>${zona.ciudad}</strong></td>
        <td>${zona.provincia}</td>
        <td class="center">${zona.totalCasos}</td>
        <td class="center">${porcentaje}%</td>
      </tr>
    `
  })

  tablaResumen += `
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2"><strong>TOTAL</strong></td>
          <td class="center"><strong>${totalCasos}</strong></td>
          <td class="center"><strong>100%</strong></td>
        </tr>
      </tfoot>
    </table>
  `

  // Detalle por zona
  let detalleZonas = ''
  
  zonas.forEach((zona) => {
    detalleZonas += `
      <div class="zona-detalle">
        <h2>Expedientes en ${zona.ciudad}, ${zona.provincia} (${zona.totalCasos})</h2>
        <table class="tabla-casos">
          <thead>
            <tr>
              <th>Expediente</th>
              <th>Carátula</th>
              <th>Cliente</th>
              <th>Juzgado</th>
              ${vistaGeneral ? '<th>Abogado</th>' : ''}
              <th>Estado</th>
              <th>Últ. Mov.</th>
            </tr>
          </thead>
          <tbody>
    `

    zona.casos.forEach((caso) => {
      const fechaMov = new Date(caso.ultimoMovimiento).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
      detalleZonas += `
        <tr class="${caso.esUrgente ? 'fila-urgente' : ''}">
          <td class="mono">${caso.numero}</td>
          <td>${caso.titulo}</td>
          <td>${caso.clienteNombre}</td>
          <td>${caso.juzgado || 'Sin especificar'}</td>
          ${vistaGeneral ? `<td>${caso.abogadoNombre}</td>` : ''}
          <td><span class="badge">${caso.estado}</span></td>
          <td class="center">${fechaMov}</td>
        </tr>
      `
    })

    detalleZonas += `</tbody></table></div>`
  })

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Distribución Geográfica — ${fecha}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1e293b;
      padding: 24px 28px;
      background: white;
    }

    /* ── PORTADA ── */
    .portada {
      padding: 36px 0 28px;
      border-bottom: 3px solid #1e40af;
      margin-bottom: 28px;
      page-break-after: always;
    }

    .portada-estudio {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }

    .portada h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 4px;
    }

    .portada .subtitulo {
      font-size: 12px;
      color: #64748b;
      margin-bottom: 20px;
    }

    .portada-meta {
      display: flex;
      gap: 32px;
      margin-top: 20px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .meta-label {
      font-size: 9px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .meta-valor {
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }

    .meta-valor.urgente-valor {
      color: #dc2626;
    }

    /* ── SECCIONES ── */
    .seccion-titulo {
      font-size: 11px;
      font-weight: 700;
      color: #1e40af;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 24px 0 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }

    /* ── TABLAS ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 20px;
      font-size: 10px;
    }

    th, td {
      padding: 7px 10px;
      text-align: left;
      border: 1px solid #e2e8f0;
    }

    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 8.5px;
      letter-spacing: 0.04em;
    }

    tr:nth-child(even) td { background: #fafafa; }

    .tabla-resumen tfoot td {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 2px solid #cbd5e1;
    }

    .center { text-align: center; }
    .mono { font-family: monospace; font-size: 9px; }

    .urgente { color: #dc2626; font-weight: 700; }
    .fila-urgente td { background: #fef2f2 !important; }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      font-size: 9px;
    }

    /* ── ZONAS ── */
    .zona-detalle {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .zona-detalle h2 {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .zona-info {
      font-size: 9.5px;
      color: #64748b;
      margin-bottom: 8px;
      padding: 5px 8px;
      background: #f8fafc;
      border-left: 3px solid #cbd5e1;
      border-radius: 0 3px 3px 0;
    }

    /* ── ACCIONES (no se imprime) ── */
    .no-print {
      margin-bottom: 20px;
      padding: 12px 16px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .no-print p {
      font-size: 12px;
      color: #475569;
    }

    .no-print .acciones { display: flex; gap: 8px; }

    .no-print button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 5px;
      font-size: 12px;
      cursor: pointer;
    }

    .no-print button:hover { background: #1d4ed8; }
    .no-print button.secondary { background: #64748b; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 16px 20px; }
      .portada { page-break-after: always; }
      .zona-detalle { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Barra de acciones -->
  <div class="no-print">
    <p>Para guardar como PDF: <strong>Ctrl+P</strong> → "Guardar como PDF"</p>
    <div class="acciones">
      <button onclick="window.print()">Imprimir / Guardar PDF</button>
      <button class="secondary" onclick="window.close()">Cerrar</button>
    </div>
  </div>

  <!-- PORTADA -->
  <div class="portada">
    <p class="portada-estudio">Estudio Jurídico — Sistema de Gestión</p>
    <h1>Distribución Geográfica de Expedientes</h1>
    <p class="subtitulo">${vistaGeneral ? 'Vista General — Todo el Estudio' : 'Vista Personal — Mis Casos'} &nbsp;·&nbsp; ${fecha}</p>

    <div class="portada-meta">
      <div class="meta-item">
        <span class="meta-label">Total de expedientes</span>
        <span class="meta-valor">${totalCasos}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Zonas</span>
        <span class="meta-valor">${zonas.length}</span>
      </div>
    </div>
  </div>

  <!-- RESUMEN -->
  <div class="seccion-titulo">Resumen por Ciudad</div>
  ${tablaResumen}

  <!-- DETALLE -->
  <div class="seccion-titulo">Detalle por Ubicación</div>
  ${detalleZonas}

</body>
</html>
  `
}
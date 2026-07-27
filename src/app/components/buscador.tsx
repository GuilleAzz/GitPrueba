"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

export function Buscador({ placeholder }: { placeholder: string }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  // Estado local para que el input reaccione al instante mientras el usuario escribe
  const [term, setTerm] = useState(searchParams.get("buscar")?.toString() || "")

  useEffect(() => {
    // TÉCNICA DE DEBOUNCE: Espera 300ms antes de disparar la búsqueda a la base de datos
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      if (term) {
        params.set("buscar", term)
      } else {
        params.delete("buscar")
      }
      // Actualiza la URL silenciosamente (lo que dispara el filtrado en el page.tsx)
      replace(`${pathname}?${params.toString()}`)
    }, 300)

    // Limpieza del timeout si el usuario sigue tipeando
    return () => clearTimeout(timeoutId)
  }, [term, pathname, replace])

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <Input
        className="pl-9 w-full bg-white"
        placeholder={placeholder}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
    </div>
  )
}
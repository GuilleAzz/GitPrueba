// lib/aplication/services/user.service.ts
// FIX: estado 'CERRADO' → 'Cerrado' (consistente con el resto del sistema)

import prisma from "src/lib/db/prisma"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

type CrearUsuarioData = {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: UserRole
  creadoPor: string
}

type ActualizarUsuarioData = {
  nombre?: string
  apellido?: string
  email?: string
  rol?: UserRole
  isActive?: boolean
}

export class UserService {

  async crearUsuario(data: CrearUsuarioData) {
    const existente = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existente) {
      throw new Error("Ya existe un usuario con ese email")
    }

    if (data.rol === 'CLIENTE') {
      throw new Error("Los clientes se crean automáticamente desde el módulo de clientes")
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const usuario = await prisma.user.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        password: hashedPassword,
        rol: data.rol,
        creadoPor: data.creadoPor,
        debeResetearPassword: true,
        isActive: true,
        name: `${data.nombre} ${data.apellido}`
      }
    })

    try {
      await prisma.bitacora.create({
        data: {
          texto: `Usuario creado: ${usuario.email} (${usuario.rol})`,
          tipo: 'auto',
          accion: 'Creación de Usuario',
          usuarioId: data.creadoPor
        }
      })
    } catch (error) {
      console.warn("No se pudo crear entrada en bitácora:", error)
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      rol: usuario.rol,
      isActive: usuario.isActive
    }
  }

  async obtenerTodos() {
    return await prisma.user.findMany({
      where: {
        rol: {
          in: ['ADMIN', 'ABOGADO', 'ASISTENTE']
        }
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        isActive: true,
        createdAt: true,
        ultimoAcceso: true,
        _count: {
          select: {
            casos: true,
            clientes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  }

  async obtenerPorId(id: string) {
    const usuario = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        ultimoAcceso: true,
        debeResetearPassword: true,
        _count: {
          select: {
            casos: true,
            clientes: true,
            tareas: true
          }
        }
      }
    })

    if (!usuario) {
      throw new Error("Usuario no encontrado")
    }

    return usuario
  }

  /**
   * Abogados activos del estudio. Se usa para poblar los selectores de filtrado
   * por abogado (listado de expedientes, documentos, reportes).
   */
  async obtenerAbogadosActivos() {
    return await prisma.user.findMany({
      where: {
        rol: 'ABOGADO',
        isActive: true
      },
      select: {
        id: true,
        nombre: true,
        apellido: true
      },
      orderBy: [
        { apellido: 'asc' },
        { nombre: 'asc' }
      ]
    })
  }

  async actualizarUsuario(id: string, data: ActualizarUsuarioData) {
    const existente = await prisma.user.findUnique({
      where: { id }
    })

    if (!existente) {
      throw new Error("Usuario no encontrado")
    }

    if (data.email && data.email !== existente.email) {
      const emailDuplicado = await prisma.user.findUnique({
        where: { email: data.email }
      })

      if (emailDuplicado) {
        throw new Error("El email ya está en uso")
      }
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        name: data.nombre && data.apellido
          ? `${data.nombre} ${data.apellido}`
          : existente.name
      }
    })

    return {
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      email: actualizado.email,
      rol: actualizado.rol,
      isActive: actualizado.isActive
    }
  }

  async cambiarPassword(userId: string, nuevaPassword: string, adminId: string) {
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        debeResetearPassword: true
      }
    })

    await prisma.bitacora.create({
      data: {
        texto: `Contraseña restablecida para usuario ${userId}`,
        tipo: 'auto',
        accion: 'Cambio de Contraseña',
        usuarioId: adminId
      }
    })

    return { success: true }
  }

  async toggleActivacion(id: string, adminId: string) {
    const usuario = await prisma.user.findUnique({
      where: { id }
    })

    if (!usuario) {
      throw new Error("Usuario no encontrado")
    }

    if (usuario.rol === 'ADMIN' && usuario.isActive) {
      const adminsActivos = await prisma.user.count({
        where: { rol: 'ADMIN', isActive: true }
      })

      if (adminsActivos <= 1) {
        throw new Error("No se puede desactivar al único administrador del sistema")
      }
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: { isActive: !usuario.isActive }
    })

    await prisma.bitacora.create({
      data: {
        texto: `Usuario ${actualizado.isActive ? 'activado' : 'desactivado'}: ${usuario.email}`,
        tipo: 'auto',
        accion: 'Cambio de Estado',
        usuarioId: adminId
      }
    })

    return actualizado
  }

  async eliminarUsuario(id: string, adminId: string) {
    const usuario = await prisma.user.findUnique({
      where: { id },
      include: { casos: true, clientes: true }
    })

    if (!usuario) {
      throw new Error("Usuario no encontrado")
    }

    if (usuario.rol === 'ADMIN') {
      const adminsActivos = await prisma.user.count({
        where: { rol: 'ADMIN', isActive: true }
      })

      if (adminsActivos <= 1) {
        throw new Error("No se puede eliminar al único administrador del sistema")
      }
    }

    // FIX: era 'CERRADO' (siempre false), ahora es 'Cerrado' consistente con el sistema
    const casosActivos = usuario.casos.filter(c => c.estado !== 'Cerrado').length
    if (casosActivos > 0) {
      throw new Error(`El usuario tiene ${casosActivos} caso(s) activo(s). Debe cerrarlos o reasignarlos primero.`)
    }

    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        email: `${usuario.email}.deleted.${Date.now()}`
      }
    })

    await prisma.bitacora.create({
      data: {
        texto: `Usuario eliminado: ${usuario.email}`,
        tipo: 'auto',
        accion: 'Eliminación de Usuario',
        usuarioId: adminId
      }
    })

    return { success: true }
  }

async obtenerEstadisticas() {
  // Primero buscamos los IDs de usuarios con invitación pendiente
  // (isActive=false pero tienen token de activación válido).
  // Estos cuentan como "vigentes" en el total del sistema.
  const tokensActivos = await prisma.accountActivationToken.findMany({
    where: {
      usedAt:    null,
      expiresAt: { gt: new Date() },
    },
    select: { userId: true },
  })
  const invitadosIds = tokensActivos.map(t => t.userId)

  const [activos, invitadosPendientes, inactivosReales, porRol] = await Promise.all([
    // ACTIVOS: usuarios isActive=true
    prisma.user.count({
      where: {
        rol:      { in: ['ADMIN', 'ABOGADO', 'ASISTENTE'] },
        isActive: true,
      },
    }),
    // INVITADOS: isActive=false pero con token de activación válido
    prisma.user.count({
      where: {
        rol:      { in: ['ADMIN', 'ABOGADO', 'ASISTENTE'] },
        isActive: false,
        id:       { in: invitadosIds },
      },
    }),
    // INACTIVOS REALES: desactivados (excluyendo invitaciones pendientes)
    prisma.user.count({
      where: {
        rol:      { in: ['ADMIN', 'ABOGADO', 'ASISTENTE'] },
        isActive: false,
        id:       { notIn: invitadosIds },
      },
    }),
    // Conteo por rol (solo activos)
    prisma.user.groupBy({
      by:    ['rol'],
      where: { isActive: true, rol: { in: ['ADMIN', 'ABOGADO', 'ASISTENTE'] } },
      _count: true,
    }),
  ])

  // TOTAL = "usuarios vivos" del sistema: activos + invitaciones pendientes.
  // Los desactivados ya no cuentan al total (son históricos).
  const total = activos + invitadosPendientes

  return {
    total,
    activos,
    inactivos: inactivosReales,
    invitadosPendientes,
    porRol: {
      admins:     porRol.find(r => r.rol === 'ADMIN')?._count     || 0,
      abogados:   porRol.find(r => r.rol === 'ABOGADO')?._count   || 0,
      asistentes: porRol.find(r => r.rol === 'ASISTENTE')?._count || 0,
    },
  }
}
}
// prisma/seed.js
// Seed v3 — Corregido para provincia/ciudad separados con IDs del JSON de ubicaciones
// Motivos de cierre: FAVORABLE, ACUERDO, DESFAVORABLE, DESISTIMIENTO, ARCHIVO
// fuero = "ciudad, nombreProvincia" (para compatibilidad con reporte legacy)
// provincia = provinciaId del JSON (ej: "cordoba", "buenos_aires")
// ciudad = departamento.nombre del JSON (ej: "Capital", "Río Cuarto")

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ============================================================
// MAPA DE UBICACIONES — basado en argentina-ubicaciones.ts
// Cada entrada: { provincia: provinciaId, ciudad: departamento.nombre, fuero: "ciudad, nombreProvincia" }
// ============================================================
const UBICACIONES = {
  CORDOBA_CAPITAL:      { provincia: 'cordoba',        ciudad: 'Capital',          fuero: 'Capital, Córdoba' },
  CORDOBA_RIO_CUARTO:   { provincia: 'cordoba',        ciudad: 'Río Cuarto',       fuero: 'Río Cuarto, Córdoba' },
  CORDOBA_BELL_VILLE:   { provincia: 'cordoba',        ciudad: 'Bell Ville',       fuero: 'Bell Ville, Córdoba' },
  CORDOBA_VILLA_MARIA:  { provincia: 'cordoba',        ciudad: 'Villa María',      fuero: 'Villa María, Córdoba' },
  CORDOBA_SAN_FRAN:     { provincia: 'cordoba',        ciudad: 'San Francisco',    fuero: 'San Francisco, Córdoba' },
  CORDOBA_CARLOS_PAZ:   { provincia: 'cordoba',        ciudad: 'Carlos Paz',       fuero: 'Carlos Paz, Córdoba' },
  CORDOBA_MARCOS_JUAREZ:{ provincia: 'cordoba',        ciudad: 'Marcos Juárez',    fuero: 'Marcos Juárez, Córdoba' },
  CABA:                 { provincia: 'caba',           ciudad: 'CABA',             fuero: 'CABA, Ciudad Autónoma de Buenos Aires' },
  BA_LA_PLATA:          { provincia: 'buenos_aires',   ciudad: 'La Plata',         fuero: 'La Plata, Buenos Aires' },
  BA_ROSARIO:           { provincia: 'santa_fe',       ciudad: 'Rosario',          fuero: 'Rosario, Santa Fe' },
  SANTA_FE_CAPITAL:     { provincia: 'santa_fe',       ciudad: 'La Capital',       fuero: 'La Capital, Santa Fe' },
  MENDOZA_CAPITAL:      { provincia: 'mendoza',        ciudad: 'Capital',          fuero: 'Capital, Mendoza' },
  TUCUMAN_CAPITAL:      { provincia: 'tucuman',        ciudad: 'Capital',          fuero: 'Capital, Tucumán' },
  ENTRE_RIOS_PARANA:    { provincia: 'entre_rios',     ciudad: 'Paraná',           fuero: 'Paraná, Entre Ríos' },
  SALTA_CAPITAL:        { provincia: 'salta',          ciudad: 'Capital',          fuero: 'Capital, Salta' },
};

async function main() {
  console.log("🔥 Iniciando SEED v3...");

  // ============================================================
  // 1. LIMPIEZA
  // ============================================================
  // Borrado tolerante: para modelos que pueden no existir en el schema.
  const borrarSiExiste = async (nombre) => {
    try {
      if (prisma[nombre]) await prisma[nombre].deleteMany();
    } catch (e) {
      console.log(`   ⚠ No se pudo limpiar ${nombre}: ${e.message}`);
    }
  };

  // Orden de dependencia: hijos primero, padres después.
  await prisma.bitacora.deleteMany();
  await prisma.comentarioTarea.deleteMany();
  await prisma.tareaLectura.deleteMany();
  await prisma.tarea.deleteMany();
  await prisma.historialMonto.deleteMany();
  await borrarSiExiste('plantillaOca');
  await borrarSiExiste('liquidacion');
  await borrarSiExiste('requirement');
  await borrarSiExiste('pago');

  await borrarSiExiste('casoColaborador');

  await prisma.caso.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("🗑️ Base de datos limpiada.");

const passwordAdmin = await bcrypt.hash("AzarDemo2026!", 10);
const passwordDemo = await bcrypt.hash("123456", 10);

  // ============================================================
  // 2. USUARIOS
  // ============================================================
  const usuarios = [
    { id: "u-admin", nombre: "Franco", apellido: "Barbato", email: "franco.barbato@mi.unc.edu.ar", rol: "ADMIN" },
    { id: "u-hernan",    nombre: "Hernán",    apellido: "Azar",      email: "hernan@estudio.com",     rol: "ABOGADO" },
    { id: "u-agustin",   nombre: "Agustín",   apellido: "Azar",      email: "agustin@estudio.com",    rol: "ABOGADO" },
    { id: "u-mario",     nombre: "Mario",     apellido: "Rodríguez", email: "mario@estudio.com",      rol: "ABOGADO" },
    { id: "u-laura",     nombre: "Laura",     apellido: "Fernández", email: "laura@estudio.com",      rol: "ABOGADO" },
    { id: "u-asistente", nombre: "Valentina", apellido: "López",     email: "valentina@estudio.com",  rol: "ASISTENTE" },
  ];

for (const u of usuarios) {
  await prisma.user.create({
    data: {
      ...u,
      password: u.rol === 'ADMIN' ? passwordAdmin : passwordDemo,
      isActive: true,
      name: `${u.nombre} ${u.apellido}`,
      emailVerified: new Date()
    },
  });
}
  console.log("👥 6 Usuarios creados.");

  // ============================================================
  // 3. CLIENTES (40)
  // ============================================================
  const diasAtrasDate = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const clientes = [
    // === FRECUENTES (empresas grandes, muchos casos) ===
    { id: 'c-01', tipoPersona: 'JURIDICA', nombre: "TechCorp S.A.",               apellido: null,        email: "legal@techcorp.com",        telefono: "+54 11 4567-0001", tipoDocumento: "CUIT", numeroDocumento: "30-70001111-5", abogadoId: "u-hernan",  createdAt: diasAtrasDate(730) },
    { id: 'c-04', tipoPersona: 'JURIDICA', nombre: "Constructora del Sur S.R.L.", apellido: null,        email: "admin@consur.com",          telefono: "+54 351 444-0001", tipoDocumento: "CUIT", numeroDocumento: "30-70002222-2", abogadoId: "u-hernan",  createdAt: diasAtrasDate(650) },
    { id: 'c-12', tipoPersona: 'JURIDICA', nombre: "Transporte Rápido S.A.",      apellido: null,        email: "legal@transrapido.com",     telefono: "+54 341 555-0001", tipoDocumento: "CUIT", numeroDocumento: "30-70004444-7", abogadoId: "u-mario",   createdAt: diasAtrasDate(600) },
    { id: 'c-20', tipoPersona: 'JURIDICA', nombre: "Agro Pampa S.A.",             apellido: null,        email: "legal@agropampa.com",       telefono: "+54 342 666-0001", tipoDocumento: "CUIT", numeroDocumento: "30-70006666-1", abogadoId: "u-laura",   createdAt: diasAtrasDate(550) },

    // === RECURRENTES (2-4 casos) ===
    { id: 'c-02', tipoPersona: 'FISICA',   nombre: "Carlos",    apellido: "Mendoza",   email: "carlos.mendoza@mail.com",   telefono: "+54 9 351 111-0001", tipoDocumento: "DNI", numeroDocumento: "20111001", abogadoId: "u-hernan",  createdAt: diasAtrasDate(500) },
    { id: 'c-03', tipoPersona: 'FISICA',   nombre: "Ana",       apellido: "López",     email: "ana.lopez@mail.com",        telefono: "+54 9 351 111-0002", tipoDocumento: "DNI", numeroDocumento: "27222002", abogadoId: "u-hernan",  createdAt: diasAtrasDate(480) },
    { id: 'c-05', tipoPersona: 'FISICA',   nombre: "Roberto",   apellido: "Díaz",      email: "roberto.diaz@mail.com",     telefono: "+54 9 351 111-0003", tipoDocumento: "DNI", numeroDocumento: "18333003", abogadoId: "u-hernan",  createdAt: diasAtrasDate(400) },
    { id: 'c-06', tipoPersona: 'FISICA',   nombre: "María",     apellido: "García",    email: "maria.garcia@mail.com",     telefono: "+54 9 351 222-0001", tipoDocumento: "DNI", numeroDocumento: "25444004", abogadoId: "u-agustin", createdAt: diasAtrasDate(420) },
    { id: 'c-07', tipoPersona: 'FISICA',   nombre: "Jorge",     apellido: "Martínez",  email: "jorge.martinez@mail.com",   telefono: "+54 9 351 222-0002", tipoDocumento: "DNI", numeroDocumento: "22555005", abogadoId: "u-agustin", createdAt: diasAtrasDate(380) },
    { id: 'c-08', tipoPersona: 'JURIDICA', nombre: "Importadora Global S.A.",     apellido: null,        email: "legal@impglobal.com",       telefono: "+54 11 4567-0002",   tipoDocumento: "CUIT", numeroDocumento: "30-70003334-8", abogadoId: "u-agustin", createdAt: diasAtrasDate(500) },
    { id: 'c-11', tipoPersona: 'FISICA',   nombre: "Andrés",    apellido: "Gómez",     email: "andres.gomez@mail.com",     telefono: "+54 9 351 333-0001", tipoDocumento: "DNI", numeroDocumento: "23888008", abogadoId: "u-mario",   createdAt: diasAtrasDate(450) },
    { id: 'c-15', tipoPersona: 'FISICA',   nombre: "Carolina",  apellido: "Vega",      email: "carolina.vega@mail.com",    telefono: "+54 9 351 444-0001", tipoDocumento: "DNI", numeroDocumento: "28111011", abogadoId: "u-laura",   createdAt: diasAtrasDate(370) },
    { id: 'c-16', tipoPersona: 'JURIDICA', nombre: "Inmobiliaria Centro S.A.",    apellido: null,        email: "legal@inmobcentro.com",     telefono: "+54 351 555-0002",   tipoDocumento: "CUIT", numeroDocumento: "30-70005555-4", abogadoId: "u-laura",   createdAt: diasAtrasDate(360) },
    { id: 'c-19', tipoPersona: 'FISICA',   nombre: "Diego",     apellido: "Ruiz",      email: "diego.ruiz@mail.com",       telefono: "+54 9 351 444-0003", tipoDocumento: "DNI", numeroDocumento: "25444014", abogadoId: "u-laura",   createdAt: diasAtrasDate(330) },
    { id: 'c-22', tipoPersona: 'JURIDICA', nombre: "Metalúrgica Norte S.A.",      apellido: null,        email: "legal@metalnorte.com",      telefono: "+54 351 666-0001",   tipoDocumento: "CUIT", numeroDocumento: "30-70007777-9", abogadoId: "u-hernan",  createdAt: diasAtrasDate(300) },
    { id: 'c-25', tipoPersona: 'JURIDICA', nombre: "Farmacia del Pueblo S.R.L.",  apellido: null,        email: "legal@farmpueblo.com",      telefono: "+54 351 666-0002",   tipoDocumento: "CUIT", numeroDocumento: "30-70008888-8", abogadoId: "u-laura",   createdAt: diasAtrasDate(340) },
    { id: 'c-28', tipoPersona: 'JURIDICA', nombre: "Cereales del Centro S.A.",    apellido: null,        email: "legal@cercentro.com",       telefono: "+54 353 777-0001",   tipoDocumento: "CUIT", numeroDocumento: "30-70009999-3", abogadoId: "u-mario",   createdAt: diasAtrasDate(280) },

    // === ÚNICOS (1 caso) ===
    { id: 'c-09', tipoPersona: 'FISICA',   nombre: "Lucía",     apellido: "Fernández", email: "lucia.fernandez@mail.com",  telefono: "+54 9 351 222-0003", tipoDocumento: "DNI", numeroDocumento: "29666006", abogadoId: "u-agustin", createdAt: diasAtrasDate(200) },
    { id: 'c-10', tipoPersona: 'FISICA',   nombre: "Pedro",     apellido: "Sánchez",   email: "pedro.sanchez@mail.com",    telefono: "+54 9 351 222-0004", tipoDocumento: "DNI", numeroDocumento: "21777007", abogadoId: "u-agustin", createdAt: diasAtrasDate(310) },
    { id: 'c-13', tipoPersona: 'FISICA',   nombre: "Silvia",    apellido: "Romero",    email: "silvia.romero@mail.com",    telefono: "+54 9 351 333-0002", tipoDocumento: "DNI", numeroDocumento: "26999009", abogadoId: "u-mario",   createdAt: diasAtrasDate(250) },
    { id: 'c-14', tipoPersona: 'FISICA',   nombre: "Martín",    apellido: "Torres",    email: "martin.torres@mail.com",    telefono: "+54 9 351 333-0003", tipoDocumento: "DNI", numeroDocumento: "24000010", abogadoId: "u-mario",   createdAt: diasAtrasDate(350) },
    { id: 'c-17', tipoPersona: 'FISICA',   nombre: "Fernando",  apellido: "Castro",    email: "fernando.castro@mail.com",  telefono: "+54 9 351 444-0002", tipoDocumento: "DNI", numeroDocumento: "20222012", abogadoId: "u-laura",   createdAt: diasAtrasDate(180) },
    { id: 'c-18', tipoPersona: 'FISICA',   nombre: "Patricia",  apellido: "Morales",   email: "patricia.morales@mail.com", telefono: "+54 9 351 444-0004", tipoDocumento: "DNI", numeroDocumento: "27333013", abogadoId: "u-laura",   createdAt: diasAtrasDate(200) },
    { id: 'c-21', tipoPersona: 'FISICA',   nombre: "Raúl",      apellido: "Pereyra",   email: "raul.pereyra@mail.com",     telefono: "+54 9 351 555-0001", tipoDocumento: "DNI", numeroDocumento: "19555015", abogadoId: "u-hernan",  createdAt: diasAtrasDate(300) },
    { id: 'c-23', tipoPersona: 'FISICA',   nombre: "Gabriela",  apellido: "Acosta",    email: "gabriela.acosta@mail.com",  telefono: "+54 9 351 555-0002", tipoDocumento: "DNI", numeroDocumento: "30666016", abogadoId: "u-hernan",  createdAt: diasAtrasDate(30) },
    { id: 'c-26', tipoPersona: 'FISICA',   nombre: "Estela",    apellido: "Navarro",   email: "estela.navarro@mail.com",   telefono: "+54 9 351 666-0001", tipoDocumento: "DNI", numeroDocumento: "26888018", abogadoId: "u-agustin", createdAt: diasAtrasDate(270) },
    { id: 'c-29', tipoPersona: 'FISICA',   nombre: "Liliana",   apellido: "Paz",       email: "liliana.paz@mail.com",      telefono: "+54 9 351 777-0001", tipoDocumento: "DNI", numeroDocumento: "28000020", abogadoId: "u-mario",   createdAt: diasAtrasDate(240) },
    { id: 'c-30', tipoPersona: 'FISICA',   nombre: "Marcelo",   apellido: "Ríos",      email: "marcelo.rios@mail.com",     telefono: "+54 9 351 777-0002", tipoDocumento: "DNI", numeroDocumento: "23111021", abogadoId: "u-mario",   createdAt: diasAtrasDate(260) },

    // === INACTIVOS (solo casos cerrados) ===
    { id: 'c-31', tipoPersona: 'FISICA',   nombre: "Osvaldo",   apellido: "Figueroa",  email: "osvaldo.figueroa@mail.com", telefono: "+54 9 351 888-0001", tipoDocumento: "DNI", numeroDocumento: "19222030", abogadoId: "u-hernan",  createdAt: diasAtrasDate(700) },
    { id: 'c-32', tipoPersona: 'JURIDICA', nombre: "Distribuidora Litoral S.R.L.", apellido: null, email: "legal@distlitoral.com", telefono: "+54 342 999-0001", tipoDocumento: "CUIT", numeroDocumento: "30-71001111-3", abogadoId: "u-laura",   createdAt: diasAtrasDate(600) },
    { id: 'c-33', tipoPersona: 'FISICA',   nombre: "Graciela",  apellido: "Molina",    email: "graciela.molina@mail.com",  telefono: "+54 9 351 888-0002", tipoDocumento: "DNI", numeroDocumento: "24333031", abogadoId: "u-agustin", createdAt: diasAtrasDate(550) },
    { id: 'c-34', tipoPersona: 'FISICA',   nombre: "Hugo",      apellido: "Cabrera",   email: "hugo.cabrera@mail.com",     telefono: "+54 9 261 888-0001", tipoDocumento: "DNI", numeroDocumento: "21444032", abogadoId: "u-mario",   createdAt: diasAtrasDate(500) },
    { id: 'c-35', tipoPersona: 'JURIDICA', nombre: "Estudio Contable Ríos",       apellido: null, email: "info@ecrios.com",           telefono: "+54 351 888-0003",   tipoDocumento: "CUIT", numeroDocumento: "30-71002222-2", abogadoId: "u-hernan",  createdAt: diasAtrasDate(450) },
    { id: 'c-36', tipoPersona: 'FISICA',   nombre: "Norma",     apellido: "Peralta",   email: "norma.peralta@mail.com",    telefono: "+54 9 351 888-0004", tipoDocumento: "DNI", numeroDocumento: "26555033", abogadoId: "u-laura",   createdAt: diasAtrasDate(400) },
    { id: 'c-37', tipoPersona: 'FISICA',   nombre: "Alberto",   apellido: "Sosa",      email: "alberto.sosa@mail.com",     telefono: "+54 9 351 888-0005", tipoDocumento: "DNI", numeroDocumento: "18666034", abogadoId: "u-agustin", createdAt: diasAtrasDate(380) },
    { id: 'c-38', tipoPersona: 'JURIDICA', nombre: "Panadería La Estrella S.R.L.", apellido: null, email: "info@panalestrella.com",    telefono: "+54 351 888-0006",   tipoDocumento: "CUIT", numeroDocumento: "30-71003333-8", abogadoId: "u-mario",   createdAt: diasAtrasDate(350) },

    // === SIN CASOS (recién cargados) ===
    { id: 'c-39', tipoPersona: 'FISICA',   nombre: "Romina",    apellido: "Ledesma",   email: "romina.ledesma@mail.com",   telefono: "+54 9 351 999-0001", tipoDocumento: "DNI", numeroDocumento: "31777035", abogadoId: "u-laura",   createdAt: diasAtrasDate(7) },
    { id: 'c-40', tipoPersona: 'JURIDICA', nombre: "Software del Interior S.A.",  apellido: null, email: "legal@softint.com",         telefono: "+54 351 999-0002",   tipoDocumento: "CUIT", numeroDocumento: "30-71004444-5", abogadoId: "u-hernan",  createdAt: diasAtrasDate(3) },
  ];

  for (const c of clientes) {
    const { createdAt, ...rest } = c;
    await prisma.cliente.create({
      data: {
        ...rest,
        activo: true,
        condicionIva: c.tipoPersona === 'JURIDICA' ? 'RESPONSABLE_INSCRIPTO' : 'CONSUMIDOR_FINAL',
        createdAt,
      }
    });
  }
  console.log(`👤 ${clientes.length} Clientes creados.`);

  // ============================================================
  // 4. CONSTANTES
  // ============================================================
  const MOTIVOS = {
    FAVORABLE:    'FAVORABLE',
    DESFAVORABLE: 'DESFAVORABLE',
    ACUERDO:      'ACUERDO',
    DESISTIMIENTO:'DESISTIMIENTO',
    ARCHIVO:      'ARCHIVO',
  };

  const U = UBICACIONES; // alias corto
  const diasAtras = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  // ============================================================
  // 5. DEFINICIÓN DE CASOS
  // Cada caso tiene: ubicacion (del mapa UBICACIONES), juzgado
  // ============================================================
  const casosDef = [];

  // ================================================================
  // HERNÁN — 20 casos
  // ================================================================

  // Cerrados
  casosDef.push({ numero: 'EXP-2024-001', titulo: 'TechCorp c/ Proveedor s/ Incumplimiento',         tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'HIGH',   montoDisputa: 8500000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 7200000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia','Ejecución de Sentencia'], diasPorEtapa: [35,70,30,45], inicioHace: 365, ubicacion: U.CORDOBA_CAPITAL,    juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2024-015', titulo: 'Mendoza c/ Empleador s/ Despido',                 tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-02', priority: 'NORMAL', montoDisputa: 4500000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 3200000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [30], inicioHace: 210, ubicacion: U.CORDOBA_CAPITAL,    juzgado: 'Juzgado Laboral Nº 3' });
  casosDef.push({ numero: 'EXP-2024-022', titulo: 'López c/ Consorcio s/ Daños',                     tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-03', priority: 'NORMAL', montoDisputa: 3200000,  cerrado: true,  motivoCierre: MOTIVOS.DESFAVORABLE, montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [40,80,35], inicioHace: 450, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 12' });
  casosDef.push({ numero: 'EXP-2024-023', titulo: 'Díaz c/ Empresa Textil s/ Indemnización',         tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-05', priority: 'HIGH',   montoDisputa: 6000000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 5800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [25,35,60,30], inicioHace: 300, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2024-024', titulo: 'Constructora c/ Municipalidad s/ Cobro',           tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-hernan',  clienteId: 'c-04', priority: 'HIGH',   montoDisputa: 15000000, cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal:10000000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [50,80], inicioHace: 500, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Cont. Adm. Nº 2' });
  casosDef.push({ numero: 'EXP-2024-025', titulo: 'Pereyra c/ Empresa s/ Accidente Laboral',         tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-21', priority: 'NORMAL', montoDisputa: 5200000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 4800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [20,45,55], inicioHace: 280, ubicacion: U.CABA, juzgado: 'Juzgado Nacional del Trabajo Nº 8' });
  casosDef.push({ numero: 'EXP-2024-026', titulo: 'Metalúrgica c/ Sindicato s/ Cautelar',            tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-22', priority: 'HIGH',   montoDisputa: 3800000,  cerrado: true,  motivoCierre: MOTIVOS.DESISTIMIENTO,montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [35], inicioHace: 180, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 1' });
  casosDef.push({ numero: 'EXP-2024-027', titulo: 'López c/ Banco s/ Cobro de Pesos',                tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-03', priority: 'NORMAL', montoDisputa: 2100000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 1950000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [30,55,25], inicioHace: 260, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 8' });
  casosDef.push({ numero: 'EXP-2024-028', titulo: 'Díaz s/ Alimentos',                               tipo: 'FAMILIA',                    abogadoId: 'u-hernan',  clienteId: 'c-05', priority: 'HIGH',   montoDisputa: 900000,   cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 850000,  etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [18], inicioHace: 130, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 4' });
  // Inactivos
  casosDef.push({ numero: 'EXP-2023-001', titulo: 'Figueroa c/ Empleador s/ Despido',                tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-31', priority: 'NORMAL', montoDisputa: 3500000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 3200000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Sentencia de 1ra Instancia'], diasPorEtapa: [30,60], inicioHace: 600, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2023-002', titulo: 'Estudio Ríos c/ Cliente s/ Honorarios',           tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-35', priority: 'LOW',    montoDisputa: 800000,   cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 600000,  etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [25], inicioHace: 400, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  // Activos
  casosDef.push({ numero: 'EXP-2025-101', titulo: 'TechCorp c/ Cliente Moroso s/ Ejecutivo',         tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'HIGH',   montoDisputa: 2800000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [20,25], inicioHace: 60, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2025-102', titulo: 'TechCorp c/ ART s/ Accidente Empleado',           tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'NORMAL', montoDisputa: 7500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [18], inicioHace: 30, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 3' });
  casosDef.push({ numero: 'EXP-2025-103', titulo: 'López c/ Seguro s/ Siniestro',                    tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-03', priority: 'NORMAL', montoDisputa: 1500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [20,30], inicioHace: 70, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Civil Nº 3' });
  casosDef.push({ numero: 'EXP-2025-104', titulo: 'Díaz c/ Vecino s/ Medianería',                    tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-05', priority: 'LOW',    montoDisputa: 900000,   cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 15, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 12' });
  casosDef.push({ numero: 'EXP-2025-105', titulo: 'Pereyra c/ Consorcio s/ Filtraciones',            tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-21', priority: 'NORMAL', montoDisputa: 1200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [12], inicioHace: 22, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  casosDef.push({ numero: 'EXP-2025-106', titulo: 'Acosta c/ Empleador s/ Diferencias Salariales',  tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-23', priority: 'HIGH',   montoDisputa: 3400000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 8, ubicacion: U.CABA, juzgado: 'Juzgado Nacional del Trabajo Nº 15' });
  // Estancados
  casosDef.push({ numero: 'EXP-2024-050', titulo: 'Constructora s/ Quiebra',                         tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-04', priority: 'NORMAL', montoDisputa: 12000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [40,60], inicioHace: 200, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2024-051', titulo: 'TechCorp c/ AFIP s/ Impugnación',                 tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'HIGH',   montoDisputa: 4200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [30,50,35], inicioHace: 250, ubicacion: U.CABA, juzgado: 'Juzgado Cont. Adm. Federal Nº 4' });
  casosDef.push({ numero: 'EXP-2024-052', titulo: 'Mendoza s/ Sucesión',                             tipo: 'SUCESIONES',                 abogadoId: 'u-hernan',  clienteId: 'c-02', priority: 'LOW',    montoDisputa: 20000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [45], inicioHace: 400, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  casosDef.push({ numero: 'EXP-2023-010', titulo: 'Metalúrgica c/ Proveedor s/ Cobro de Pesos',      tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-22', priority: 'LOW',    montoDisputa: 6500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [60], inicioHace: 550, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 1' });
  casosDef.push({ numero: 'EXP-2024-053', titulo: 'TechCorp c/ Socio s/ Disolución',                 tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'NORMAL', montoDisputa: 18000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,35], inicioHace: 220, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 8' });

  // ================================================================
  // AGUSTÍN — 18 casos
  // ================================================================

  // Cerrados
  casosDef.push({ numero: 'EXP-2024-100', titulo: 'García s/ Divorcio',                              tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-06', priority: 'NORMAL', montoDisputa: 2000000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 1800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Sentencia de 1ra Instancia'], diasPorEtapa: [30,50], inicioHace: 180, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2024-101', titulo: 'Martínez c/ Inquilino s/ Desalojo',               tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-07', priority: 'HIGH',   montoDisputa: 1800000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 1800000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia','Ejecución de Sentencia'], diasPorEtapa: [25,55,45], inicioHace: 240, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 8' });
  casosDef.push({ numero: 'EXP-2024-102', titulo: 'Importadora c/ Aduana s/ Multa',                  tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'NORMAL', montoDisputa: 5500000,  cerrado: true,  motivoCierre: MOTIVOS.DESFAVORABLE, montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [40,70,35], inicioHace: 400, ubicacion: U.CABA, juzgado: 'Juzgado Cont. Adm. Federal Nº 1' });
  casosDef.push({ numero: 'EXP-2024-103', titulo: 'Fernández s/ Alimentos',                          tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-09', priority: 'HIGH',   montoDisputa: 800000,   cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 750000,  etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [20], inicioHace: 120, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 4' });
  casosDef.push({ numero: 'EXP-2024-104', titulo: 'Sánchez c/ Empresa s/ Despido',                   tipo: 'LABORAL',                    abogadoId: 'u-agustin', clienteId: 'c-10', priority: 'NORMAL', montoDisputa: 3800000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 2900000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [30,45], inicioHace: 280, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Laboral Nº 2' });
  casosDef.push({ numero: 'EXP-2024-105', titulo: 'Navarro c/ Ex Pareja s/ Compensación',            tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-26', priority: 'NORMAL', montoDisputa: 4500000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 4200000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [25,40,50], inicioHace: 250, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2024-106', titulo: 'García c/ Vecino s/ Ruidos Molestos',             tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-06', priority: 'LOW',    montoDisputa: 500000,   cerrado: true,  motivoCierre: MOTIVOS.ARCHIVO,      montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [40], inicioHace: 190, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  // Inactivos
  casosDef.push({ numero: 'EXP-2023-003', titulo: 'Molina s/ Divorcio',                              tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-33', priority: 'NORMAL', montoDisputa: 1500000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 1200000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Sentencia de 1ra Instancia'], diasPorEtapa: [25,45], inicioHace: 500, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2023-004', titulo: 'Sosa c/ Vecino s/ Daños',                         tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-37', priority: 'LOW',    montoDisputa: 700000,   cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 650000,  etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [20,35,40], inicioHace: 350, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 5' });
  // Activos
  casosDef.push({ numero: 'EXP-2025-200', titulo: 'García s/ Régimen de Visitas',                    tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-06', priority: 'NORMAL', montoDisputa: 0,        cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [15], inicioHace: 20, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2025-201', titulo: 'Importadora c/ Proveedor s/ Cumplimiento',        tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'NORMAL', montoDisputa: 6200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 10, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2025-202', titulo: 'Importadora c/ Obra Social s/ Amparo',            tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'HIGH',   montoDisputa: 1200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [15,22], inicioHace: 45, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 12' });
  casosDef.push({ numero: 'EXP-2025-203', titulo: 'Navarro c/ Empleador s/ Despido',                 tipo: 'LABORAL',                    abogadoId: 'u-agustin', clienteId: 'c-26', priority: 'HIGH',   montoDisputa: 4800000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [10], inicioHace: 18, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2025-204', titulo: 'Importadora c/ Banco s/ Daños',                   tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'NORMAL', montoDisputa: 2100000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 5, ubicacion: U.BA_LA_PLATA, juzgado: 'Juzgado Civil y Com. Nº 3' });
  // Estancados
  casosDef.push({ numero: 'EXP-2024-110', titulo: 'Martínez s/ Sucesión',                            tipo: 'SUCESIONES',                 abogadoId: 'u-agustin', clienteId: 'c-07', priority: 'LOW',    montoDisputa: 18000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [45], inicioHace: 250, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 8' });
  casosDef.push({ numero: 'EXP-2024-111', titulo: 'Fernández c/ Ex Cónyuge s/ Liquidación',          tipo: 'FAMILIA',                    abogadoId: 'u-agustin', clienteId: 'c-09', priority: 'NORMAL', montoDisputa: 3500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [25,40,50], inicioHace: 210, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 4' });
  casosDef.push({ numero: 'EXP-2024-112', titulo: 'Sánchez c/ Municipalidad s/ Daños Vía Pública',   tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-agustin', clienteId: 'c-10', priority: 'NORMAL', montoDisputa: 2800000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [40], inicioHace: 300, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Cont. Adm. Nº 1' });
  casosDef.push({ numero: 'EXP-2023-050', titulo: 'Importadora c/ Despachante s/ Cobro',             tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'LOW',    montoDisputa: 4100000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [50,65], inicioHace: 500, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Civil Nº 1' });

  // ================================================================
  // MARIO — 21 casos
  // ================================================================

  // Cerrados
  casosDef.push({ numero: 'EXP-2024-200', titulo: 'Gómez s/ Lesiones Culposas',                      tipo: 'PENAL',                      abogadoId: 'u-mario',   clienteId: 'c-11', priority: 'HIGH',   montoDisputa: 3000000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 2500000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [30,65,35], inicioHace: 350, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Penal Nº 6' });
  casosDef.push({ numero: 'EXP-2024-201', titulo: 'Transporte c/ Aseguradora s/ Siniestro',          tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'NORMAL', montoDisputa: 9000000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 6500000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,40], inicioHace: 270, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Civil Nº 3' });
  casosDef.push({ numero: 'EXP-2024-202', titulo: 'Romero c/ Empresa s/ Mobbing',                    tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-13', priority: 'NORMAL', montoDisputa: 5000000,  cerrado: true,  motivoCierre: MOTIVOS.DESISTIMIENTO,montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [30], inicioHace: 200, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 3' });
  casosDef.push({ numero: 'EXP-2024-203', titulo: 'Torres c/ ART s/ Incapacidad',                    tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-14', priority: 'HIGH',   montoDisputa: 8200000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 7800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia','Ejecución de Sentencia'], diasPorEtapa: [20,30,70,25,45], inicioHace: 320, ubicacion: U.BA_LA_PLATA, juzgado: 'Juzgado Laboral Nº 5' });
  casosDef.push({ numero: 'EXP-2024-204', titulo: 'Cereales c/ Transportista s/ Faltante',           tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-28', priority: 'NORMAL', montoDisputa: 3600000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 2800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [20,35], inicioHace: 150, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 2' });
  casosDef.push({ numero: 'EXP-2024-205', titulo: 'Paz c/ Empleador s/ Despido Embarazo',            tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-29', priority: 'HIGH',   montoDisputa: 7000000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 6800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [15,35,50], inicioHace: 220, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2024-206', titulo: 'Ríos c/ Consorcio s/ Daños Unidad',              tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-30', priority: 'NORMAL', montoDisputa: 1800000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 1650000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [25,40,45], inicioHace: 250, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 12' });
  casosDef.push({ numero: 'EXP-2024-207', titulo: 'Gómez c/ Empleador s/ Despido Injustificado',    tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-11', priority: 'NORMAL', montoDisputa: 4500000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 3200000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,45], inicioHace: 220, ubicacion: U.TUCUMAN_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  // Inactivos
  casosDef.push({ numero: 'EXP-2023-005', titulo: 'Cabrera c/ Empleador s/ Indemnización',           tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-34', priority: 'NORMAL', montoDisputa: 4200000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 3800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [30,40,50], inicioHace: 450, ubicacion: U.MENDOZA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2023-006', titulo: 'Panadería c/ Proveedor s/ Cobro',                 tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-38', priority: 'LOW',    montoDisputa: 600000,   cerrado: true,  motivoCierre: MOTIVOS.ARCHIVO,      montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [35], inicioHace: 320, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  // Activos
  casosDef.push({ numero: 'EXP-2025-300', titulo: 'Romero c/ Vecino s/ Daños',                       tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-13', priority: 'NORMAL', montoDisputa: 2200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [25], inicioHace: 40, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  casosDef.push({ numero: 'EXP-2025-301', titulo: 'Transporte c/ Empleado s/ Despido',               tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'HIGH',   montoDisputa: 5500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [18], inicioHace: 25, ubicacion: U.BA_LA_PLATA, juzgado: 'Juzgado Laboral Nº 5' });
  casosDef.push({ numero: 'EXP-2025-302', titulo: 'Gómez s/ Hurto',                                  tipo: 'PENAL',                      abogadoId: 'u-mario',   clienteId: 'c-11', priority: 'HIGH',   montoDisputa: 0,        cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [18,22], inicioHace: 50, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Penal Nº 6' });
  casosDef.push({ numero: 'EXP-2025-303', titulo: 'Transporte c/ Cliente s/ Cobro Fletes',           tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'LOW',    montoDisputa: 1800000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 8, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2025-304', titulo: 'Ríos c/ ART s/ Enfermedad Profesional',          tipo: 'LABORAL',                    abogadoId: 'u-mario',   clienteId: 'c-30', priority: 'HIGH',   montoDisputa: 6200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [12], inicioHace: 20, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 3' });
  casosDef.push({ numero: 'EXP-2025-305', titulo: 'Cereales c/ AFIP s/ Determinación',               tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-mario',   clienteId: 'c-28', priority: 'NORMAL', montoDisputa: 8500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [30], inicioHace: 55, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 2' });
  // Estancados
  casosDef.push({ numero: 'EXP-2024-210', titulo: 'Romero s/ Usucapión',                             tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-13', priority: 'LOW',    montoDisputa: 25000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [50], inicioHace: 400, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 5' });
  casosDef.push({ numero: 'EXP-2024-211', titulo: 'Transporte c/ Estado s/ Daños',                   tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'NORMAL', montoDisputa: 4000000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [35,55,40], inicioHace: 250, ubicacion: U.MENDOZA_CAPITAL, juzgado: 'Juzgado Cont. Adm. Nº 1' });
  casosDef.push({ numero: 'EXP-2024-212', titulo: 'Transporte s/ Sucesión Fundador',                 tipo: 'SUCESIONES',                 abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'LOW',    montoDisputa: 15000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [55], inicioHace: 380, ubicacion: U.BA_LA_PLATA, juzgado: 'Juzgado Civil y Com. Nº 8' });
  casosDef.push({ numero: 'EXP-2023-080', titulo: 'Transporte c/ Municipalidad s/ Habilitación',     tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-mario',   clienteId: 'c-12', priority: 'NORMAL', montoDisputa: 2200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [45,60], inicioHace: 520, ubicacion: U.BA_ROSARIO, juzgado: 'Juzgado Cont. Adm. Nº 2' });
  casosDef.push({ numero: 'EXP-2024-213', titulo: 'Paz c/ Obra Social s/ Prestaciones',              tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-mario',   clienteId: 'c-29', priority: 'NORMAL', montoDisputa: 1600000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [20,30], inicioHace: 160, ubicacion: U.TUCUMAN_CAPITAL, juzgado: 'Juzgado Civil Nº 2' });

  // ================================================================
  // LAURA — 25 casos
  // ================================================================

  // Cerrados
  casosDef.push({ numero: 'EXP-2024-300', titulo: 'Vega s/ Divorcio Express',                        tipo: 'FAMILIA',                    abogadoId: 'u-laura',   clienteId: 'c-15', priority: 'NORMAL', montoDisputa: 1500000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 1500000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [20], inicioHace: 90, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 4' });
  casosDef.push({ numero: 'EXP-2024-301', titulo: 'Inmobiliaria c/ Inquilino s/ Desalojo',           tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-16', priority: 'HIGH',   montoDisputa: 2400000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 2400000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia','Ejecución de Sentencia'], diasPorEtapa: [30,45,35], inicioHace: 150, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  casosDef.push({ numero: 'EXP-2024-302', titulo: 'Castro c/ Obra Social s/ Reintegro',              tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-17', priority: 'NORMAL', montoDisputa: 950000,   cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 920000,  etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,35], inicioHace: 120, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 12' });
  casosDef.push({ numero: 'EXP-2024-303', titulo: 'Morales c/ Consorcio s/ Expensas',                tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-18', priority: 'LOW',    montoDisputa: 350000,   cerrado: true,  motivoCierre: MOTIVOS.ARCHIVO,      montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [30], inicioHace: 160, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 1' });
  casosDef.push({ numero: 'EXP-2024-304', titulo: 'Ruiz c/ Empleador s/ Diferencias',                tipo: 'LABORAL',                    abogadoId: 'u-laura',   clienteId: 'c-19', priority: 'NORMAL', montoDisputa: 4200000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 3500000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [25,40,55], inicioHace: 280, ubicacion: U.MENDOZA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2024-305', titulo: 'Agro Pampa c/ Acopiador s/ Cobro',                tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'HIGH',   montoDisputa: 11000000, cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 9500000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia','Ejecución de Sentencia'], diasPorEtapa: [30,50,25,40], inicioHace: 200, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Civil Nº 4' });
  casosDef.push({ numero: 'EXP-2024-306', titulo: 'Vega c/ Ex Cónyuge s/ Compensación',              tipo: 'FAMILIA',                    abogadoId: 'u-laura',   clienteId: 'c-15', priority: 'NORMAL', montoDisputa: 5000000,  cerrado: true,  motivoCierre: MOTIVOS.DESFAVORABLE, montoFinal: 0,       etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [30,45,65,30], inicioHace: 330, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2024-307', titulo: 'Farmacia c/ Proveedor s/ Incumplimiento',         tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-25', priority: 'NORMAL', montoDisputa: 2100000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 2000000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [20,40,45], inicioHace: 200, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 2' });
  casosDef.push({ numero: 'EXP-2024-309', titulo: 'Ruiz c/ Empresa Seguridad s/ Despido',            tipo: 'LABORAL',                    abogadoId: 'u-laura',   clienteId: 'c-19', priority: 'HIGH',   montoDisputa: 6800000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 6500000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [20,30,60,25], inicioHace: 240, ubicacion: U.CABA, juzgado: 'Juzgado Nacional del Trabajo Nº 8' });
  casosDef.push({ numero: 'EXP-2024-310A',titulo: 'Agro Pampa c/ Arrendatario s/ Rescisión',        tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'NORMAL', montoDisputa: 3200000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 2800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [30,40], inicioHace: 180, ubicacion: U.CORDOBA_RIO_CUARTO, juzgado: 'Juzgado Civil y Com. Nº 1' });
  // Inactivos
  casosDef.push({ numero: 'EXP-2023-007', titulo: 'Distribuidora c/ Cliente s/ Cobro Facturas',      tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-32', priority: 'NORMAL', montoDisputa: 2800000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 2500000, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Sentencia de 1ra Instancia'], diasPorEtapa: [35,50], inicioHace: 550, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Civil Nº 2' });
  casosDef.push({ numero: 'EXP-2023-008', titulo: 'Distribuidora c/ Empleado s/ Despido',            tipo: 'LABORAL',                    abogadoId: 'u-laura',   clienteId: 'c-32', priority: 'NORMAL', montoDisputa: 3500000,  cerrado: true,  motivoCierre: MOTIVOS.ACUERDO,      montoFinal: 2800000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,40], inicioHace: 480, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Laboral Nº 2' });
  casosDef.push({ numero: 'EXP-2023-009', titulo: 'Peralta s/ Alimentos',                            tipo: 'FAMILIA',                    abogadoId: 'u-laura',   clienteId: 'c-36', priority: 'NORMAL', montoDisputa: 1200000,  cerrado: true,  motivoCierre: MOTIVOS.FAVORABLE,    montoFinal: 1100000, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Sentencia de 1ra Instancia'], diasPorEtapa: [20,40], inicioHace: 380, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 4' });
  // Activos
  casosDef.push({ numero: 'EXP-2025-400', titulo: 'Vega s/ Tenencia',                                tipo: 'FAMILIA',                    abogadoId: 'u-laura',   clienteId: 'c-15', priority: 'HIGH',   montoDisputa: 0,        cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [12,15], inicioHace: 35, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado de Familia Nº 2' });
  casosDef.push({ numero: 'EXP-2025-401', titulo: 'Agro Pampa c/ Constructor s/ Vicios Galpón',     tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'NORMAL', montoDisputa: 8000000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [30,35], inicioHace: 80, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 1' });
  casosDef.push({ numero: 'EXP-2025-402', titulo: 'Castro c/ Municipalidad s/ Amparo',               tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-laura',   clienteId: 'c-17', priority: 'HIGH',   montoDisputa: 3000000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda'], diasPorEtapa: [], inicioHace: 12, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Cont. Adm. Nº 2' });
  casosDef.push({ numero: 'EXP-2025-403', titulo: 'TechCorp s/ Mediación Laboral Interna',           tipo: 'LABORAL',                    abogadoId: 'u-hernan',  clienteId: 'c-01', priority: 'NORMAL', montoDisputa: 600000,   cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [12], inicioHace: 18, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });
  casosDef.push({ numero: 'EXP-2025-404', titulo: 'Ruiz c/ ART s/ Accidente',                        tipo: 'LABORAL',                    abogadoId: 'u-laura',   clienteId: 'c-19', priority: 'HIGH',   montoDisputa: 9500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [20,25], inicioHace: 55, ubicacion: U.BA_LA_PLATA, juzgado: 'Juzgado Laboral Nº 3' });
  casosDef.push({ numero: 'EXP-2025-405', titulo: 'Farmacia c/ ANMAT s/ Habilitación',               tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-laura',   clienteId: 'c-25', priority: 'HIGH',   montoDisputa: 1500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo'], diasPorEtapa: [10], inicioHace: 16, ubicacion: U.CABA, juzgado: 'Juzgado Cont. Adm. Federal Nº 1' });
  casosDef.push({ numero: 'EXP-2025-406', titulo: 'Agro Pampa c/ Arrendatario s/ Desalojo Rural',   tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'NORMAL', montoDisputa: 4500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [22], inicioHace: 38, ubicacion: U.SANTA_FE_CAPITAL, juzgado: 'Juzgado Civil Nº 4' });
  // Estancados
  casosDef.push({ numero: 'EXP-2024-310', titulo: 'Agro Pampa c/ Banco s/ Ejecutivo',                tipo: 'CIVIL_COMERCIAL',            abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'LOW',    montoDisputa: 7500000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia'], diasPorEtapa: [40,55,35], inicioHace: 280, ubicacion: U.MENDOZA_CAPITAL, juzgado: 'Juzgado Civil Nº 2' });
  casosDef.push({ numero: 'EXP-2024-311', titulo: 'Agro Pampa s/ Sucesión Socio',                    tipo: 'SUCESIONES',                 abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'LOW',    montoDisputa: 30000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)'], diasPorEtapa: [50], inicioHace: 350, ubicacion: U.CORDOBA_CAPITAL, juzgado: 'Juzgado Civil Nº 8' });
  casosDef.push({ numero: 'EXP-2024-312', titulo: 'Agro Pampa c/ AFIP s/ Repetición',                tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-laura',   clienteId: 'c-20', priority: 'NORMAL', montoDisputa: 5800000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones','Sentencia de 1ra Instancia','Apelación / 2da Instancia'], diasPorEtapa: [35,50,30,45], inicioHace: 300, ubicacion: U.CABA, juzgado: 'Juzgado Cont. Adm. Federal Nº 4' });
  casosDef.push({ numero: 'EXP-2023-090', titulo: 'Vega c/ Estado s/ Expropiación',                  tipo: 'CONTENCIOSO_ADMINISTRATIVO', abogadoId: 'u-laura',   clienteId: 'c-15', priority: 'HIGH',   montoDisputa: 45000000, cerrado: false, etapasTransitadas: ['Inicio / Demanda','Prueba (Oficios/Pericias)','Alegatos / Conclusiones'], diasPorEtapa: [60,80], inicioHace: 600, ubicacion: U.TUCUMAN_CAPITAL, juzgado: 'Juzgado Cont. Adm. Nº 1' });
  casosDef.push({ numero: 'EXP-2024-313', titulo: 'Importadora c/ Empleado s/ Reinstalación',        tipo: 'LABORAL',                    abogadoId: 'u-agustin', clienteId: 'c-08', priority: 'HIGH',   montoDisputa: 5200000,  cerrado: false, etapasTransitadas: ['Inicio / Demanda','Mediación / Previo','Prueba (Oficios/Pericias)'], diasPorEtapa: [25,40], inicioHace: 190, ubicacion: U.MENDOZA_CAPITAL, juzgado: 'Juzgado Laboral Nº 1' });

  // ============================================================
  // 6. CREAR CASOS + BITÁCORAS
  // ============================================================
  let totalBitacoras = 0;

  let totalHistorial = 0;

  // Casos activos y de larga duración que reciben una actualización de monto.
  // Uno por abogado, para que el historial no quede concentrado en uno solo.
  const ACTUALIZAN_MONTO = [
    'EXP-2023-090',  // Vega c/ Estado s/ Expropiación — Laura, 45M, 600 días
    'EXP-2024-210',  // Romero s/ Usucapión — Mario, 25M, 400 días
    'EXP-2024-052',  // Mendoza s/ Sucesión — Hernán, 20M, 400 días
  ];

  const diasAtrasMs = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  // ============================================================
  // 5.5. COHERENCIA DE NÚMEROS Y MONTOS
  // ============================================================

  // Expedientes sin contenido patrimonial: no llevan monto en disputa.
  // (penal sin reclamo civil, tenencia/visitas, amparos, habilitaciones,
  //  cautelares y mediaciones internas)
  const SIN_MONTO = [
    'EXP-2025-302', 'EXP-2025-200', 'EXP-2025-400', 'EXP-2025-402',
    'EXP-2025-405', 'EXP-2023-080', 'EXP-2024-026', 'EXP-2024-106',
    'EXP-2025-202', 'EXP-2025-403',
  ];
  for (const def of casosDef) {
    if (SIN_MONTO.includes(def.numero)) {
      def.montoDisputa = null;
      def.montoFinal = null;
    }
  }

  // Renumeración: el año del expediente tiene que coincidir con su fechaInicio.
  // Se ordena del más viejo al más nuevo y se asigna correlativo por año.
  casosDef.sort((a, b) => b.inicioHace - a.inicioHace);
  const correlativoPorAnio = {};
  for (const def of casosDef) {
    const anio = diasAtrasMs(def.inicioHace).getFullYear();
    correlativoPorAnio[anio] = (correlativoPorAnio[anio] || 0) + 1;
    def.numeroOriginal = def.numero;
    def.numero = `EXP-${anio}-${String(correlativoPorAnio[anio]).padStart(3, '0')}`;
  }
  console.log(`🔢 Expedientes renumerados por año real de inicio:`,
    Object.entries(correlativoPorAnio).map(([a, c]) => `${a}: ${c}`).join(' | '));

  for (const def of casosDef) {
    const fechaInicio = diasAtrasMs(def.inicioHace);
    const etapaActual = def.etapasTransitadas[def.etapasTransitadas.length - 1];

    let fechaUltimoCambio = new Date(fechaInicio.getTime());
    for (const dias of def.diasPorEtapa) {
      fechaUltimoCambio = new Date(fechaUltimoCambio.getTime() + dias * 24 * 60 * 60 * 1000);
    }

    let updatedAt = new Date(fechaUltimoCambio.getTime());
    if (!def.cerrado) {
      const diasDesdeUltimoCambio = Math.floor((Date.now() - fechaUltimoCambio.getTime()) / (1000 * 60 * 60 * 24));
      if (diasDesdeUltimoCambio < 90) {
        const diasRecientes = Math.floor(Math.random() * Math.min(diasDesdeUltimoCambio, 20));
        updatedAt = diasAtrasMs(diasRecientes);
      }
    }

    let fechaCierre = null;
    if (def.cerrado) {
      const diasExtra = 15 + Math.floor(Math.random() * 30);
      fechaCierre = new Date(fechaUltimoCambio.getTime() + diasExtra * 24 * 60 * 60 * 1000);
      if (fechaCierre > new Date()) fechaCierre = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      updatedAt = fechaCierre;
    }

    const caso = await prisma.caso.create({
      data: {
        numero:              def.numero,
        titulo:              def.titulo,
        descripcion:         `Descripción del caso ${def.numero}`,
        tipo:                def.tipo,
        estado:              etapaActual,
        porcentajeAvance:    def.cerrado ? 100 : Math.min(Math.floor((def.etapasTransitadas.length / 7) * 100), 95),
        // Campos geográficos — ahora correctamente separados
        fuero:               def.ubicacion.fuero,
        provincia:           def.ubicacion.provincia,
        ciudad:              def.ubicacion.ciudad,
        juzgado:             def.juzgado,
        montoDisputa:        def.montoDisputa,
        montoFinal:          def.cerrado ? (def.montoFinal ?? null) : null,
        fechaInicio,
        fechaUltimoCambioEstado: fechaUltimoCambio,
        updatedAt,
        estaCerrado:         def.cerrado || false,
        fechaCierre,
        motivoCierre:        def.cerrado ? (def.motivoCierre || null) : null,
        observacionCierre:   def.cerrado ? `Cierre: ${def.motivoCierre || 'N/A'}` : null,
        cerradoPorId:        def.cerrado ? def.abogadoId : null,
        estadoAntesCierre:   def.cerrado ? etapaActual : null,
        abogadoId:           def.abogadoId,
        clienteId:           def.clienteId,
        priority:            def.priority || 'NORMAL',
      }
    });

    // ── HistorialMonto: fila inicial (solo casos con monto real) ──
    if (def.montoDisputa && def.montoDisputa > 0) {
      await prisma.historialMonto.create({
        data: {
          casoId:          caso.id,
          monto:           def.montoDisputa,
          motivo:          'Monto declarado al abrir el expediente',
          esInicial:       true,
          registradoPorId: def.abogadoId,
          fechaCambio:     fechaInicio,
          createdAt:       fechaInicio,
        }
      });
      totalHistorial++;

      // ── Actualización simulada en los casos largos ──
      if (ACTUALIZAN_MONTO.includes(def.numeroOriginal)) {
        const fechaActualizacion = new Date(fechaInicio.getTime() + 30 * 24 * 60 * 60 * 1000);
        const montoActualizado = Math.round(def.montoDisputa * 1.3);

        await prisma.historialMonto.create({
          data: {
            casoId:          caso.id,
            monto:           montoActualizado,
            motivo:          'Actualización monetaria por depreciación',
            esInicial:       false,
            registradoPorId: def.abogadoId,
            fechaCambio:     fechaActualizacion,
            createdAt:       fechaActualizacion,
          }
        });

        // El caso guarda el último valor como cache. updatedAt se pasa explícito
        // para no pisar la fecha calculada arriba (si no, estos tres casos
        // dejarían de figurar como estancados en los reportes).
        await prisma.caso.update({
          where: { id: caso.id },
          data:  { montoDisputa: montoActualizado, updatedAt },
        });
        totalHistorial++;
      }
    }

    // Bitácora: CREATE
    await prisma.bitacora.create({
      data: {
        casoId: caso.id, usuarioId: def.abogadoId,
        accion: 'CREATE', estadoNuevo: def.etapasTransitadas[0], estadoAnterior: null,
        texto: `Caso creado en estado: ${def.etapasTransitadas[0]}`,
        detalle: `Tipo: ${def.tipo}, Prioridad: ${def.priority}`,
        tipo: 'sistema', createdAt: fechaInicio,
      }
    });
    totalBitacoras++;

    // Bitácora: ESTADO_CHANGE
    let fechaAcumulada = new Date(fechaInicio.getTime());
    for (let i = 0; i < def.etapasTransitadas.length - 1; i++) {
      const diasEnEtapa = def.diasPorEtapa[i] || 30;
      fechaAcumulada = new Date(fechaAcumulada.getTime() + diasEnEtapa * 24 * 60 * 60 * 1000);
      await prisma.bitacora.create({
        data: {
          casoId: caso.id, usuarioId: def.abogadoId,
          accion: 'ESTADO_CHANGE',
          estadoAnterior: def.etapasTransitadas[i],
          estadoNuevo: def.etapasTransitadas[i + 1],
          texto: `Cambio de estado: ${def.etapasTransitadas[i]} → ${def.etapasTransitadas[i + 1]}`,
          detalle: 'Avance procesal', tipo: 'sistema', createdAt: fechaAcumulada,
        }
      });
      totalBitacoras++;
    }

    // Bitácora: CIERRE
    if (def.cerrado && fechaCierre) {
      await prisma.bitacora.create({
        data: {
          casoId: caso.id, usuarioId: def.abogadoId,
          accion: 'CIERRE', estadoAnterior: etapaActual, estadoNuevo: 'Cerrado',
          texto: `Caso cerrado: ${def.motivoCierre}`,
          detalle: `Monto final: $${def.montoFinal || 0}`,
          tipo: 'sistema', createdAt: fechaCierre,
        }
      });
      totalBitacoras++;
    }
  }

  console.log(`📂 ${casosDef.length} Casos creados.`);
  console.log(`📝 ${totalBitacoras} Entradas de bitácora creadas.`);
  console.log(`💰 ${totalHistorial} Filas de historial de monto creadas.`);


  // ============================================================
  // 6.5. GESTIÓN DE TAREAS (Agenda y Seguimiento)
  // ============================================================
console.log("📅 Generando tareas v4 (dispersión temporal, bitácoras unificadas)...");
 
  const casosDB = await prisma.caso.findMany();
  // Elige un caso coherente con la fecha de la tarea:
  //  - el expediente ya tiene que existir a esa fecha
  //  - si está cerrado, la tarea no puede ser posterior al cierre
  //  - las tareas todavía abiertas solo cuelgan de expedientes abiertos
  const getCasoAzar = (abogadoId, fechaTarea = null, soloAbiertos = false) => {
    let filtrados = casosDB.filter(c => c.abogadoId === abogadoId);
    if (soloAbiertos) filtrados = filtrados.filter(c => !c.estaCerrado);
    if (fechaTarea) {
      filtrados = filtrados.filter(c =>
        c.fechaInicio <= fechaTarea &&
        (!c.estaCerrado || !c.fechaCierre || c.fechaCierre >= fechaTarea)
      );
    }
    if (filtrados.length === 0) {
      filtrados = casosDB.filter(c =>
        c.abogadoId === abogadoId && (!fechaTarea || c.fechaInicio <= fechaTarea)
      );
    }
    return filtrados.length > 0 ? filtrados[Math.floor(Math.random() * filtrados.length)] : null;
  };  
 
  const tareasGeneradas = [];
  let comentariosGenerados = 0;
  let lecturasGeneradas = 0;
  let edicionesGeneradas = 0;
 
 // ══════════════════════════════════════════════════════════════════
// HELPERS DE FECHAS PRO (Evita Fines de Semana y Feriados 2026-2027)
// ══════════════════════════════════════════════════════════════════

// Lista de feriados judiciales/nacionales (Argentina 2026-2027)
const FERIADOS_JUDICIALES = [
  // 2026
  "2026-01-01", "2026-03-24", "2026-04-02", "2026-04-03", "2026-05-01",
  "2026-05-25", "2026-06-20", "2026-07-09", "2026-11-16", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-03-24", "2027-03-25", "2027-03-26", "2027-04-02",
  "2027-05-01", "2027-05-25", "2027-07-09", "2027-11-16", "2027-12-08", "2027-12-25"
];

function esInhabil(d) {
  const diaSemana = d.getDay(); // 0=Dom, 6=Sab
  const fechaIso = d.toISOString().split('T')[0];
  return diaSemana === 0 || diaSemana === 6 || FERIADOS_JUDICIALES.includes(fechaIso);
}

function ajustarDiaHabil(d, direccion = 1) {
  const nuevaFecha = new Date(d);
  // Mientras sea feriado o finde, sumamos (o restamos) días
  while (esInhabil(nuevaFecha)) {
    nuevaFecha.setDate(nuevaFecha.getDate() + direccion);
  }
  return nuevaFecha;
}

const hoyMs = Date.now();
// Para fechas pasadas, si cae inhabil, retrocedemos al viernes anterior (direccion -1)
const fecha = (diasAtras) => {
  const d = new Date(hoyMs - diasAtras * 24 * 60 * 60 * 1000);
  return ajustarDiaHabil(d, -1);
};
// Para fechas futuras, si cae inhabil, adelantamos al lunes siguiente (direccion 1)
const fechaFutura = (diasAdelante) => {
  const d = new Date(hoyMs + diasAdelante * 24 * 60 * 60 * 1000);
  return ajustarDiaHabil(d, 1);
};

const random = (min, max) => min + Math.random() * (max - min);
const randomInt = (min, max) => Math.floor(random(min, max + 1));
const pickArr = (arr) => arr[randomInt(0, arr.length - 1)];

// ──────────────────────────────────────────────────────────────────
 
  // ──────────────────────────────────────────────────────────────────
  // Plantillas de títulos por categoría
  // ──────────────────────────────────────────────────────────────────
  const titulos = {
    AUDIENCIA: ['Audiencia testimonial', 'Audiencia de conciliación', 'Audiencia preliminar', 'Audiencia de vista de causa', 'Asistencia a mediación'],
    PRESENTACION_ESCRITO: ['Contestar demanda', 'Presentar alegatos', 'Presentar liquidación', 'Contestar traslado', 'Presentar documental'],
    NOTIFICACION_CEDULA: ['Diligenciar cédula', 'Notificar sentencia', 'Enviar carta documento', 'Notificar traslado'],
    CONTROL_EXPEDIENTE: ['Revisar proveídos', 'Controlar paralización', 'Verificar estado en juzgado', 'Controlar oficios'],
    PERICIA_PRUEBA: ['Acompañar perito', 'Impugnar pericia', 'Controlar puntos de pericia'],
    APELACION_RECURSO: ['Presentar recurso de apelación', 'Fundamentar apelación', 'Contestar agravios'],
    REUNION_CLIENTE: ['Reunión de actualización', 'Reunión inicial', 'Firma de documentos', 'Reunión por estrategia'],
    REUNION_EQUIPO: ['Alineación de casos', 'Revisión semanal', 'Reunión de socios'],
    REDACCION_DOCUMENTACION: ['Redactar contrato', 'Preparar acuerdo', 'Redactar convenio', 'Armar poder'],
    REQUERIMIENTO_CLIENTE: ['Pedir DNI y CUIT', 'Solicitar comprobantes', 'Pedir testigos'],
    TRAMITE_ADMINISTRATIVO: ['Abonar tasa de justicia', 'Legalizar firma en colegio', 'Trámite en AFIP'],
    GESTION_FINANCIERA: ['Liquidación de honorarios', 'Cobro a cliente', 'Pago de gastos judiciales'],
    VENCIMIENTO_PLAZO: ['Vence plazo de prueba', 'Vence término traslado', 'Vence cómputo procesal'],
  };
 
  const motivosBloqueo = [
    'Falta documentación del cliente',
    'Juzgado de paro',
    'Perito no contestó',
    'A la espera de oficio del Banco Central',
    'Sistema del Poder Judicial caído',
    'Cliente no responde llamadas',
    'Esperando respuesta de la contraparte',
  ];
 
  const motivosCierreVencida = [
    'El socio decidió darla por perdida',
    'El plazo ya no tiene sentido procesal',
    'La contraparte retiró la demanda',
    'Se renegoció con el cliente, ya no aplica',
  ];

  function generarPerfilTemporal(diasInicio, perfilEstado) {
    const fechaInicio = fecha(diasInicio);
    let fechaVto, fechaComp, fechaCierreVencida, motivoCierreVencida;
 
    switch (perfilEstado) {
      case 'COMPLETADA_EN_PLAZO': {
        // Tarea con vto entre días iniciales y "ahora", completada antes del vto
        const diasHastaVto = Math.max(7, Math.floor(diasInicio * 0.5)); // medio camino
        fechaVto = fecha(diasInicio - diasHastaVto);
        // completada 2-5 días antes del vencimiento
        const diasAntes = randomInt(1, 5);
        fechaComp = new Date(fechaVto.getTime() - diasAntes * 24 * 60 * 60 * 1000);
        break;
      }
      case 'COMPLETADA_CON_DEMORA': {
        const diasHastaVto = Math.max(7, Math.floor(diasInicio * 0.4));
        fechaVto = fecha(diasInicio - diasHastaVto);
        // completada 3-15 días DESPUÉS del vencimiento
        const diasDespues = randomInt(3, 15);
        fechaComp = new Date(fechaVto.getTime() + diasDespues * 24 * 60 * 60 * 1000);
        // pero no en el futuro
        if (fechaComp > new Date()) fechaComp = fecha(1);
        break;
      }
      case 'VENCIDA_RECIENTE': {
        // venció hace 1-25 días
        const diasVencida = randomInt(1, 25);
        fechaVto = fecha(diasVencida);
        fechaComp = null;
        break;
      }
      case 'VENCIDA_ANTIGUA': {
        // venció hace 35-90 días → cae al histórico por time-boxing (>30d)
        const diasVencida = randomInt(35, 90);
        fechaVto = fecha(diasVencida);
        fechaComp = null;
        break;
      }
      case 'VENCIDA_CERRADA': {
        // venció hace 10-50 días, se cerró 5-15 días después
        const diasVencida = randomInt(10, 50);
        fechaVto = fecha(diasVencida);
        const diasDesdeQueSeCerro = Math.max(1, diasVencida - randomInt(5, 15));
        fechaCierreVencida = fecha(diasDesdeQueSeCerro);
        motivoCierreVencida = pickArr(motivosCierreVencida);
        fechaComp = null;
        break;
      }
      case 'PENDIENTE':
      case 'EN_PROCESO':
      case 'BLOQUEADA': {
        // activa, vence en el futuro entre 1 y 21 días
        fechaVto = fechaFutura(randomInt(1, 21));
        fechaComp = null;
        break;
      }
    }
 
    return { fechaInicio, fechaVto, fechaComp, fechaCierreVencida, motivoCierreVencida };
  }

   const ABOGADOS = ['u-hernan', 'u-agustin', 'u-mario', 'u-laura'];
  const ASISTENTE = 'u-asistente';
 
  // Helper para crear plantillas en lote
  const plantillas = [];
 
  // === ALERTAS GARANTIZADAS — al menos 1 por abogado ===
  // 1 FATAL vencida cada uno (4 tareas)
  ABOGADOS.forEach(ab => {
    plantillas.push({
      diasInicio: randomInt(20, 40),
      perfilEstado: 'VENCIDA_RECIENTE',
      prioridad: 'FATAL',
      tipo: 'PROCESAL',
      categoria: pickArr(['AUDIENCIA', 'PRESENTACION_ESCRITO', 'APELACION_RECURSO']),
      responsableId: ab,
    });
  });
 
  // 2 BLOQUEADAS con motivos variados cada uno (8 tareas)
  ABOGADOS.forEach(ab => {
    for (let k = 0; k < 2; k++) {
      plantillas.push({
        diasInicio: randomInt(15, 60),
        perfilEstado: 'BLOQUEADA',
        prioridad: pickArr(['ALTA', 'MEDIA']),
        tipo: pickArr(['PROCESAL', 'INTERNA']),
        categoria: null, // se elige según tipo
        responsableId: ab,
      });
    }
  });
 
  // 1 COMPLETADA_CON_DEMORA larga cada uno (4 tareas)
  ABOGADOS.forEach(ab => {
    plantillas.push({
      diasInicio: randomInt(60, 120),
      perfilEstado: 'COMPLETADA_CON_DEMORA',
      prioridad: pickArr(['ALTA', 'MEDIA']),
      tipo: pickArr(['PROCESAL', 'INTERNA']),
      categoria: null,
      responsableId: ab,
    });
  });
 
  // 1 VENCIDA_ANTIGUA cada uno (4 tareas) — caen al histórico
  ABOGADOS.forEach(ab => {
    plantillas.push({
      diasInicio: randomInt(80, 180),
      perfilEstado: 'VENCIDA_ANTIGUA',
      prioridad: pickArr(['ALTA', 'MEDIA', 'BAJA']),
      tipo: pickArr(['PROCESAL', 'INTERNA']),
      categoria: null,
      responsableId: ab,
    });
  });
 
  // 1 VENCIDA_CERRADA cada uno (4 tareas) — cierre manual con motivo
  ABOGADOS.forEach(ab => {
    plantillas.push({
      diasInicio: randomInt(50, 150),
      perfilEstado: 'VENCIDA_CERRADA',
      prioridad: pickArr(['MEDIA', 'BAJA']),
      tipo: pickArr(['PROCESAL', 'INTERNA']),
      categoria: null,
      responsableId: ab,
    });
  });
 
  // === Hasta acá: 24 plantillas garantizadas ===
  // === Faltan 66 para llegar a 90 ===
 
  // Distribución del resto: respetando proporciones por abogado
  // Hernán 23 - 6 garantizadas = 17 más
  // Agustín 20 - 6 garantizadas = 14 más
  // Mario 20 - 6 garantizadas = 14 más
  // Laura 20 - 6 garantizadas = 14 más
  // Asistente 7 - 0 garantizadas = 7 más
  const restantesPorAbogado = {
    'u-hernan':    17,
    'u-agustin':   14,
    'u-mario':     14,
    'u-laura':     14,
    'u-asistente':  7,
  };
 
  // Distribución temporal del resto: 31% recientes, 36% trimestre, 33% semestre
  // De los 66 restantes: ~20 recientes (0-30d), ~24 trimestre (30-90d), ~22 semestre (90-180d)
  const distribucionTemporal = [
    ...Array(20).fill('reciente'),    // 0-30 días
    ...Array(24).fill('trimestre'),   // 30-90 días
    ...Array(22).fill('semestre'),    // 90-180 días
  ];
  // Mezclar para variar
  for (let i = distribucionTemporal.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [distribucionTemporal[i], distribucionTemporal[j]] = [distribucionTemporal[j], distribucionTemporal[i]];
  }
 
  // Distribución de estados para los restantes (66 tareas):
  // Activas (PENDIENTE/EN_PROCESO): mayoría en recientes
  // COMPLETADAS: mezcla de recientes y antiguas
  // VENCIDAS adicionales: pocas, ya tenemos garantizadas
  // BLOQUEADAS adicionales: pocas, ya tenemos garantizadas
  const perfilesRestantes = [
    ...Array(22).fill('COMPLETADA_EN_PLAZO'),
    ...Array(8).fill('COMPLETADA_CON_DEMORA'),
    ...Array(7).fill('VENCIDA_RECIENTE'),
    ...Array(13).fill('PENDIENTE'),
    ...Array(9).fill('EN_PROCESO'),
    ...Array(7).fill('BLOQUEADA'),
  ];
  // Mezclar
  for (let i = perfilesRestantes.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [perfilesRestantes[i], perfilesRestantes[j]] = [perfilesRestantes[j], perfilesRestantes[i]];
  }
 
  let idxTemporal = 0;
  let idxPerfil = 0;
 
  // Construir plantillas restantes respetando cuota por abogado
  Object.entries(restantesPorAbogado).forEach(([abogado, cantidad]) => {
    for (let k = 0; k < cantidad; k++) {
      const bucketTemporal = distribucionTemporal[idxTemporal++] || 'reciente';
      const perfilEstado = perfilesRestantes[idxPerfil++] || 'PENDIENTE';
 
      let diasInicio;
      if (bucketTemporal === 'reciente') diasInicio = randomInt(1, 30);
      else if (bucketTemporal === 'trimestre') diasInicio = randomInt(31, 90);
      else diasInicio = randomInt(91, 180);
 
      // Si el perfil es COMPLETADA o VENCIDA, asegurar que diasInicio sea
      // suficiente para que la tarea haya tenido tiempo de cerrarse.
      if (perfilEstado.startsWith('COMPLETADA') && diasInicio < 7) diasInicio = randomInt(7, 30);
      if (perfilEstado.startsWith('VENCIDA') && diasInicio < 5) diasInicio = randomInt(5, 30);
 
      // El asistente solo hace tareas internas administrativas
      const esAsistente = abogado === ASISTENTE;
      const tipo = esAsistente ? 'INTERNA' : pickArr(['PROCESAL', 'PROCESAL', 'INTERNA']); // 66% procesal
      const prioridad = pickArr(['ALTA', 'MEDIA', 'MEDIA', 'BAJA']);
 
      plantillas.push({
        diasInicio,
        perfilEstado,
        prioridad,
        tipo,
        categoria: null,
        responsableId: abogado,
      });
    }
  });
 
  console.log(`   📋 Plantillas armadas: ${plantillas.length}`);
 
  // ──────────────────────────────────────────────────────────────────
  // CREACIÓN DE TAREAS
  // ──────────────────────────────────────────────────────────────────
  for (const p of plantillas) {
    // Resolver categoría si es null
    let categoria = p.categoria;
    if (!categoria) {
      if (p.tipo === 'PROCESAL') {
        const cats = ['AUDIENCIA', 'PRESENTACION_ESCRITO', 'NOTIFICACION_CEDULA',
                      'CONTROL_EXPEDIENTE', 'PERICIA_PRUEBA', 'APELACION_RECURSO'];
        categoria = pickArr(cats);
      } else {
        const cats = ['REUNION_CLIENTE', 'REDACCION_DOCUMENTACION', 'REQUERIMIENTO_CLIENTE',
                      'TRAMITE_ADMINISTRATIVO', 'REUNION_EQUIPO', 'GESTION_FINANCIERA'];
        categoria = p.responsableId === ASISTENTE ? 'TRAMITE_ADMINISTRATIVO' : pickArr(cats);
      }
    }
 
    const titulo = pickArr(titulos[categoria] || ['Evento sin título']);
    const ambito = (categoria === 'AUDIENCIA' || categoria === 'TRAMITE_ADMINISTRATIVO' ||
                    categoria === 'NOTIFICACION_CEDULA') ? 'EXTERNO' : 'INTERNO';
    const ubicacion = ambito === 'EXTERNO' ? 'Tribunales / Calle' : 'Estudio / Virtual';
 
    // Asistente trabaja sobre casos de Hernán (su jefe)
    const esAsistente = p.responsableId === ASISTENTE;
    const casoTarget = esAsistente ? 'u-hernan' : p.responsableId;
    let caso = null; // se elige más abajo, cuando ya tenemos las fechas
 
    // Generar fechas según perfil
    const tiempo = generarPerfilTemporal(p.diasInicio, p.perfilEstado);
    const requiereCasoAbierto = ['PENDIENTE', 'EN_PROCESO', 'BLOQUEADA', 'VENCIDA_RECIENTE']
      .includes(p.perfilEstado);
    caso = getCasoAzar(casoTarget, tiempo.fechaInicio, requiereCasoAbierto);
 
    // Estado final según perfil
    let estado;
    if (p.perfilEstado.startsWith('COMPLETADA')) estado = 'COMPLETADA';
    else if (p.perfilEstado.startsWith('VENCIDA')) estado = 'VENCIDA';
    else estado = p.perfilEstado;
 
    // Motivo de bloqueo si aplica
    const motivoBloqueo = estado === 'BLOQUEADA' ? pickArr(motivosBloqueo) : null;
 
    // Crear tarea
    const tarea = await prisma.tarea.create({
      data: {
        titulo: `${titulo}${caso ? ' - ' + caso.numero : ''}`,
        descripcion: `Evento autogenerado para análisis. Naturaleza ${p.tipo}.`,
        tipo: p.tipo,
        categoria: categoria,
        ambito: ambito,
        prioridad: p.prioridad,
        estado: estado,
        motivoBloqueo: motivoBloqueo,
        fechaInicio: tiempo.fechaInicio,
        fechaVencimiento: tiempo.fechaVto,
        fechaCompletada: tiempo.fechaComp,
        vencidaCerradaEn: tiempo.fechaCierreVencida || null,
        vencidaCerradaPorId: tiempo.fechaCierreVencida ? p.responsableId : null,
        motivoCierreVencida: tiempo.motivoCierreVencida || null,
        lugarFisico: ubicacion,
        casoId: caso ? caso.id : null,
        clienteId: caso ? caso.clienteId : null,
        creadorId: esAsistente ? 'u-hernan' : p.responsableId,
        responsableId: p.responsableId,
        supervisorId: esAsistente ? 'u-hernan' : null,
        createdAt: tiempo.fechaInicio, // ✅ consistente con dispersión temporal
      }
    });
    tareasGeneradas.push(tarea);
 
    // ════════════════════════════════════════════════════════════════
    // BITÁCORAS — nombres unificados (sin legacy)
    // ════════════════════════════════════════════════════════════════
 
    // 1. Creación
    await prisma.bitacora.create({
      data: {
        tareaId: tarea.id, usuarioId: tarea.creadorId,
        accion: 'TAREA_CREADA',
        estadoAnterior: null, estadoNuevo: 'PENDIENTE',
        texto: `Tarea creada y asignada.`,
        detalle: `Tipo: ${p.tipo} | Prioridad: ${p.prioridad} | Responsable: ${p.responsableId}`,
        tipo: 'sistema',
        createdAt: tiempo.fechaInicio,
      }
    });
 
    // 2. Transiciones según estado final
    if (estado === 'COMPLETADA') {
      // Una tarea completada típicamente fue PENDIENTE → EN_PROCESO → COMPLETADA
      const fechaEnProceso = new Date(tiempo.fechaInicio.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000);
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: 'TAREA_ESTADO_CHANGE',
          estadoAnterior: 'PENDIENTE', estadoNuevo: 'EN_PROCESO',
          texto: 'Se comenzó a trabajar en la tarea.',
          tipo: 'sistema',
          createdAt: fechaEnProceso,
        }
      });
 
      // Si fue completada con demora, usamos la acción específica
      const accionCompletado = p.perfilEstado === 'COMPLETADA_CON_DEMORA'
        ? 'TAREA_COMPLETADA_CON_DEMORA'
        : 'TAREA_ESTADO_CHANGE';
 
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: accionCompletado,
          estadoAnterior: 'EN_PROCESO',
          estadoNuevo: 'COMPLETADA',
          texto: p.perfilEstado === 'COMPLETADA_CON_DEMORA'
            ? 'Tarea completada con demora.'
            : 'Tarea completada en plazo.',
          tipo: 'sistema',
          createdAt: tiempo.fechaComp,
        }
      });
    } else if (estado === 'VENCIDA' && tiempo.fechaCierreVencida) {
      // Vencida cerrada manualmente
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: 'TAREA_VENCIDA_CERRADA_MANUAL',
          estadoAnterior: 'VENCIDA', estadoNuevo: 'VENCIDA',
          texto: `Vencida cerrada manualmente: ${tiempo.motivoCierreVencida}`,
          detalle: tiempo.motivoCierreVencida,
          tipo: 'manual',
          createdAt: tiempo.fechaCierreVencida,
        }
      });
    } else if (estado === 'BLOQUEADA') {
      // Bloqueada: PENDIENTE → EN_PROCESO → BLOQUEADA
      const fechaEnProceso = new Date(tiempo.fechaInicio.getTime() + randomInt(1, 4) * 24 * 60 * 60 * 1000);
      const fechaBloqueo = new Date(fechaEnProceso.getTime() + randomInt(1, 7) * 24 * 60 * 60 * 1000);
 
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: 'TAREA_ESTADO_CHANGE',
          estadoAnterior: 'PENDIENTE', estadoNuevo: 'EN_PROCESO',
          texto: 'Se comenzó a trabajar en la tarea.',
          tipo: 'sistema',
          createdAt: fechaEnProceso,
        }
      });
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: 'TAREA_ESTADO_CHANGE',
          estadoAnterior: 'EN_PROCESO', estadoNuevo: 'BLOQUEADA',
          texto: `Tarea bloqueada: ${motivoBloqueo}`,
          detalle: motivoBloqueo,
          tipo: 'manual',
          createdAt: fechaBloqueo,
        }
      });
    } else if (estado === 'EN_PROCESO') {
      const fechaEnProceso = new Date(tiempo.fechaInicio.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000);
      await prisma.bitacora.create({
        data: {
          tareaId: tarea.id, usuarioId: p.responsableId,
          accion: 'TAREA_ESTADO_CHANGE',
          estadoAnterior: 'PENDIENTE', estadoNuevo: 'EN_PROCESO',
          texto: 'Se comenzó a trabajar en la tarea.',
          tipo: 'sistema',
          createdAt: fechaEnProceso,
        }
      });
    }
 
    // ════════════════════════════════════════════════════════════════
    // EDICIONES SIMULADAS — bitácora de TAREA_EDITADA en algunas
    // ════════════════════════════════════════════════════════════════
    // ~25% de tareas reciben una edición posterior a su creación.
    // Esto le da data al reporte de cumplimiento para la columna "ediciones".
    if (Math.random() < 0.25) {
      const fechaEdicion = new Date(tiempo.fechaInicio.getTime() + randomInt(2, 10) * 24 * 60 * 60 * 1000);
      // No editar en el futuro
      if (fechaEdicion < new Date()) {
        const tipoEdicion = pickArr([
          { detalle: `Prioridad cambiada a ${p.prioridad}`, texto: 'Prioridad ajustada' },
          { detalle: 'Fecha de vencimiento extendida 5 días', texto: 'Plazo reagendado' },
          { detalle: 'Descripción actualizada', texto: 'Descripción modificada' },
          { detalle: 'Lugar/modalidad actualizada', texto: 'Modalidad ajustada' },
        ]);
        await prisma.bitacora.create({
          data: {
            tareaId: tarea.id,
            usuarioId: tarea.creadorId, // el creador es quien suele editar
            accion: 'TAREA_EDITADA',
            texto: tipoEdicion.texto,
            detalle: tipoEdicion.detalle,
            tipo: 'manual',
            createdAt: fechaEdicion,
          }
        });
        edicionesGeneradas++;
      }
    }
 
    // ════════════════════════════════════════════════════════════════
    // COMENTARIOS Y LECTURAS
    // ════════════════════════════════════════════════════════════════
    // Probabilidad: tareas con supervisor o bloqueadas → 70% de tener comentarios.
    // Resto → 30%.
    const probComentarios = (tarea.supervisorId || estado === 'BLOQUEADA') ? 0.7 : 0.3;
    if (Math.random() < probComentarios) {
      const fechaComentario1 = new Date(tiempo.fechaInicio.getTime() + randomInt(1, 5) * 24 * 60 * 60 * 1000);
      if (fechaComentario1 < new Date()) {
        const msj1 = estado === 'BLOQUEADA'
          ? `Doctor, ${motivoBloqueo.toLowerCase()}. ¿Cómo seguimos?`
          : pickArr([
              'Ya preparé el borrador, ¿lo revisa?',
              'Estoy esperando que el cliente firme.',
              'Logré contactar al perito, espera novedades pronto.',
              'Tengo dudas con el alegato, le mando lo redactado.',
            ]);
        const comentario = await prisma.comentarioTarea.create({
          data: {
            texto: msj1, tareaId: tarea.id, autorId: tarea.responsableId,
            createdAt: fechaComentario1,
          }
        });
        comentariosGenerados++;
 
        // Respuesta del supervisor / creador (~70% si hay primer comentario)
        if (Math.random() < 0.7) {
          const fechaComentario2 = new Date(fechaComentario1.getTime() + randomInt(1, 3) * 24 * 60 * 60 * 1000);
          if (fechaComentario2 < new Date()) {
            const msj2 = estado === 'BLOQUEADA'
              ? 'Anotado. Insisto la semana que viene, mientras tanto seguí con otras tareas.'
              : pickArr([
                  'Excelente, lo reviso y te aviso.',
                  'Buen trabajo, dale para adelante.',
                  'Recibido. Pasame el documento por mail.',
                  'OK, modifiquemos la prioridad.',
                ]);
            await prisma.comentarioTarea.create({
              data: {
                texto: msj2, tareaId: tarea.id,
                autorId: tarea.supervisorId || tarea.creadorId,
                citaComentarioId: comentario.id,
                createdAt: fechaComentario2,
              }
            });
            comentariosGenerados++;
          }
        }
 
        // Lectura "vieja" para que aparezca como notificación pendiente en algunas
        if (Math.random() < 0.5) {
          await prisma.tareaLectura.create({
            data: {
              userId: tarea.responsableId, tareaId: tarea.id,
              ultimaLectura: fecha(15), // lectura vieja → genera badge
            }
          });
          lecturasGeneradas++;
        }
      }
    }
  }

  // Las bitácoras de tareas también tienen que apuntar al expediente.
  // Sin esto quedan invisibles para cualquier reporte que entre por caso
  // (Actividad por Cliente filtra con casoId: { in: [...] }).
  let bitacorasVinculadas = 0;
  for (const t of tareasGeneradas) {
    if (t.casoId) {
      const r = await prisma.bitacora.updateMany({
        where: { tareaId: t.id },
        data:  { casoId: t.casoId },
      });
      bitacorasVinculadas += r.count;
    }
  }
  console.log(`🔗 ${bitacorasVinculadas} bitácoras de tarea vinculadas a su expediente.`);
 
  console.log(`📌 ${tareasGeneradas.length} Tareas generadas con dispersión temporal real.`);
  console.log(`📝 Bitácoras unificadas: TAREA_CREADA, TAREA_ESTADO_CHANGE, TAREA_COMPLETADA_CON_DEMORA, TAREA_VENCIDA_CERRADA_MANUAL, TAREA_EDITADA`);
  console.log(`💬 ${comentariosGenerados} Comentarios y ${lecturasGeneradas} lecturas simuladas.`);
  console.log(`✏️  ${edicionesGeneradas} Ediciones simuladas (acción TAREA_EDITADA en bitácora).`);
 
  // Resumen distribución temporal
  const tareasPorMes = { '0-30d': 0, '30-90d': 0, '90-180d': 0 };
  tareasGeneradas.forEach(t => {
    const dias = Math.floor((Date.now() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (dias <= 30) tareasPorMes['0-30d']++;
    else if (dias <= 90) tareasPorMes['30-90d']++;
    else tareasPorMes['90-180d']++;
  });
  console.log(`   📅 Dispersión temporal: ${tareasPorMes['0-30d']} recientes / ${tareasPorMes['30-90d']} trimestre / ${tareasPorMes['90-180d']} semestre`);
 
  // Resumen por responsable
  const tareasPorResp = {};
  tareasGeneradas.forEach(t => {
    tareasPorResp[t.responsableId] = (tareasPorResp[t.responsableId] || 0) + 1;
  });
  console.log(`   👥 Distribución por responsable:`);
  Object.entries(tareasPorResp).forEach(([id, cant]) => {
    const u = usuarios.find(u => u.id === id);
    const nombre = u ? u.nombre : id;
    console.log(`      ${nombre}: ${cant} tareas`);
  });
 
  // Resumen por estado
  const tareasPorEstado = {};
  tareasGeneradas.forEach(t => {
    tareasPorEstado[t.estado] = (tareasPorEstado[t.estado] || 0) + 1;
  });
  console.log(`   📊 Distribución por estado:`);
  Object.entries(tareasPorEstado).forEach(([estado, cant]) => {
    console.log(`      ${estado}: ${cant} tareas`);
  });

  // ============================================================
  // 7. RESUMEN
  // ============================================================
  const cerrados = casosDef.filter(c => c.cerrado);
  const activos  = casosDef.filter(c => !c.cerrado);
  const hoy      = new Date();

  const getEstancamiento = (c) => {
    let fecha = new Date(Date.now() - c.inicioHace * 24 * 60 * 60 * 1000);
    for (const d of c.diasPorEtapa) fecha = new Date(fecha.getTime() + d * 24 * 60 * 60 * 1000);
    return Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
  };

  const estancados    = activos.filter(c => getEstancamiento(c) >= 90);
  const favorables    = cerrados.filter(c => c.motivoCierre === 'FAVORABLE').length;
  const acuerdos      = cerrados.filter(c => c.motivoCierre === 'ACUERDO').length;
  const desfavorables = cerrados.filter(c => c.motivoCierre === 'DESFAVORABLE').length;
  const otrosCierre   = cerrados.length - favorables - acuerdos - desfavorables;

  // Distribución geográfica por provincia
  const geoMap = {};
  casosDef.forEach(c => {
    const prov = c.ubicacion.provincia;
    geoMap[prov] = (geoMap[prov] || 0) + 1;
  });

  // Distribución de clientes
  const clienteConCasos = {};
  casosDef.forEach(c => {
    if (!clienteConCasos[c.clienteId]) clienteConCasos[c.clienteId] = { total: 0, activos: 0, cerrados: 0 };
    clienteConCasos[c.clienteId].total++;
    if (c.cerrado) clienteConCasos[c.clienteId].cerrados++;
    else           clienteConCasos[c.clienteId].activos++;
  });

  const frecuentes   = Object.values(clienteConCasos).filter(c => c.total >= 5).length;
  const recurrentes  = Object.values(clienteConCasos).filter(c => c.total >= 2 && c.total < 5).length;
  const unicos       = Object.values(clienteConCasos).filter(c => c.total === 1).length;
  const soloInactivos= Object.values(clienteConCasos).filter(c => c.activos === 0).length;
  const sinCasos     = clientes.length - Object.keys(clienteConCasos).length;

  console.log("");
  console.log("✅ ===== SEED v3 COMPLETADO =====");
  console.log(`   • 6 Usuarios (1 Admin + 4 Abogados + 1 Asistente)`);
  console.log(`   • ${clientes.length} Clientes`);
  console.log(`   • ${casosDef.length} Casos: ${activos.length} activos + ${cerrados.length} cerrados`);
  console.log(`     Cerrados: ${favorables} favorables, ${acuerdos} acuerdos, ${desfavorables} desfavorables, ${otrosCierre} otros`);
  console.log(`   • Estancados: ${estancados.length}`);
  console.log("");
  console.log("   📊 Distribución de clientes (ES-12):");
  console.log(`      Frecuentes (5+ casos): ${frecuentes}`);
  console.log(`      Recurrentes (2-4 casos): ${recurrentes}`);
  console.log(`      Únicos (1 caso): ${unicos}`);
  console.log(`      Solo inactivos: ${soloInactivos}`);
  console.log(`      Sin casos: ${sinCasos}`);
  console.log(`   • ${tareasGeneradas.length} Tareas creadas para auditar (Completadas, Demoradas, Vencidas, Bloqueadas)`);
  console.log("");
  console.log("   📍 Distribución geográfica (por provincia):");
  Object.entries(geoMap).sort((a, b) => b[1] - a[1]).forEach(([prov, cant]) => {
    console.log(`      ${prov}: ${cant} casos`);
  });
  console.log("");

  for (const abId of ['u-hernan', 'u-agustin', 'u-mario', 'u-laura']) {
    const act  = activos.filter(c => c.abogadoId === abId).length;
    const cerr = cerrados.filter(c => c.abogadoId === abId).length;
    const est  = activos.filter(c => c.abogadoId === abId && getEstancamiento(c) >= 90).length;
    const nombre = usuarios.find(u => u.id === abId)?.nombre;
    console.log(`   ${nombre}: ${act} activos (${est} estancados) + ${cerr} cerrados`);
  }

  console.log("");
  console.log("🔑 Credenciales:");
  console.log("   franco.barbato@mi.unc.edu.ar / AzarDemo2026! (Admin)");
  console.log("   hernan@estudio.com / 123456");
  console.log("   agustin@estudio.com / 123456");
  console.log("   mario@estudio.com / 123456");
  console.log("   laura@estudio.com / 123456");
  console.log("   valentina@estudio.com / 123456 (Asistente)");
}

main()
  .catch((e) => { console.error("❌ Error en seed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
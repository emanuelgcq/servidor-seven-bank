import { Usuario, Servicio, Banco, Cuenta } from "./config.js";

export const SEVEN_BANK_ID = 1;

// Function to seed data
export const seedDatabase = async () => {
  // Generate random ID for cuentas
  const generateRandomCuentaId = () => {
    const n = 16;
    let result = (Math.floor(Math.random() * 9) + 1).toString(); // First digit between 1 and 9
    for (let i = 1; i < n; i++) {
      const digit = Math.floor(Math.random() * 10); // Subsequent digits between 0 and 9
      result += digit.toString();
    }
    return result;
  };

  const bancos = [
    {
      bancoId: SEVEN_BANK_ID,
      nombreBanco: "Seven Bank",
      tipoBanco: "Commercial",
      moneda: "VES",
    },
    {
      bancoId: 2,
      nombreBanco: "Banco de Venezuela",
      tipoBanco: "Savings",
      moneda: "VES",
    },
    {
      bancoId: 3,
      nombreBanco: "Banesco",
      tipoBanco: "Investment",
      moneda: "VES",
    },
    {
      bancoId: 4,
      nombreBanco: "Provincial",
      tipoBanco: "Commercial",
      moneda: "CAD",
    },
    { bancoId: 5, nombreBanco: "BNC", tipoBanco: "Savings", moneda: "AUD" },
  ];

  for (const banco of bancos) {
    await Banco.findOrCreate({
      where: { bancoId: banco.bancoId },
      defaults: banco,
    });
  }

  const usuarios = [
    {
      cedula: "1123456",
      nombre: "Alice",
      usuario: "dsdsdsd",
      apellido: "Johnson",
      numero: "1234567890",
      contrasena: "password1",
      direccion: "123 Main St",
    },
    {
      cedula: "4564512",
      nombre: "Bob",
      usuario: "sdsdsd",
      apellido: "Smith",
      numero: "0987654321",
      contrasena: "password2",
      direccion: "456 Elm St",
    },
    {
      cedula: "27198033",
      nombre: "Jose",
      usuario: "joseito",
      apellido: "Segovia",
      numero: "1122334455",
      contrasena: "123456",
      direccion: "789 Oak St",
    },
    {
      cedula: "27209996",
      role: "admin",
      nombre: "Junior",
      usuario: "as12",
      apellido: "Camacho",
      numero: "1122334455",
      contrasena: "123456",
      direccion: "789 Oak St",
    },
  ];

  for (const usuario of usuarios) {
    await Usuario.findOrCreate({
      where: { cedula: usuario.cedula },
      defaults: usuario,
    });
  }

  const cuentas = [
    {
      cuentaId: generateRandomCuentaId(),
      cedula: usuarios[0].cedula,
      balanceInicial: 1000.0,
      bancoId: 1,
    },
    {
      cuentaId: generateRandomCuentaId(),
      cedula: usuarios[1].cedula,
      balanceInicial: 4000.0,
      bancoId: SEVEN_BANK_ID,
    },
    {
      cuentaId: generateRandomCuentaId(),
      cedula: usuarios[2].cedula,
      balanceInicial: 3000.0,
      bancoId: 2,
    },
    {
      cuentaId: generateRandomCuentaId(),
      cedula: usuarios[3].cedula,
      claveEspecial: "123",
      balanceInicial: 10000.0,
      bancoId: SEVEN_BANK_ID,
    },
  ];

  for (const cuenta of cuentas) {
    await Cuenta.findOrCreate({
      where: { cuentaId: cuenta.cuentaId },
      defaults: cuenta,
    });
  }

  const servicios = [
    {
      servicioId: 1,
      descripcion: "Corpoelec",
      nombreCampo: "Nro de casa",
      montoMinimo: 100,
      serBenId: cuentas[0].cuentaId,
    },
    {
      servicioId: 2,
      descripcion: "Gaslara",
      nombreCampo: "Id de gaslara",
      montoMinimo: 40,
      serBenId: cuentas[0].cuentaId,
    },
    {
      servicioId: 3,
      descripcion: "Cantv",
      nombreCampo: "Nro linea telefonica",
      montoMinimo: 70,
      serBenId: cuentas[1].cuentaId,
    },
    {
      servicioId: 4,
      descripcion: "Digitel",
      nombreCampo: "Nro de celular",
      montoMinimo: 80,
      serBenId: cuentas[1].cuentaId,
    },
    {
      servicioId: 5,
      descripcion: "Movistar",
      nombreCampo: "Nro de celular",
      montoMinimo: 100,
      serBenId: cuentas[2].cuentaId,
    },
  ];

  for (const servicio of servicios) {
    await Servicio.findOrCreate({
      where: { servicioId: servicio.servicioId },
      defaults: servicio,
    });
  }

  console.log("Database seeded successfully.");
};

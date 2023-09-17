import { Sequelize, DataTypes, Model } from "sequelize";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.DB_NAME) throw new Error("DB_NAME is not defined");
if (!process.env.DB_DIALECT) throw new Error("DB_DIALECT is not defined");
if (!process.env.DB_USERNAME) throw new Error("DB_USERNAME is not defined");
if (!process.env.DB_PASSWORD) throw new Error("DB_PASSWORD is not defined");
if (!process.env.DB_HOST) throw new Error("DB_HOST is not defined");
if (!process.env.DB_PORT) throw new Error("DB_PORT is not defined");

const sequelize = new Sequelize({
  database: process.env.DB_NAME,
  dialect: process.env.DB_DIALECT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  define: {
    timestamps: false,
    paranoid: false,
    underscored: false,
    freezeTableName: true,
  },
});

function generateRandomNDigitsNumber(n) {
  if (n <= 0) return null;

  let result = (Math.floor(Math.random() * 9) + 1).toString(); // First digit between 1 and 9

  for (let i = 1; i < n; i++) {
    const digit = Math.floor(Math.random() * 10); // Subsequent digits between 0 and 9
    result += digit.toString();
  }

  return result;
}

export class Usuario extends Model {}
Usuario.init(
  {
    cedula: { type: DataTypes.STRING(10), primaryKey: true },
    nombre: DataTypes.STRING,
    usuario: { type: DataTypes.STRING, unique: true },
    correo: { type: DataTypes.STRING, unique: true },
    role: {
      type: DataTypes.ENUM,
      values: ["admin", "user"],
      defaultValue: "user",
    },
    numero: DataTypes.STRING,
    fechaCuenta: { type: DataTypes.DATE, defaultValue: Sequelize.NOW },
    contrasena: DataTypes.STRING,
    apellido: DataTypes.STRING,
    direccion: DataTypes.STRING,
  },
  {
    hooks: {
      beforeCreate: async (user) => {
        const salt = await bcrypt.genSalt(10);
        user.contrasena = await bcrypt.hash(user.contrasena, salt);
      },
      beforeUpdate: async (user) => {
        if (user.changed("contrasena")) {
          const salt = await bcrypt.genSalt(10);
          user.contrasena = await bcrypt.hash(user.contrasena, salt);
        }
      },
    },
    sequelize,
    modelName: "Usuario",
  }
);

// Session model
export class Session extends Model {}
Session.init(
  {
    accessToken: { type: DataTypes.STRING, primaryKey: true },
    cedula: DataTypes.STRING(10),
  },
  { sequelize, modelName: "Session" }
);

// Relationship
Usuario.hasMany(Session, { foreignKey: "cedula" });
Session.belongsTo(Usuario, { foreignKey: "cedula" });

export class Cuenta extends Model {}
Cuenta.init(
  {
    cuentaId: { type: DataTypes.STRING, primaryKey: true },
    cedula: { type: DataTypes.STRING(10), unique: true },
    claveEspecial: DataTypes.STRING,
    balance: DataTypes.FLOAT,
    balanceInicial: { type: DataTypes.FLOAT, defaultValue: 0 },
    bancoId: DataTypes.INTEGER,
  },
  {
    hooks: {
      beforeCreate: (cuenta) => {
        cuenta.cuentaId = generateRandomNDigitsNumber(16);
        cuenta.balance = cuenta.balanceInicial;
      },
    },
    sequelize,
    modelName: "Cuenta",
  }
);

Usuario.hasOne(Cuenta, { foreignKey: "cedula", as: "cuenta" });
Cuenta.belongsTo(Usuario, { foreignKey: "cedula" });

export class Tarjeta extends Model {}
Tarjeta.init(
  {
    tarjetaId: { type: DataTypes.STRING, primaryKey: true },
    cuentaId: DataTypes.STRING,
    tipoTarjeta: DataTypes.STRING,
    cvc: DataTypes.INTEGER,
    balance: DataTypes.FLOAT,
    fechaExp: DataTypes.DATE,
    contraseña: DataTypes.INTEGER,
  },
  {
    hooks: {
      beforeCreate: (tarjeta) => {
        tarjeta.tarjetaId = generateRandomNDigitsNumber(16);
        tarjeta.cvc = parseInt(generateRandomNDigitsNumber(3));
        tarjeta.balance = 0;
        // Create a new Date object to get the current date
        const currentDate = new Date();

        // Add 2 years to the current year
        const futureYear = currentDate.getFullYear() + 2;

        // Set the new year to the current date object
        currentDate.setFullYear(futureYear);

        // Assign the updated date to the fechaExp field
        tarjeta.fechaExp = currentDate;
      },
    },
    sequelize,
    modelName: "Tarjeta",
  }
);

Tarjeta.belongsTo(Cuenta, { foreignKey: "cuentaId", as: "cuenta" });
Cuenta.hasMany(Tarjeta, { foreignKey: "cuentaId" });

export class SolicitudTarjeta extends Model {}
SolicitudTarjeta.init(
  {
    solicitudId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cedula: DataTypes.STRING(10),
    tipoTarjeta: DataTypes.STRING,
    motivo: DataTypes.STRING,
    estatus: DataTypes.ENUM("Pending", "Approved", "Rejected"),
    fechaSolicitud: DataTypes.DATE,
    fechaRevision: DataTypes.DATE,
  },
  { sequelize, modelName: "CardApplication" }
);

// Relationships
SolicitudTarjeta.belongsTo(Usuario, { foreignKey: "cedula" });
Usuario.hasMany(SolicitudTarjeta, { foreignKey: "cedula" });

export class HistorialTransacciones extends Model {}
HistorialTransacciones.init(
  {
    transaccionId: { type: DataTypes.STRING(14), primaryKey: true },
    cuentaId: DataTypes.STRING,
    tarjetaId: DataTypes.STRING,
    descripcion: DataTypes.STRING,
    fecha: DataTypes.DATE,
    monto: DataTypes.FLOAT,
    tipoTransaccion: DataTypes.STRING,
    beneficiarioCuentaId: DataTypes.STRING,
  },
  {
    hooks: {
      beforeCreate: (transaction) => {
        transaction.transaccionId = generateRandomNDigitsNumber(13);
      },
    },
    sequelize,
    modelName: "HistorialTransacciones",
  }
);

HistorialTransacciones.belongsTo(Cuenta, { foreignKey: "cuentaId" });
Cuenta.hasMany(HistorialTransacciones, { foreignKey: "cuentaId" });
HistorialTransacciones.belongsTo(Cuenta, {
  foreignKey: "beneficiarioCuentaId",
});
Cuenta.hasMany(HistorialTransacciones, { foreignKey: "beneficiarioCuentaId" });

export class Servicio extends Model {}
Servicio.init(
  {
    servicioId: { type: DataTypes.INTEGER, primaryKey: true },
    descripcion: DataTypes.STRING,
    nombreCampo: DataTypes.STRING,
    montoMinimo: DataTypes.FLOAT,
    serBenId: DataTypes.STRING,
  },
  { sequelize, modelName: "Servicio" }
);

Servicio.belongsTo(Cuenta, { foreignKey: "serBenId" });
Cuenta.hasMany(Servicio, { foreignKey: "serBenId" });

export class BeneficiarioFrecuente extends Model {}
BeneficiarioFrecuente.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    aliasBeneficiario: DataTypes.STRING,
    cuentaBeneficiario: DataTypes.STRING,
    cedulaBeneficiario: DataTypes.STRING,
    cedula: DataTypes.STRING(10),
  },
  { sequelize, modelName: "BeneficiarioFrecuente" }
);

BeneficiarioFrecuente.belongsTo(Usuario, { foreignKey: "cedulaBeneficiario" });
BeneficiarioFrecuente.belongsTo(Usuario, { foreignKey: "cedula" });
Usuario.hasMany(BeneficiarioFrecuente, { foreignKey: "cedula" });
Usuario.hasMany(BeneficiarioFrecuente, { foreignKey: "cedulaBeneficiario" });
BeneficiarioFrecuente.belongsTo(Cuenta, { foreignKey: "cuentaBeneficiario" });
Cuenta.hasMany(BeneficiarioFrecuente, { foreignKey: "cuentaBeneficiario" });

export class Banco extends Model {}
Banco.init(
  {
    bancoId: { type: DataTypes.INTEGER, primaryKey: true },
    nombreBanco: DataTypes.STRING,
    tipoBanco: DataTypes.STRING,
    moneda: DataTypes.STRING,
  },
  { sequelize, modelName: "Banco" }
);

Banco.hasMany(Cuenta, { foreignKey: "bancoId" });
Cuenta.belongsTo(Banco, { foreignKey: "bancoId" });

export { sequelize };

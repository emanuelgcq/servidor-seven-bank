import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import {
  Usuario,
  Session,
  Cuenta,
  Banco,
  sequelize,
  BeneficiarioFrecuente,
} from "../../database/config.js";
import { asyncWrapper } from "../../utils/methodsWrapper.js";
import { SEVEN_BANK_ID } from "../../database/seed.js";
import { autenticar } from "../../middlewares/authentication.middleware.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

router.get(
  "/users",
  autenticar,
  asyncWrapper(async (req, res) => {
    if (req.user.role != "admin") {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "No tienes permisos para realizar esta acción",
      });
    }
    const users = await Usuario.findAll({
      attributes: {
        exclude: ["contrasena"],
      },
      include: [
        {
          model: Cuenta,
          as: "cuenta",
          include: Banco
        },
      ],
    });
    res.json({
      users,
    });
  })
);

// Get user account data
router.get(
  "/me",
  autenticar,
  asyncWrapper(async (req, res) => {
    const { cedula } = req.user;

    const user = await Usuario.findOne({
      where: { cedula },
      attributes: {
        exclude: ["contrasena"],
      },
    });

    const account = await Cuenta.findOne({
      where: { cedula },
      attributes: {
        exclude: ["claveEspecial"],
      },
      include: [
        {
          model: Banco, // Include Banco model
          attributes: ["moneda"], // Select only 'moneda' attribute
        },
      ],
    });

    res.json({ user, account });
  })
);

const SECRET_KEY = process.env.SECRET_KEY;

// Register a new user
router.post(
  "/register",
  asyncWrapper(async (req, res) => {
    const {
      cedula,
      nombre,
      numero,
      usuario,
      contrasena,
      apellido,
      direccion,
      correo,
    } = req.body;

    const t = await sequelize.transaction(); // Start a new transaction

    try {
      const newUser = await Usuario.create(
        {
          cedula,
          nombre,
          usuario,
          numero,
          correo,
          contrasena,
          apellido,
          direccion,
        },
        { transaction: t }
      );

      // You might also want to create an associated BankAccount for this new user
      const newAccount = await Cuenta.create(
        {
          cedula,
          balance: 0,
          bancoId: SEVEN_BANK_ID,
        },
        { transaction: t }
      );

      // If everything works, commit the transaction
      await t.commit();

      const userResponse = (({
        cedula,
        nombre,
        numero,
        apellido,
        direccion,
      }) => ({
        cedula,
        nombre,
        numero,
        apellido,
        direccion,
      }))(newUser.get());

      // Generate an access token
      const accessToken = jwt.sign({ cedula }, SECRET_KEY, {
        expiresIn: 15 * 60, // 15 minutes sessions
      });

      // Save the access token to the Session model
      await Session.create({ accessToken, cedula });

      res.json({ user: userResponse, account: newAccount, accessToken });
    } catch (error) {
      // If an error occurs, rollback the transaction
      await t.rollback();
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: "Un error ocurrió al registrar el usuario",
      });
    }
  })
);

router.post(
  "/login",
  asyncWrapper(async (req, res) => {
    const { cedula, contrasena } = req.body;

    // Find the user by cedula
    const user = await Usuario.findOne({ where: { cedula } });

    if (!user) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Credenciales invalidas" });
    }

    // Check if the password is correct
    const isValidPassword = await bcrypt.compare(contrasena, user.contrasena);

    if (!isValidPassword) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Credenciales invalidas" });
    }

    // Generate an access token
    const accessToken = jwt.sign({ cedula: user.cedula }, SECRET_KEY, {
      expiresIn: 15 * 60, // 15 minutes sessions
    });

    // Save the access token to the Session model
    await Session.create({ accessToken, cedula: user.cedula });

    res.json({ accessToken });
  })
);

router.post(
  "/clave-especial",
  autenticar,
  asyncWrapper(async (req, res) => {
    const claveEspecial = req.body.claveEspecial;
    const cuentaId = req.account.cuentaId;

    // Update the claveEspecial for the account with the given cuentaId
    const [updatedRows] = await Cuenta.update(
      { claveEspecial },
      { where: { cuentaId } }
    );

    if (updatedRows > 0) {
      res.status(StatusCodes.OK).json({
        message: "Clave especial actualizada exitosamente",
      });
    } else {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: "No se pudo actualizar la clave especial",
      });
    }
  })
);

router.post(
  "/user-clave",
  autenticar,
  asyncWrapper(async (req, res) => {
    const newPassword = req.body.clave;
    req.user.contrasena = newPassword;
    await req.user.save();
    res.status(StatusCodes.OK).json({
      message: "Contraseña actualizada exitosamente",
    });
  })
);

router.post(
  "/add-beneficiary",
  autenticar,
  asyncWrapper(async (req, res) => {
    const { alias, cuentaId } = req.body;

    const cuenta = await Cuenta.findOne({ where: { cuentaId } });

    await BeneficiarioFrecuente.create({
      aliasBeneficiario: alias,
      cuentaBeneficiario: cuentaId,
      cedulaBeneficiario: cuenta.cedula,
      cedula: req.user.cedula,
    });

    res.status(StatusCodes.OK).json({
      message: "Beneficiario frecuente agregado exitosamente",
    });
  })
);

router.get(
  "/beneficiarios",
  autenticar,
  asyncWrapper(async (req, res) => {
    const beneficiarios = await BeneficiarioFrecuente.findAll({
      where: { cedula: req.user.cedula },
    });

    res.status(StatusCodes.OK).json({
      beneficiarios,
    });
  })
);

router.post(
  "/logout",
  asyncWrapper(async (req, res) => {
    // Extract the Bearer token from the Authorization header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ message: "Token is required", success: false });
    }

    // Remove the session token from the database
    const result = await Session.destroy({
      where: {
        accessToken: token,
      },
    });

    if (result) {
      return res
        .status(StatusCodes.OK)
        .json({ message: "Sesion cerrada exitosamente" });
    } else {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Error cerrando sesion" });
    }
  })
);

export default router;

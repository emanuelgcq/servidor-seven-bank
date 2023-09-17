import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { autenticar } from "../../middlewares/authentication.middleware.js";
import {
  SolicitudTarjeta,
  Cuenta,
  Banco,
  Tarjeta,
  HistorialTransacciones,
} from "../../database/config.js";
import { asyncWrapper } from "../../utils/methodsWrapper.js";

const router = Router();

// POST /request-card endpoint
router.post(
  "/request-card",
  autenticar,
  asyncWrapper(async (req, res) => {
    const motivo = req.body.motivo;
    const cedula = req.user.cedula;
    const cuentaId = req.account.cuentaId;

    // Create a new record in the database using the Sequelize model
    await SolicitudTarjeta.create({
      cedula,
      tipoTarjeta: "Credito",
      estatus: "Approved",
      fechaSolicitud: req.body.fechaSolicitud,
      motivo,
      fechaRevision: new Date(), // Current date, or set it to null if it should be empty initially
    });

    const tarjeta = await Tarjeta.create({
      cuentaId,
      tipoTarjeta: "Credito",
    });

    // Respond with the created object
    res.status(StatusCodes.CREATED).json({ tarjetaId: tarjeta.tarjetaId });
  })
);

// Endpoint to get latest transactions of a user
router.get(
  "/card-movements/:tarjetaId",
  autenticar,
  asyncWrapper(async (req, res) => {
    const tarjetaId = req.params.tarjetaId;
    const account = req.account;

    // obtener datos de la tarjeta
    const tarjeta = await Tarjeta.findByPk(tarjetaId, {
      attributes: { exclude: ["contraseña", "cvc"] },
      include: [
        {
          model: Cuenta,
          as: "cuenta",
          attributes: ["bancoId"],
          include: [
            {
              model: Banco,
              attributes: ["moneda"],
            },
          ],
        },
      ],
    });

    // verificar tarjeta existe y pertenece a cuenta de usuario
    if (account.cuentaId !== tarjeta.cuentaId) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Tarjeta no encontrada" });
    }

    // Retrieve latest transactions where the user is either the sender or the recipient
    let transactions = await HistorialTransacciones.findAll({
      where: {
        tarjetaId,
      },
      order: [["fecha", "DESC"]],
      limit: 10,
    });

    res.status(StatusCodes.OK).json({ transactions, tarjeta });
  })
);

// GET /cards endpoint
router.get(
  "/cards",
  autenticar,
  asyncWrapper(async (req, res) => {
    const accountId = req.account.cuentaId;

    // Fetch cards from the database using the accountId
    const cards = await Tarjeta.findAll({
      where: {
        cuentaId: accountId,
      },
    });
    // Respond with the fetched cards
    res.status(StatusCodes.OK).json(cards);
  })
);

export default router;

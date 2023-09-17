import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { autenticar } from "../../middlewares/authentication.middleware.js";
import {
  Servicio,
  Cuenta,
  sequelize,
  HistorialTransacciones,
} from "../../database/config.js";
import { asyncWrapper } from "../../utils/methodsWrapper.js";

const router = Router();

router.get(
  "/services",
  autenticar,
  asyncWrapper(async (req, res) => {
    const servicios = await Servicio.findAll();
    res.json({ servicios });
  })
);

router.post(
  "/pay-service",
  autenticar,
  asyncWrapper(async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { amount, servicioId, fieldPaid } = req.body;

      const servicio = await Servicio.findByPk(servicioId);
      if (!servicio) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ message: "Servicio no encontrado" });
      }

      if (amount < servicio.montoMinimo) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Monto mínimo no alcanzado" });
      }

      // obtener cuenta del enviante
      const senderAccount = await Cuenta.findByPk(req.account.cuentaId, {
        transaction: t,
      });
      senderAccount.balance -= amount;

      const transaction = await HistorialTransacciones.create(
        {
          cuentaId: req.account.cuentaId,
          descripcion: fieldPaid,
          fecha: new Date(),
          monto: amount,
          tipoTransaccion: "payment",
          beneficiarioCuentaId: servicio.serBenId,
        },
        { transaction: t }
      );
      await senderAccount.save({ transaction: t });
      await t.commit();
      res.status(StatusCodes.CREATED).json({ transaction });
    } catch (error) {
      await t.rollback();
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  })
);

export default router;

import { Op } from "sequelize";
import { StatusCodes } from "http-status-codes";
import {
  Cuenta,
  HistorialTransacciones,
  sequelize,
  Tarjeta,
} from "../../database/config.js";
import { generateAccountStatementPDF } from "../../utils/pdf-generator.js";
import { autenticar } from "../../middlewares/authentication.middleware.js";
import { validarClaveEspecial } from "../../middlewares/claveEspecial.middleware.js";
import { asyncWrapper } from "../../utils/methodsWrapper.js";
import { Router } from "express";

const router = Router();

router.post(
  "/bank-transfer",
  autenticar,
  validarClaveEspecial,
  asyncWrapper(async (req, res) => {
    const { recipientCuentaId, descripcion, recipientCedula, bancoId } =
      req.body;
    const amount = parseFloat(req.body.amount);
    const senderCuentaId = req.account.cuentaId;

    const t = await sequelize.transaction();

    try {
      // obtener cuentas del enviante y del destinatario
      const senderAccount = await Cuenta.findByPk(senderCuentaId, {
        transaction: t,
      });
      const recipientAccount = await Cuenta.findByPk(recipientCuentaId, {
        transaction: t,
      });

      // validar tanto cuenta enviante como cuenta destinataria existen
      if (!senderAccount || !recipientAccount) {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: "Cuenta no encontrada",
        });
      }

      // validar cuenta del destinatario corresponde a banco indicado
      if (recipientAccount.bancoId !== parseInt(bancoId)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Cuenta no coincide con banco",
        });
      }

      // validar cedula del destinatario corresponde a cuenta bancaria indicada
      if (recipientCedula !== recipientAccount.cedula) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "Cedula no coincide con cuenta bancaria",
        });
      }

      // validar fondos en cuenta enviante son suficientes
      if (senderAccount.balance < amount) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Fondos insuficientes" });
      }

      // Realizar la transferencia del monto indicado
      senderAccount.balance -= amount;
      recipientAccount.balance += amount;

      await senderAccount.save({ transaction: t });
      await recipientAccount.save({ transaction: t });

      // Crear registro en historial de transacciones
      const transaction = await HistorialTransacciones.create(
        {
          cuentaId: senderCuentaId,
          descripcion,
          fecha: new Date(),
          monto: amount,
          tipoTransaccion: "transfer",
          beneficiarioCuentaId: recipientCuentaId,
        },
        { transaction: t }
      );
      // proceder con cambios a nivel de bd
      await t.commit();
      res.status(StatusCodes.CREATED).json({ success: true, transaction });
    } catch (error) {
      // en caso de error retroceder cualquier cambio en la bd
      await t.rollback();
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  })
);

router.post(
  "/transfer-tdc",
  autenticar,
  validarClaveEspecial,
  asyncWrapper(async (req, res) => {
    const { tarjetaId } = req.body;
    const amount = parseFloat(req.body.amount);
    const senderCuentaId = req.account.cuentaId;

    const t = await sequelize.transaction();

    try {
      // obtener cuenta del enviante
      const senderAccount = await Cuenta.findByPk(senderCuentaId, {
        transaction: t,
      });

      // obtener tarjeta de credito a recargar
      const tarjeta = await Tarjeta.findByPk(tarjetaId, {
        transaction: t,
      });

      // verificar cuenta y tdc existan
      if (!senderAccount || !tarjeta) {
        return res.status(StatusCodes.NOT_FOUND).json({
          message: "Tarjeta de credito no encontrada",
        });
      }

      // verificar balance en cuenta sea suficiente
      if (senderAccount.balance < amount) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: "Fondos insuficientes" });
      }

      // realizar el cambio de los balances
      senderAccount.balance -= amount;
      tarjeta.balance += amount;

      await senderAccount.save({ transaction: t });
      await tarjeta.save({ transaction: t });

      // guardar en historial de transacciones
      const transaction = await HistorialTransacciones.create(
        {
          cuentaId: senderCuentaId,
          descripcion: "Pago TDC",
          fecha: new Date(),
          monto: amount,
          tipoTransaccion: "transfer-tdc",
          tarjetaId: tarjeta.tarjetaId,
        },
        { transaction: t }
      );

      await t.commit();
      res.status(StatusCodes.CREATED).json({ success: true, transaction });
    } catch (error) {
      await t.rollback();
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
  })
);

// Endpoint to get latest transactions of a user
router.get(
  "/movements",
  autenticar,
  asyncWrapper(async (req, res) => {
    const { fromDate, toDate, limit } = req.query;
    const account = req.account;

    let adjustedFromDate, adjustedToDate;

    if (fromDate) {
      const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
      adjustedFromDate = new Date(
        Date.UTC(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0)
      );
    }

    if (toDate) {
      const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
      adjustedToDate = new Date(
        Date.UTC(toYear, toMonth - 1, toDay, 23, 59, 59, 999)
      );
    }

    let dateFilter = {};

    if (adjustedFromDate && adjustedToDate) {
      dateFilter = {
        fecha: { [Op.between]: [adjustedFromDate, adjustedToDate] },
      };
    } else if (adjustedFromDate) {
      dateFilter = { fecha: { [Op.gte]: adjustedFromDate } };
    } else if (adjustedToDate) {
      dateFilter = { fecha: { [Op.lte]: adjustedToDate } };
    }

    let currentBalance = account.balance;

    // Retrieve latest transactions where the user is either the sender or the recipient
    let transactions = await HistorialTransacciones.findAll({
      where: {
        [Op.or]: [
          { cuentaId: account.cuentaId },
          { beneficiarioCuentaId: account.cuentaId },
        ],
        ...dateFilter,
      },
      order: [["fecha", "DESC"]],
      limit: parseInt(limit) || 10,
    });

    // Add the transaction direction field
    transactions = transactions.map((transaction, index) => {
      const isOutgoing = transaction.cuentaId === account.cuentaId;
      return {
        ...transaction.get(), // Assuming you have getters, otherwise just use 'transaction'
        debitOrCredit: isOutgoing ? "Debito" : "Credito",
      };
    });

    transactions = transactions.map((transaction, index) => {
      if (index > 0) {
        const lastTx = transactions[index - 1];
        if (lastTx.debitOrCredit === "Debito") {
          currentBalance += lastTx.monto;
        } else {
          currentBalance -= lastTx.monto;
        }
      }
      return {
        ...transaction,
        balance: currentBalance,
      };
    });
    res.status(StatusCodes.OK).json({ success: true, transactions });
  })
);

// Endpoint to get account statements for a specific month
router.get(
  "/statements",
  autenticar,
  asyncWrapper(async (req, res) => {
    const { year, month } = req.query; // Expected to be numbers
    const account = req.account;

    if (!year || !month) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Year and month are required" });
    }

    // Create start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Fetch transactions for the given month
    let transactions = await HistorialTransacciones.findAll({
      where: {
        [Op.or]: [
          { cuentaId: account.cuentaId },
          { beneficiarioCuentaId: account.cuentaId },
        ],
        fecha: { [Op.between]: [startDate, endDate] },
      },
      order: [["fecha", "ASC"]],
    });

    // Calculate Balances
    const sumSpent = await HistorialTransacciones.sum("monto", {
      where: {
        cuentaId: account.cuentaId,
        fecha: {
          [Op.lt]: startDate,
        },
      },
    });

    const sumReceived = await HistorialTransacciones.sum("monto", {
      where: {
        beneficiarioCuentaId: account.cuentaId,
        fecha: {
          [Op.lt]: startDate,
        },
      },
    });

    const initialBalance = account.balanceInicial + sumReceived - sumSpent;

    const sumSpentEnd = await HistorialTransacciones.sum("monto", {
      where: {
        cuentaId: account.cuentaId,
        fecha: {
          [Op.lte]: endDate,
        },
      },
    });

    const sumReceivedEnd = await HistorialTransacciones.sum("monto", {
      where: {
        beneficiarioCuentaId: account.cuentaId,
        fecha: {
          [Op.lte]: endDate,
        },
      },
    });

    const endingBalance = account.balanceInicial + sumReceivedEnd - sumSpentEnd;

    // Add the transaction direction and balance fields
    transactions = transactions.map((transaction) => {
      const isOutgoing = transaction.cuentaId === account.cuentaId;
      return {
        ...transaction.get(),
        isOutgoing,
      };
    });

    let currentBalance = initialBalance;

    transactions = transactions.map((transaction, index) => {
      const lastTx = transactions[index];
      if (lastTx.isOutgoing) {
        currentBalance -= lastTx.monto;
      } else {
        currentBalance += lastTx.monto;
      }
      return {
        ...transaction,
        balance: currentBalance,
      };
    });

    const customerInfo = {
      fullName: `${req.user.nombre} ${req.user.apellido}`,
      address: req.user.direccion,
    };

    generateAccountStatementPDF({
      res,
      transactions,
      customerInfo,
      statementPeriod: `${month}/${year}`,
      initialBalance,
      endingBalance,
    });
  })
);

export default router;

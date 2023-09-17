import {
  getCuenta,
  getSession,
  getUser,
} from "../routes/usuarios/usuarios.services.js";
import { StatusCodes } from "http-status-codes";

export const autenticar = async (req, res, next) => {
  try {
    const accessToken = req.headers["authorization"].split("Bearer ")[1];
    const session = await getSession(accessToken);
    if (!session) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Sesion no encontrada" });
    }
    const user = await getUser(session.cedula);
    req.user = user;
    const cuenta = await getCuenta(session.cedula);
    req.account = cuenta;
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Credenciales invalidas" });
  }
};

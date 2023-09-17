import { StatusCodes } from "http-status-codes";

export const validarClaveEspecial = (req, res, next) => {
  const claveEspecial = req.body.claveEspecial;
  if (!claveEspecial) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Clave especial es requerida" });
  }
  if (req.account.claveEspecial != claveEspecial) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Clave especial es incorrecta" });
  }
  next();
};

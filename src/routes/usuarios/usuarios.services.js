import { Cuenta, Session, Usuario } from "../../database/config.js";

export const getSession = async (token) => {
  return await Session.findByPk(token);
};

export const getUser = async (cedula) => {
  const user = await Usuario.findByPk(cedula);
  return user;
};

export const getCuenta = async (cedula) => {
  const cuenta = await Cuenta.findOne({
    where: { cedula },
  });
  return cuenta;
};

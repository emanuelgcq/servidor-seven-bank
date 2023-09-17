import { Banco } from "../../database/config.js";
import { autenticar } from "../../middlewares/authentication.middleware.js";
import { asyncWrapper } from "../../utils/methodsWrapper.js";
import { Router } from "express";

const router = Router();

router.get(
  "/bancos",
  autenticar,
  asyncWrapper(async (req, res) => {
    let bancos = await Banco.findAll();
    bancos = bancos.filter((banco) => banco.bancoId != req.account.bancoId);
    res.json({ bancos });
  })
);

export default router;

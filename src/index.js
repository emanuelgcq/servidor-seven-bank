import express from "express";
import cors from "cors";
import { sequelize } from "./database/config.js";
import { seedDatabase } from "./database/seed.js";
import { StatusCodes } from "http-status-codes";
import usuariosRouter from "./routes/usuarios/usuarios.route.js";
import serviciosRouter from "./routes/servicios/servicios.route.js";
import transferenciasRouter from "./routes/transferencias/transferencias.route.js";
import tarjetasRouter from "./routes/tarjetas/tarjetas.route.js";
import bancosRouter from "./routes/bancos/bancos.route.js";

const app = express();
app.use(express.json());
app.use(cors());

app.use(usuariosRouter);
app.use(serviciosRouter);
app.use(transferenciasRouter);
app.use(tarjetasRouter);
app.use(bancosRouter);

app.use((err, req, res, next) => {
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: err.message,
  });
});

// Start the server
// TODO: remove force: true when we are ready to deploy
sequelize.sync({ force: true }).then(async () => {
  await seedDatabase();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});

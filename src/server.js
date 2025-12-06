const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');



const userRoutes = require('./routes/usuario');
const auth = require('./routes/auth');
const eventRoutes = require('./routes/eventos');
require('dotenv').config();
const { testConnection, pool } = require('./db');




const app = express();

// middlewares
app.use(cors());
app.use(express.json());

app.use('/usuarios', userRoutes);
app.use('/auth', auth);
app.use('/eventos', eventRoutes);

// rota de saúde / status
app.get('/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1');
    return res.json({
      status: 'ok',
      db: 'ok',
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      db: 'error',
      message: err.message,
    });
  }
});

// (exemplo) rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'API Koinonia rodando 🚀' });
});

const PORT = process.env.PORT || 3333;

app.listen(PORT, async () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
  await testConnection();
});

// src/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  console.log(req.body);

  if (!email || !senha) {
    return res.status(400).json({
      error: 'email e senha são obrigatórios',
    });
  }

  try {
    // busca usuário pelo e-mail
    const result = await pool.query(
      'SELECT id, nome, email, senha, tipo FROM usuarios WHERE email = $1',
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: 'E-mail ou senha inválidos',
      });
    }

    const user = result.rows[0];

    // confere senha
    const senhaConfere = await bcrypt.compare(senha, user.senha);

    console.log

    if (!senhaConfere) {
      return res.status(401).json({
        error: 'E-mail ou senha inválidos',
      });
    }

    // monta payload do token
    const payload = {
      id: user.id,
      email: user.email,
      tipo: user.tipo,
      nome: user.nome,
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    // devolve usuário (sem senha) + token
    return res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        tipo: user.tipo,
      },
    });
  } catch (err) {
    console.error('[POST /auth/login] erro:', err);
    return res.status(500).json({
      error: 'Erro ao autenticar usuário',
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  // Como JWT é stateless, aqui normalmente não tem muito o que fazer
  // No app, você vai apagar o token do armazenamento local.
  // Se um dia quiser, aqui dá pra adicionar o token a uma blacklist.

  return res.status(200).json({
    message: 'Logout realizado com sucesso',
  });
});

module.exports = router;

// src/routes/userRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

// POST /usuarios  -> cadastro de usuário
router.post('/', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;

  console.log(req.body);

  if (!nome || !email || !senha) {
    return res.status(400).json({
      error: 'nome, email e senha são obrigatórios',
    });
  }

  try {
    // verifica se já existe usuário com esse e-mail
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email],
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: 'E-mail já está em uso',
      });
    }

    // gera hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // insere usuário
    const result = await pool.query(
      `
      INSERT INTO usuarios (nome, email, senha, tipo)
      VALUES ($1, $2, $3, COALESCE($4, 'membro'))
      RETURNING id, nome, email, tipo, criado_em
      `,
      [nome, email, senhaHash, tipo],
    );

    const user = result.rows[0];

    return res.status(201).json(user);
  } catch (err) {
    console.error('[POST /usuarios] erro:', err);
    return res.status(500).json({
      error: 'Erro ao cadastrar usuário',
    });
  }
});

module.exports = router;

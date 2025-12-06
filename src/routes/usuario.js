// src/routes/usuariosRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

/**
 * ROTA EXISTENTE -> criar usuário
 */
router.post('/', async (req, res) => {
  const { nome, email, senha, tipo } = req.body;

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

    const senhaHash = await bcrypt.hash(senha, 10);

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
      error: 'Erro ao criar usuário',
    });
  }
});

/* ------------------------------------------------------------------ */
/* Helpers só para este arquivo (se já tiver em outro lugar, pode reutilizar)
/* ------------------------------------------------------------------ */

// Formata Date/Timestamp em "DD/MM/YYYY"
function formatDateBR(date) {
  if (!date) return null;
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formata preço a partir de centavos ou "Gratuito"
function formatPrice(precoCentavos, gratuito) {
  if (gratuito) return 'Gratuito';

  const valor = (precoCentavos || 0) / 100;
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/* ------------------------------------------------------------------ */
/* NOVA ROTA: listar eventos em que o usuário está inscrito           */
/* GET /usuarios/:id/eventos-inscritos                                */
/* ------------------------------------------------------------------ */

router.get('/:id/eventos-inscritos', async (req, res) => {
  const { id } = req.params; // id do usuário

  try {
    const result = await pool.query(
      `
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.atracoes,
        e.local,
        e.data_evento,
        e.preco_centavos,
        e.gratuito,
        e.imagem_url,
        COUNT(ue.id) AS inscritos
      FROM usuario_eventos ue
      JOIN eventos e ON e.id = ue.evento_id
      WHERE ue.usuario_id = $1
      GROUP BY
        e.id,
        e.titulo,
        e.descricao,
        e.atracoes,
        e.local,
        e.data_evento,
        e.preco_centavos,
        e.gratuito,
        e.imagem_url
      ORDER BY e.data_evento ASC
      `,
      [id],
    );

    const eventos = result.rows.map((row) => ({
      id: row.id,
      title: row.titulo,
      description: row.descricao,
      attractions: row.atracoes,
      location: row.local,
      date: formatDateBR(row.data_evento),
      price: formatPrice(row.preco_centavos, row.gratuito),
      imageUrl: row.imagem_url,
      subscribersCount: Number(row.inscritos) || 0,
    }));

    return res.json(eventos);
  } catch (err) {
    console.error('[GET /usuarios/:id/eventos-inscritos] erro:', err);
    return res.status(500).json({
      error: 'Erro ao buscar eventos do usuário',
    });
  }
});

module.exports = router;

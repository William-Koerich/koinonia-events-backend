// src/routes/eventRoutes.js
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// helper pra converter "18/03/2025" em Date
function parseDate(dateStr) {
  if (!dateStr) return null;

  // formato BR: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [dia, mes, ano] = dateStr.split('/');
    return new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

// helper pra formatar date_evento -> "DD/MM/YYYY"
function formatDateBR(dateValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// helper pra formatar preço a partir de centavos
function formatPrice(precoCentavos, gratuito) {
  if (gratuito) return 'Gratuito';
  const valor = (precoCentavos || 0) / 100;
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// ---------- POST /eventos (criar evento) ----------
router.post('/', async (req, res) => {
  const {
    title,
    date,          // "18/03/2025"
    location,
    price,
    imageUrl,
    description,
    attractions,
    criadoPorId,
  } = req.body;

  if (!title || !date || !location) {
    return res.status(400).json({
      error: 'title, date e location são obrigatórios',
    });
  }

  const dataEvento = parseDate(date);
  if (!dataEvento) {
    return res.status(400).json({
      error: 'Formato de data inválido. Use "DD/MM/YYYY" ou ISO.',
    });
  }

  let precoCentavos = 0;
  let gratuito = false;

  if (!price || String(price).toLowerCase().includes('grat')) {
    precoCentavos = 0;
    gratuito = true;
  } else {
    const numeric = String(price)
      .replace(/[^\d,]/g, '')
      .replace('.', '')
      .replace(',', '.');

    const valor = parseFloat(numeric);
    if (!isNaN(valor)) {
      precoCentavos = Math.round(valor * 100);
      gratuito = precoCentavos === 0;
    }
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO eventos (
        titulo,
        descricao,
        atracoes,
        local,
        data_evento,
        preco_centavos,
        gratuito,
        imagem_url,
        criado_por_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        titulo,
        descricao,
        atracoes,
        local,
        data_evento,
        preco_centavos,
        gratuito,
        imagem_url,
        criado_por_id,
        criado_em
      `,
      [
        title,
        description || null,
        attractions || null,
        location,
        dataEvento,
        precoCentavos,
        gratuito,
        imageUrl || null,
        criadoPorId || null,
      ],
    );

    const event = result.rows[0];

    // já responde no formato que o app gosta
    return res.status(201).json({
      id: event.id,
      title: event.titulo,
      description: event.descricao,
      attractions: event.atracoes,
      location: event.local,
      date: formatDateBR(event.data_evento),
      price: formatPrice(event.preco_centavos, event.gratuito),
      imageUrl: event.imagem_url,
      subscribersCount: 0,
    });
  } catch (err) {
    console.error('[POST /eventos] erro:', err);
    return res.status(500).json({
      error: 'Erro ao criar evento',
    });
  }
});

// ---------- GET /eventos (listar todos) ----------
router.get('/', async (req, res) => {
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
        COALESCE(COUNT(ue.id) FILTER (WHERE ue.status = 'inscrito'), 0) AS subscribers_count
      FROM eventos e
      LEFT JOIN usuario_eventos ue
        ON ue.evento_id = e.id
      GROUP BY e.id
      ORDER BY e.data_evento ASC, e.id ASC
      `,
    );

    const events = result.rows.map((row) => ({
      id: row.id,
      title: row.titulo,
      description: row.descricao,
      attractions: row.atracoes,
      location: row.local,
      date: formatDateBR(row.data_evento),
      price: formatPrice(row.preco_centavos, row.gratuito),
      imageUrl: row.imagem_url,
      subscribersCount: Number(row.subscribers_count) || 0,
    }));

    return res.json(events);
  } catch (err) {
    console.error('[GET /eventos] erro:', err);
    return res.status(500).json({
      error: 'Erro ao buscar eventos',
    });
  }
});

// ---------- GET /eventos/:id (detalhe) ----------
router.get('/:id', async (req, res) => {
  const { id } = req.params;

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
        COALESCE(COUNT(ue.id) FILTER (WHERE ue.status = 'inscrito'), 0) AS subscribers_count
      FROM eventos e
      LEFT JOIN usuario_eventos ue
        ON ue.evento_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
      `,
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    const row = result.rows[0];

    const event = {
      id: row.id,
      title: row.titulo,
      description: row.descricao,
      attractions: row.atracoes,
      location: row.local,
      date: formatDateBR(row.data_evento),
      price: formatPrice(row.preco_centavos, row.gratuito),
      imageUrl: row.imagem_url,
      subscribersCount: Number(row.subscribers_count) || 0,
    };

    return res.json(event);
  } catch (err) {
    console.error('[GET /eventos/:id] erro:', err);
    return res.status(500).json({
      error: 'Erro ao buscar evento',
    });
  }
});

// POST /eventos/:id/inscricoes
// Vincula participantes (usuario + familiares) ao evento
router.post('/:id/inscricoes', async (req, res) => {
  const { id: eventoId } = req.params;
  const { usuarioId, participantes } = req.body;

  if (!usuarioId || !Array.isArray(participantes) || participantes.length === 0) {
    return res.status(400).json({
      error: 'usuarioId e pelo menos um participante são obrigatórios',
    });
  }

  // validações simples dos participantes
  const invalid = participantes.some(
    (p) => !p || typeof p.nome !== 'string' || p.nome.trim() === '',
  );
  if (invalid) {
    return res.status(400).json({
      error: 'Todos os participantes devem ter o campo nome preenchido',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // verifica se evento existe
    const eventoResult = await client.query(
      'SELECT id FROM eventos WHERE id = $1',
      [eventoId],
    );
    if (eventoResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    // opcional: verifica se usuário existe
    const usuarioResult = await client.query(
      'SELECT id FROM usuarios WHERE id = $1',
      [usuarioId],
    );
    if (usuarioResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // regra: antes de inserir, remove inscrições anteriores desse usuário nesse evento
    await client.query(
      `
      DELETE FROM usuario_eventos
      WHERE usuario_id = $1 AND evento_id = $2
      `,
      [usuarioId, eventoId],
    );

    // monta INSERT multi-linha
    const values = [];
    const params = [usuarioId, eventoId];
    let idx = 3; // já usei $1 e $2 acima

    participantes.forEach((p) => {
      values.push(`($1, $2, $${idx}, $${idx + 1}, 'inscrito')`);
      params.push(p.nome, p.idade || null);
      idx += 2;
    });

    const insertQuery = `
      INSERT INTO usuario_eventos (
        usuario_id,
        evento_id,
        participante_nome,
        participante_idade,
        status
      )
      VALUES ${values.join(', ')}
      RETURNING
        id,
        participante_nome,
        participante_idade,
        status,
        criado_em
    `;

    const insertResult = await client.query(insertQuery, params);

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Inscrição realizada com sucesso',
      eventoId: Number(eventoId),
      usuarioId,
      participantes: insertResult.rows.map((row) => ({
        id: row.id,
        nome: row.participante_nome,
        idade: row.participante_idade,
        status: row.status,
        criadoEm: row.criado_em,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /eventos/:id/inscricoes] erro:', err);
    return res.status(500).json({
      error: 'Erro ao registrar inscrições no evento',
    });
  } finally {
    client.release();
  }
});

module.exports = router;

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
        COALESCE(
          COUNT(ue.id) FILTER (WHERE ue.status = 'inscrito'),
          0
        ) AS subscribers_count
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
        COALESCE(
            COUNT(ue.id) FILTER (WHERE ue.status = 'inscrito'),
            0
        ) AS subscribers_count
        FROM eventos e
        LEFT JOIN usuario_eventos ue
        ON ue.evento_id = e.id
        GROUP BY e.id
        ORDER BY e.data_evento ASC, e.id ASC;
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

/* ------------------------------------------------------------------ */
/* POST /eventos/:id/inscricoes  -> ADICIONAR NOVOS PARTICIPANTES     */
/* NÃO apaga os antigos; só insere quem ainda não existe              */
/* body: { usuarioId, participantes: [{ nome, idade }] }              */
/* ------------------------------------------------------------------ */
router.post('/:id/inscricoes', async (req, res) => {
  const eventoId = Number(req.params.id);
  const { usuarioId, participantes } = req.body;

  if (!eventoId || Number.isNaN(eventoId)) {
    return res.status(400).json({ error: 'ID do evento inválido' });
  }

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

    // verifica se usuário existe
    const usuarioResult = await client.query(
      'SELECT id FROM usuarios WHERE id = $1',
      [usuarioId],
    );
    if (usuarioResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // busca participantes já inscritos desse usuário nesse evento
    const existentesResult = await client.query(
      `
      SELECT participante_nome, participante_idade
      FROM usuario_eventos
      WHERE usuario_id = $1
        AND evento_id  = $2
        AND status     = 'inscrito'
      `,
      [usuarioId, eventoId],
    );

    const existentesSet = new Set(
      existentesResult.rows.map((row) => {
        const nome = row.participante_nome?.trim().toLowerCase() || '';
        const idade = row.participante_idade ?? '';
        return `${nome}|${idade}`;
      }),
    );

    // filtra apenas novos (nome+idade ainda não existentes)
    const novosParticipantes = participantes.filter((p) => {
      const nome = p.nome.trim().toLowerCase();
      const idade = p.idade ?? '';
      const key = `${nome}|${idade}`;
      if (existentesSet.has(key)) return false;
      existentesSet.add(key);
      return true;
    });

    if (novosParticipantes.length === 0) {
      await client.query('COMMIT');
      return res.status(200).json({
        message: 'Nenhum novo participante para adicionar',
      });
    }

    // monta INSERT multi-linha só com os novos
    const params = [usuarioId, eventoId];
    const values = [];
    let idx = 3;

    novosParticipantes.forEach((p) => {
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
      message: 'Participantes adicionados com sucesso',
      eventoId,
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

/* ------------------------------------------------------------------ */
/* GET /eventos/:id/inscricoes/:usuarioId                             */
/* devolve os participantes INSCRITOS daquele usuário nesse evento    */
/* ------------------------------------------------------------------ */
router.get('/:id/inscricoes/:usuarioId', async (req, res) => {
  const eventoId  = Number(req.params.id);
  const usuarioId = Number(req.params.usuarioId);

  if (!eventoId || Number.isNaN(eventoId)) {
    return res.status(400).json({ error: 'ID do evento inválido' });
  }
  if (!usuarioId || Number.isNaN(usuarioId)) {
    return res.status(400).json({ error: 'ID do usuário inválido' });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        participante_nome,
        participante_idade
      FROM usuario_eventos
      WHERE evento_id = $1
        AND usuario_id = $2
        AND status     = 'inscrito'
      ORDER BY id ASC
      `,
      [eventoId, usuarioId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Inscrição não encontrada para este usuário neste evento',
      });
    }

    const participantes = result.rows.map((row) => ({
      id: row.id,
      nome: row.participante_nome,
      idade: row.participante_idade,
    }));

    return res.json({
      usuarioId,
      eventoId,
      participantes,
    });
  } catch (err) {
    console.error('[GET /eventos/:id/inscricoes/:usuarioId] erro:', err);
    return res.status(500).json({
      error: 'Erro ao buscar inscrição',
    });
  }
});

/* ------------------------------------------------------------------ */
/* DELETE /eventos/:id/inscricoes/:usuarioId -> cancelar inscrição    */
/* marca status = 'cancelado' para TODOS participantes desse usuário  */
/* ------------------------------------------------------------------ */
router.delete('/:id/inscricoes/:usuarioId', async (req, res) => {
  const eventoId  = Number(req.params.id);
  const usuarioId = Number(req.params.usuarioId);

  if (!eventoId || Number.isNaN(eventoId)) {
    return res.status(400).json({ error: 'ID do evento inválido' });
  }
  if (!usuarioId || Number.isNaN(usuarioId)) {
    return res.status(400).json({ error: 'ID do usuário inválido' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE usuario_eventos
      SET status = 'cancelado'
      WHERE evento_id = $1
        AND usuario_id = $2
        AND status     = 'inscrito'
      `,
      [eventoId, usuarioId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Nenhuma inscrição ativa encontrada para este usuário',
      });
    }

    return res.json({ message: 'Inscrição cancelada com sucesso' });
  } catch (err) {
    console.error('[DELETE /eventos/:id/inscricoes/:usuarioId] erro:', err);
    return res.status(500).json({
      error: 'Erro ao cancelar inscrição',
    });
  }
});

module.exports = router;

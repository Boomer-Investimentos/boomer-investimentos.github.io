require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');

const app = express();

const ALLOWED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Tipo de arquivo não permitido'), { code: 'INVALID_TYPE' }));
    }
  },
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['POST'],
}));

app.post('/api/send-form', upload.single('documento'), async (req, res) => {
  const { nome, celular, email, cpf, documento_tipo, banco, endereco, cartoes, rendas, custos_fixos } = req.body;

  const fd = new FormData();
  fd.append('nome', nome || '');
  fd.append('celular', celular || '');
  fd.append('email', email || '');
  fd.append('cpf', cpf || '');
  fd.append('documento_tipo', documento_tipo || '');
  fd.append('banco', banco || '');
  fd.append('endereco', endereco || '{}');
  fd.append('cartoes', cartoes || '[]');
  fd.append('rendas', rendas || '[]');
  fd.append('custos_fixos', custos_fixos || '[]');

  if (req.file) {
    fd.append('documento', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
  }

  try {
    await axios.post(process.env.ZAPIER_WEBHOOK_URL, fd, {
      headers: fd.getHeaders(),
      timeout: 15000,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Zapier error:', err.response?.data || err.message);
    res.status(502).json({ error: 'Erro ao encaminhar o formulário. Tente novamente.' });
  }
});

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo excede o limite de 10 MB.' });
  }
  if (err.code === 'INVALID_TYPE') {
    return res.status(415).json({ error: 'Tipo de arquivo não permitido. Use PDF, JPG ou PNG.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

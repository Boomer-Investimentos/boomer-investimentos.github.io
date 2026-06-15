require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const { google } = require('googleapis');

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

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.replace(/^['"]|['"]$/g, '');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function uploadToDrive(nome, file) {
  const drive = getDriveClient();
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const folderRes = await drive.files.create({
    requestBody: {
      name: nome,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    supportsAllDrives: true,
    fields: 'id',
  });
  const folderId = folderRes.data.id;

  const { Readable } = require('stream');
  const fileRes = await drive.files.create({
    requestBody: {
      name: file.originalname,
      parents: [folderId],
    },
    media: {
      mimeType: file.mimetype,
      body: Readable.from(file.buffer),
    },
    supportsAllDrives: true,
    fields: 'id, webViewLink',
  });

  return fileRes.data.webViewLink;
}

app.post('/api/send-form', upload.single('documento'), async (req, res) => {
  const { nome, celular, email, cpf, documento_tipo, banco, endereco, cartoes, rendas, custos_fixos } = req.body;

  let documentoLink = null;
  if (req.file) {
    try {
      documentoLink = await uploadToDrive(nome, req.file);
    } catch (err) {
      console.error('Google Drive error:', err.message);
      return res.status(502).json({ error: 'Erro ao fazer upload do documento. Tente novamente.' });
    }
  }

  try {
    await axios.post(process.env.ZAPIER_WEBHOOK_URL, {
      nome,
      celular,
      email,
      cpf,
      documento_tipo,
      banco,
      endereco: endereco ? JSON.parse(endereco) : {},
      cartoes: cartoes ? JSON.parse(cartoes) : [],
      rendas: rendas ? JSON.parse(rendas) : [],
      custos_fixos: custos_fixos ? JSON.parse(custos_fixos) : [],
      documento_link: documentoLink,
    }, {
      headers: { 'Content-Type': 'application/json' },
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

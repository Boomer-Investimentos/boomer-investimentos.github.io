const multer = require('multer');
const { google } = require('googleapis');
const axios = require('axios');
const cors = require('cors');
const { Readable } = require('stream');

const ALLOWED_MIMETYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Tipo de arquivo não permitido'), { code: 'INVALID_TYPE' }));
    }
  },
});

const corsMiddleware = cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['POST', 'OPTIONS'],
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

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

  const fileRes = await drive.files.create({
    requestBody: {
      name: file.originalname,
      parents: [folderRes.data.id],
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

module.exports = async (req, res) => {
  await runMiddleware(req, res, corsMiddleware);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await runMiddleware(req, res, upload.single('documento'));
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Arquivo excede o limite de 4 MB.' });
    }
    if (err.code === 'INVALID_TYPE') {
      return res.status(415).json({ error: 'Tipo de arquivo não permitido. Use PDF, JPG ou PNG.' });
    }
    return res.status(500).json({ error: 'Erro no upload do arquivo.' });
  }

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
};

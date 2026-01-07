const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../uploads');
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/transcribe', upload.single('audio'), async (req, res) => {
  console.log("-----------------------------------------");
  console.log(`[RECORDER] Request received at ${new Date().toISOString()}`);

  if (!req.file) {
    console.error('[RECORDER] No file in request!');
    return res.status(400).json({ error: 'No audio file provided' });
  }

  console.log(`[RECORDER] Received file: ${req.file.originalname}`);
  console.log(`[RECORDER] MIME Type: ${req.file.mimetype}`);
  console.log(`[RECORDER] File Size: ${(req.file.size / 1024).toFixed(2)} KB`);

  // Validate audio format by MIME type and file extension
  const validMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-wav', 'audio/x-m4b', 'video/webm', 'application/octet-stream'];
  const validExtensions = ['.mp3', '.wav', '.ogg', '.mp4', '.webm', '.m4a', '.aac', '.flac', '.wma', '.m4b'];

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const isValidFormat = validMimeTypes.includes(req.file.mimetype) || validExtensions.includes(fileExtension) || req.file.mimetype.includes('audio') || req.file.mimetype.includes('video');

  if (!isValidFormat) {
    console.warn(`[RECORDER] Invalid format blocked: ${req.file.mimetype}`);
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: `Unsupported audio format: ${req.file.mimetype}` });
  }

  const audioPath = req.file.path;
  const whisperScriptPath = path.join(__dirname, '../whisper/transcribe.py');

  try {
    console.log(`[RECORDER] Forwarding to Python Whisper Service...`);
    const startTime = Date.now();
    const transcribedText = await runWhisper(whisperScriptPath, audioPath);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[RECORDER] Transcription success in ${duration}s: "${transcribedText}"`);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

    res.json({ text: transcribedText });
  } catch (error) {
    console.error('[RECORDER] Pipeline Error:', error.message);
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
  console.log("-----------------------------------------");
});

const axios = require('axios');
const formData = require('form-data');

// ...

async function runWhisper(scriptPath, audioPath) {
  try {
    const form = new formData();
    form.append('file', fs.createReadStream(audioPath));

    const response = await axios.post('http://localhost:8000/transcribe', form, {
      headers: {
        ...form.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    if (response.data && response.data.text) {
      return response.data.text;
    } else {
      throw new Error('No text returned from Python service');
    }
  } catch (error) {
    console.error('Python Service Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      throw new Error(`Python service failed: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error('Python service not reachable (is it running?)');
    }
    throw error;
  }
}

module.exports = router;

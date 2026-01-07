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
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  // Validate audio format by MIME type and file extension
  const validMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-wav', 'audio/x-m4b'];
  const validExtensions = ['.mp3', '.wav', '.ogg', '.mp4', '.webm', '.m4a', '.aac', '.flac', '.wma', '.m4b'];
  
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const isValidFormat = validMimeTypes.includes(req.file.mimetype) || validExtensions.includes(fileExtension);
  
  if (!isValidFormat) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: `Unsupported audio format: ${req.file.mimetype || fileExtension}` });
  }

  const audioPath = req.file.path;
  const whisperScriptPath = path.join(__dirname, '../whisper/transcribe.py');

  console.log(`[TRANSCRIBE] Processing file: ${req.file.originalname} (${req.file.size} bytes)`);

  try {
    const transcribedText = await runWhisper(whisperScriptPath, audioPath);

    console.log(`[TRANSCRIBE] Success: "${transcribedText}"`);
    fs.unlinkSync(audioPath);

    res.json({ text: transcribedText });
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error.message);
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});

function runWhisper(scriptPath, audioPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('C:\\Python314\\python.exe', [scriptPath, audioPath], {
      timeout: 120000  // 2 minute timeout
    });
    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('[PYTHON STDERR]', data.toString());
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${errorOutput}`));
      } else {
        resolve(output.trim());
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

module.exports = router;

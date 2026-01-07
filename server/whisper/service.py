import sys
import os
import traceback
import tempfile
import subprocess
from typing import Optional

# 3rd party
print("DEBUG: Importing static_ffmpeg...", file=sys.stderr)
import static_ffmpeg
print("DEBUG: Importing FastAPI...", file=sys.stderr)
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
print("DEBUG: Importing whisper...", file=sys.stderr)
import whisper
print("DEBUG: Imports done.", file=sys.stderr)

# -- Setup --
print("DEBUG: Service starting...", file=sys.stderr)
static_ffmpeg.add_paths()
os.environ['PYTHONWARNINGS'] = 'ignore'

app = FastAPI()

# Add CORS to allow requests from Node server or even direct client (though we proxy)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variable
model = None

# -- Lifecycle (Startup) --
@app.on_event("startup")
async def startup_event():
    global model
    print("DEBUG: Loading Whisper model...", file=sys.stderr)
    try:
        # Load the base model. This takes time but only happens once!
        model = whisper.load_model("base")
        print("DEBUG: Whisper model loaded successfully", file=sys.stderr)
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to load model: {e}", file=sys.stderr)
        sys.exit(1)

# -- Helpers --
def convert_to_wav(input_path):
    """Convert any audio format to WAV using ffmpeg"""
    try:
        # Create a temp file for output
        output_temp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        output_path = output_temp.name
        output_temp.close()

        subprocess.run([
            'ffmpeg', '-i', input_path,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-y', '-loglevel', 'error',
            output_path
        ], capture_output=True, check=True, timeout=60)
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path
        else:
            raise Exception("Conversion produced empty file")
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode() if e.stderr else "No error output"
        print(f"ERROR: FFmpeg failed with exit code {e.returncode}: {stderr}", file=sys.stderr)
        raise Exception(f"FFmpeg conversion failed: {stderr}")
    except Exception as e:
        print(f"ERROR: Unexpected error in convert_to_wav: {e}", file=sys.stderr)
        raise e

# -- Endpoints --
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=500, detail="Model not loaded")

    # Save uploaded file to temp
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp_input:
        content = await file.read()
        tmp_input.write(content)
        tmp_input_path = tmp_input.name

    wav_path = None
    try:
        # Convert to WAV
        wav_path = convert_to_wav(tmp_input_path)
        
        # Transcribe
        result = model.transcribe(wav_path, language="en", verbose=False)
        transcribed_text = result.get("text", "").strip()
        
        print(f"DEBUG: Transcribed: '{transcribed_text}'")
        return {"text": transcribed_text}

    except Exception as e:
        print(f"ERROR: Transcription failed: {e}", file=sys.stderr)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup
        if os.path.exists(tmp_input_path):
            os.unlink(tmp_input_path)
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model is not None}

if __name__ == "__main__":
    import uvicorn
    # Run slightly different port to avoid conflict if any
    uvicorn.run(app, host="0.0.0.0", port=8000)

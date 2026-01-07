import sys
print("DEBUG: transcribe.py started", file=sys.stderr)
import warnings
import static_ffmpeg
static_ffmpeg.add_paths()

warnings.filterwarnings('ignore')

try:
    import whisper
except ImportError:
    print("Error: whisper not installed. Run: pip install openai-whisper")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Error: Audio file path required")
    sys.exit(1)

audio_path = sys.argv[1]

import traceback
import os
import subprocess
import tempfile

os.environ['PYTHONWARNINGS'] = 'ignore'

# Check input file
if not os.path.exists(audio_path):
    print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
    sys.exit(1)

input_size = os.path.getsize(audio_path)
print(f"DEBUG: Input file: {audio_path} ({input_size} bytes)", file=sys.stderr)

if input_size < 1000:
    print(f"ERROR: Audio file too small ({input_size} bytes)", file=sys.stderr)
    sys.exit(1)

def convert_to_wav(input_path):
    """Convert any audio format to WAV"""
    try:
        output_path = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        subprocess.run([
            'ffmpeg', '-i', input_path,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-y', '-loglevel', 'error',
            output_path
        ], capture_output=True, check=True, timeout=60)
        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            output_size = os.path.getsize(output_path)
            print(f"DEBUG: Converted {input_size} → {output_size} bytes", file=sys.stderr)
            return output_path
        else:
            print(f"ERROR: Conversion produced invalid file", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: FFmpeg failed: {e}", file=sys.stderr)
        sys.exit(1)

try:
    wav_path = convert_to_wav(audio_path)
    print(f"DEBUG: Processing: {wav_path}", file=sys.stderr)
    
    model = whisper.load_model("base")
    print(f"DEBUG: Model loaded", file=sys.stderr)
    
    result = model.transcribe(wav_path, language="en", verbose=False)
    
    transcribed_text = result.get("text", "").strip()
    print(f"DEBUG: Transcription: '{transcribed_text}'", file=sys.stderr)
    
    if transcribed_text:
        sys.stdout.write(transcribed_text)
    
    sys.stdout.flush()
    
    if wav_path != audio_path and os.path.exists(wav_path):
        try:
            os.unlink(wav_path)
        except:
            pass
    
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)

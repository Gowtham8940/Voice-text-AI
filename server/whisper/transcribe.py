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

def convert_to_wav(input_path):
    """Convert audio to WAV with volume normalization"""
    try:
        output_path = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
        result = subprocess.run([
            'ffmpeg', '-i', input_path,
            '-acodec', 'pcm_s16le',
            '-ar', '16000',
            '-ac', '1',
            '-af', 'volume=3.0,highpass=f=80,lowpass=f=8000',
            '-y', '-loglevel', 'info', # Changed to info for more detail
            output_path
        ], capture_output=True, check=False, timeout=60) # check=False to handle error manually

        if result.returncode != 0:
             print(f"Warning: FFmpeg failed with code {result.returncode}", file=sys.stderr)
             print(f"FFmpeg stderr: {result.stderr.decode('utf-8', errors='ignore')}", file=sys.stderr)

        
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"DEBUG: Successfully converted to WAV: {os.path.getsize(output_path)} bytes", file=sys.stderr)
            return output_path
        else:
            print(f"Warning: WAV conversion produced invalid file", file=sys.stderr)
            return input_path
    except subprocess.TimeoutExpired:
        print("Warning: FFmpeg conversion timed out", file=sys.stderr)
        return input_path
    except Exception as e:
        print(f"Warning: FFmpeg conversion failed: {e}", file=sys.stderr)
        return input_path

try:
    wav_path = convert_to_wav(audio_path)
    print(f"DEBUG: Processing audio file: {wav_path}", file=sys.stderr)
    
    # Try tiny model first (faster)
    model = whisper.load_model("tiny")
    print(f"DEBUG: Model loaded: tiny", file=sys.stderr)
    
    result = model.transcribe(
        wav_path,
        fp16=False,
        language="en",  # Specify English to help detection
        verbose=False,
        temperature=0.0,
        compression_ratio_threshold=2.4,
        logprob_threshold=-1.0,
        no_speech_threshold=0.05,  # Even more lenient
        beam_size=5,
        best_of=5
    )
    
    transcribed_text = result.get("text", "").strip()
    print(f"DEBUG: Tiny model result: '{transcribed_text}'", file=sys.stderr)
    
    # Fallback to base model if tiny produced no/minimal results
    if len(transcribed_text) < 3:
        print(f"DEBUG: Tiny result too short, trying base model", file=sys.stderr)
        model = whisper.load_model("base")
        result = model.transcribe(
            wav_path,
            fp16=False,
            language="en",
            verbose=False,
            temperature=0.0,
            compression_ratio_threshold=2.4,
            logprob_threshold=-1.0,
            no_speech_threshold=0.05,
            beam_size=5,
            best_of=5
        )
        transcribed_text = result.get("text", "").strip()
        print(f"DEBUG: Base model result: '{transcribed_text}'", file=sys.stderr)
    
    print(f"DEBUG: Final transcription result: {result}", file=sys.stderr)
    
    if not transcribed_text:
        print("DEBUG: No text detected", file=sys.stderr)
        print("", end='')
    else:
        sys.stdout.write(transcribed_text + '\n')
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

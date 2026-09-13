"""
CINEM PRO — local STT bridge.
Transcribes an audio file with Faster-Whisper and prints {"text": "..."} on the
last stdout line (consumed by the Rust `transcribe_audio` command).

Install once:  pip install faster-whisper
"""
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="CINEM PRO Faster-Whisper STT")
    parser.add_argument("audio", help="path to audio file (webm/wav/mp3)")
    parser.add_argument("--model", default="base", help="tiny|base|small|medium|large-v3")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper not installed. Run: pip install faster-whisper", file=sys.stderr)
        return 1

    # int8 keeps it fast on CPU; switch to "float16" + device="cuda" for GPU.
    model = WhisperModel(args.model, device="auto", compute_type="int8")
    segments, _info = model.transcribe(args.audio, vad_filter=True)
    text = " ".join(seg.text.strip() for seg in segments).strip()

    print(json.dumps({"text": text}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

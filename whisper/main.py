import os
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "1"))

app = FastAPI(title="Local Whisper STT")


@lru_cache(maxsize=1)
def get_model() -> WhisperModel:
    return WhisperModel(
        MODEL_NAME,
        device="cpu",
        compute_type=COMPUTE_TYPE,
        cpu_threads=CPU_THREADS,
        num_workers=1,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, object]:
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file is too large")

    try:
        model = get_model()
        segments, info = model.transcribe(
            data,
            language=None,
            beam_size=1,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        text = " ".join(
            segment.text.strip()
            for segment in segments
            if segment.text.strip()
        ).strip()

        if not text:
            raise HTTPException(
                status_code=422,
                detail="Whisper returned an empty transcript",
            )

        return {
            "text": text,
            "language": info.language,
            "duration": info.duration,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Whisper transcription failed: {exc}",
        ) from exc

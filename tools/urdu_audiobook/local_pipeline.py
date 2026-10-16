#!/usr/bin/env python3
"""Open-weight Urdu translation + TTS pipeline for Google Colab.

Translation: Qwen3-4B, loaded in 4-bit mode for modest Colab GPUs.
Speech: OmniVoice Urdu fine-tune, generated sentence by sentence.
Run translation and audio as separate commands so the two models do not
compete for the same GPU memory.
"""
import argparse
import gc
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

TRANSLATION_MODEL = "Qwen/Qwen3-4B"
TTS_MODEL = "mlwithabdullah/omnivoice-urdu-12000"


def split_sentences(text):
    text = re.sub(r"\s+", " ", text).strip()
    return [s.strip() for s in re.findall(r".+?(?:[.!?؟۔]+(?=\s|$)|$)", text) if s.strip()] or ([text] if text else [])


def read_source(path):
    sections, heading, paragraphs = [], Path(path).stem, []

    def flush():
        nonlocal paragraphs
        if paragraphs:
            sections.append({
                "heading_source": heading,
                "paragraphs": [
                    {"source_text": p, "sentences": split_sentences(p)}
                    for p in paragraphs
                ],
            })
            paragraphs = []

    in_code_fence = False
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_code_fence = not in_code_fence
            continue
        if in_code_fence:
            continue
        if not line:
            flush()
        elif line.startswith("#"):
            flush()
            heading = line.lstrip("#").strip() or heading
        else:
            paragraphs.append(line)
    flush()
    return sections


def load_translation_model():
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    quant = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.float16,
    )
    tokenizer = AutoTokenizer.from_pretrained(TRANSLATION_MODEL)
    model = AutoModelForCausalLM.from_pretrained(
        TRANSLATION_MODEL,
        quantization_config=quant,
        device_map="auto",
        torch_dtype=torch.float16,
    )
    return tokenizer, model


def translate_batch(tokenizer, model, sentences):
    import torch

    system = (
        "You are a careful literary translator producing an Urdu edition of a "
        "religious and educational book. Translate every supplied English sentence "
        "into fluent, formal, natural Urdu in Urdu script. Preserve meaning, sentence "
        "order, names, honorifics, dates, quotations, Qur'an and hadith references, "
        "and distinctions between concepts. Do not summarize, explain, add claims, "
        "or omit content. For specialized Islamic terms, use established Urdu usage; "
        "retain the Arabic term where translating it could change its meaning. "
        "Return ONLY valid JSON with the key translations containing exactly one "
        "Urdu string for each input sentence, in the same order."
    )
    user = json.dumps({"sentences": sentences}, ensure_ascii=False)
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True, enable_thinking=False
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.inference_mode():
        output = model.generate(
            **inputs, max_new_tokens=max(384, min(2048, 160 * len(sentences))),
            do_sample=False, repetition_penalty=1.03,
        )
    generated = output[0][inputs["input_ids"].shape[1]:]
    answer = tokenizer.decode(generated, skip_special_tokens=True).strip()
    # Recover the JSON object if a model wraps it in incidental text.
    start, end = answer.find("{"), answer.rfind("}")
    if start >= 0 and end > start:
        answer = answer[start:end + 1]
    try:
        translations = json.loads(answer).get("translations")
    except (json.JSONDecodeError, AttributeError) as exc:
        raise ValueError("Qwen did not return valid translation JSON. Retry with a smaller batch.") from exc
    if not isinstance(translations, list) or len(translations) != len(sentences):
        raise ValueError("Translation count mismatch; refusing to silently misalign source and Urdu.")
    if not all(isinstance(t, str) and t.strip() for t in translations):
        raise ValueError("Translation output contains an empty or invalid item.")
    return [t.strip() for t in translations]


def translate(args):
    import torch

    source_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    sections = read_source(source_path)
    tokenizer, model = load_translation_model()
    aligned, serial = [], 0

    for section_index, section in enumerate(sections):
        section["heading_ur"] = translate_batch(tokenizer, model, [section["heading_source"]])[0]
        for paragraph_index, paragraph in enumerate(section["paragraphs"]):
            sentences = paragraph["sentences"]
            translated = []
            for i in range(0, len(sentences), args.batch_size):
                translated.extend(translate_batch(tokenizer, model, sentences[i:i + args.batch_size]))
            paragraph["translations_ur"] = translated
            for source, urdu in zip(sentences, translated):
                serial += 1
                aligned.append({
                    "id": f"s{serial:05d}",
                    "section_index": section_index,
                    "paragraph_index": paragraph_index,
                    "source_text": source,
                    "text_ur": urdu,
                    "review_status": "needs_human_review",
                    "audio": None,
                })

    data = {
        "schema_version": "1.0",
        "language": "ur",
        "direction": "rtl",
        "source_file": source_path.name,
        "translation_model": TRANSLATION_MODEL,
        "quantization": "4-bit NF4",
        "review_status": "draft_needs_human_review",
        "sections": sections,
        "sentences": aligned,
    }
    target = output_dir / "translation.json"
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Draft saved: {target}. Human review is required before audio generation.")
    del model, tokenizer
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def audio(args):
    import numpy as np
    import soundfile as sf
    import torch
    from omnivoice import OmniVoice

    output_dir = Path(args.output_dir)
    data_path = Path(args.translation)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    if not data.get("sentences"):
        raise ValueError("No aligned sentences found.")
    if not args.reference_audio or not args.reference_text:
        raise ValueError(
            "Pass a 3–10 second Urdu reference clip and its exact transcript to keep one consistent narrator across sentence segments. "
            "You can use the preview WAV created by the preview command."
        )
    if args.require_review and data.get("review_status") not in {"reviewed", "approved_for_audio"}:
        raise ValueError(
            "Translation is still marked as a draft. Review translation.json and set "
            "review_status to 'reviewed' before generating audio, or explicitly pass --allow-unreviewed for a tiny test."
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    segments_dir = output_dir / "segments"
    segments_dir.mkdir(exist_ok=True)
    model = OmniVoice.from_pretrained(TTS_MODEL, device_map="cuda:0", dtype=torch.float16)
    manifest = []

    for index, item in enumerate(data["sentences"], 1):
        text = item["text_ur"].strip()
        if not text:
            raise ValueError(f"Empty Urdu sentence: {item['id']}")
        wav_path = segments_dir / f"{index:05d}.wav"
        mp3_path = segments_dir / f"{index:05d}.mp3"
        if not mp3_path.exists() or args.overwrite:
            kwargs = {"text": text}
            if args.reference_audio:
                kwargs["ref_audio"] = args.reference_audio
                if not args.reference_text:
                    raise ValueError("--reference-text is required with --reference-audio.")
                kwargs["ref_text"] = args.reference_text
            audio_out = model.generate(**kwargs)
            samples = audio_out[0] if isinstance(audio_out, (list, tuple)) else audio_out
            samples = samples.detach().float().cpu().numpy() if hasattr(samples, "detach") else np.asarray(samples)
            samples = np.squeeze(samples)
            sf.write(str(wav_path), samples, 24000)
            result = subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path),
                 "-codec:a", "libmp3lame", "-qscale:a", "3", str(mp3_path)],
                capture_output=True, text=True,
            )
            wav_path.unlink(missing_ok=True)
            if result.returncode:
                raise RuntimeError(f"FFmpeg conversion failed for {item['id']}: {result.stderr}")
        item["audio"] = mp3_path.relative_to(output_dir).as_posix()
        manifest.append({
            "id": item["id"], "text": text, "audio": item["audio"],
            "index": index - 1,
        })

    data["tts_model"] = TTS_MODEL
    data["tts_reference_voice"] = bool(args.reference_audio)
    (output_dir / "translation.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output_dir / "audio_manifest.json").write_text(
        json.dumps({"language": "ur", "direction": "rtl", "model": TTS_MODEL,
                    "segments": manifest}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    articles = []
    for item in data["sentences"]:
        articles.append(
            '<article><p dir="rtl" lang="ur" class="urdu">' + html.escape(item["text_ur"]) +
            '</p><details><summary>Compare with source</summary><p dir="ltr">' +
            html.escape(item["source_text"]) + '</p></details><audio controls preload="none" src="' +
            html.escape(item["audio"], quote=True) + '"></audio></article>'
        )
    review_html = (
        '<!doctype html><html lang="ur" dir="rtl"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Urdu audiobook review</title><style>body{font-family:system-ui,serif;'
        'max-width:900px;margin:2rem auto;padding:1rem;line-height:2}article{border-bottom:1px solid #ddd;'
        'padding:1rem 0}.urdu{font-size:1.35rem}audio{width:100%}</style>'
        '<h1>اردو آڈیو بک — جائزہ</h1><p>AI-generated draft; human review is required.</p>' +
        "".join(articles) + '</html>'
    )
    (output_dir / "review.html").write_text(review_html, encoding="utf-8")

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        concat_file = output_dir / "concat.txt"
        concat_file.write_text(
            "".join("file '" + str((output_dir / item["audio"]).resolve()).replace("'", "'\\''") + "'\n"
                    for item in manifest), encoding="utf-8"
        )
        result = subprocess.run(
            [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
             "-codec:a", "libmp3lame", "-qscale:a", "3", str(output_dir / "chapter.mp3")],
            capture_output=True, text=True,
        )
        concat_file.unlink(missing_ok=True)
        if result.returncode:
            print("Warning: per-sentence MP3s are ready, but chapter concatenation failed:", result.stderr)
    print(f"Generated {len(manifest)} sentence segments under {segments_dir}")


def preview(args):
    import numpy as np
    import soundfile as sf
    from omnivoice import OmniVoice

    model = OmniVoice.from_pretrained(TTS_MODEL, device_map="cuda:0")
    kwargs = {"text": args.text}
    if args.reference_audio:
        kwargs["ref_audio"] = args.reference_audio
        if not args.reference_text:
            raise ValueError("--reference-text is required with --reference-audio.")
        kwargs["ref_text"] = args.reference_text
    audio_out = model.generate(**kwargs)
    samples = audio_out[0] if isinstance(audio_out, (list, tuple)) else audio_out
    samples = samples.detach().float().cpu().numpy() if hasattr(samples, "detach") else np.asarray(samples)
    samples = np.squeeze(samples)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(target), samples, 24000)
    print(f"Preview saved: {target}")


def package(args):
    import zipfile

    out = Path(args.output_dir)
    bundle = out / "urdu_audiobook_bundle.zip"
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in out.rglob("*"):
            if path.is_file() and path != bundle and path.name != "concat.txt":
                archive.write(path, path.relative_to(out))
    print(bundle)


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("translate")
    p.add_argument("--input", required=True)
    p.add_argument("--output-dir", required=True)
    p.add_argument("--batch-size", type=int, default=4)
    p.set_defaults(func=translate)
    p = sub.add_parser("audio")
    p.add_argument("--translation", required=True)
    p.add_argument("--output-dir", required=True)
    p.add_argument("--reference-audio")
    p.add_argument("--reference-text")
    p.add_argument("--allow-unreviewed", action="store_true")
    p.add_argument("--overwrite", action="store_true")
    p.set_defaults(func=audio)
    p = sub.add_parser("preview")
    p.add_argument("--text", default="السلام علیکم۔ آج ہم اس کتاب کے ایک اہم موضوع کو سمجھیں گے۔")
    p.add_argument("--output", required=True)
    p.add_argument("--reference-audio")
    p.add_argument("--reference-text")
    p.set_defaults(func=preview)
    p = sub.add_parser("package")
    p.add_argument("--output-dir", required=True)
    p.set_defaults(func=package)
    args = parser.parse_args()
    if args.command == "audio":
        args.require_review = not args.allow_unreviewed
    args.func(args)


if __name__ == "__main__":
    main()

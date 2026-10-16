# Urdu translation + audiobook pipeline

This is a reproducible Google Colab workflow for producing a **reviewable Urdu edition** from source text and sentence-aligned MP3 assets.

## Editorial boundary
- Start from source text that you have permission to translate. This pipeline does not scrape or silently translate copyrighted full books.
- Translation and audio are drafts until a human reviewer checks religious terminology, quotations, names, references, and Urdu fluency.
- The pipeline never publishes generated content to the live site automatically.
- Never commit API keys, Colab secrets, private source files, or generated audio by accident.

## Quick start in Colab
1. Open `notebooks/urdu_audiobook_pipeline.ipynb` in Google Colab.
2. In Colab Secrets (key icon), add `OPENAI_API_KEY` and grant notebook access.
3. Set model IDs and upload a source text file in Markdown or plain text.
4. Run cells in order. Review `translation.json` before accepting it, then generate sentence MP3s.
5. Download the output ZIP and review transcript/audio before adding the edition to the website.

## Local use
```bash
pip install -r tools/urdu_audiobook/requirements.txt
export OPENAI_API_KEY=...
python tools/urdu_audiobook/pipeline.py translate --input source.md --output-dir build/urdu-book02-u01
python tools/urdu_audiobook/pipeline.py audio --translation build/urdu-book02-u01/translation.json --output-dir build/urdu-book02-u01
python tools/urdu_audiobook/pipeline.py package --output-dir build/urdu-book02-u01
```

Model IDs are configurable with `OPENAI_TRANSLATION_MODEL` and `OPENAI_TTS_MODEL`; the voice is configurable with `OPENAI_TTS_VOICE`. Use IDs available to your API project. Preview candidate voices before choosing one for the full course; listen carefully for Urdu pronunciation.

## Output contract
- `translation.json`: source sentence, Urdu translation, section order, review status.
- `segments/00001.mp3` etc.: one audio segment per Urdu sentence, suitable for precise highlighting.
- `audio_manifest.json`: ordered sentence IDs and audio paths.
- `chapter.mp3`: concatenated chapter audio when FFmpeg is available.
- `review.html`: simple RTL transcript/audio review page.
- `urdu_audiobook_bundle.zip`: package for manual review and transfer.

Sentence-level audio is intentional: the reader can highlight the exact sentence being played without estimating position from the duration of one long MP3.

API calls can incur charges. Run one short sample first, inspect it, and only then scale up. Do not put keys in notebook source or repository files.
# Open-weight Urdu translation + audiobook pipeline

This is the recommended Google Colab workflow for creating a **reviewable Urdu edition** without paid inference APIs. Model weights are downloaded to the Colab runtime; they are not checked into Git.

## Recommended first-pass model combination

- **Translation:** [Qwen/Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B), loaded in 4-bit NF4 mode. The model card documents multilingual support including 100+ languages and an Apache-2.0 license. This should be a practical starting point for a free Colab GPU, but the translation quality for our religious source material must be assessed on a reviewed pilot passage.
- **Urdu speech:** [mlwithabdullah/omnivoice-urdu-12000](https://huggingface.co/mlwithabdullah/omnivoice-urdu-12000), a 0.6B Urdu fine-tune of OmniVoice. The model card reports improvements on a small ten-sentence test set; treat that as a lead, not an independent quality guarantee. Compare the generated audio with the Urdu transcript before scaling.
- **Optional consistent narrator:** OmniVoice accepts a short reference voice recording. Use only a recording you own or have explicit permission to use. A reference clip in Urdu is preferred for Urdu pronunciation.

This is a **candidate combination, not a claim that GPU inference has already passed**. The notebook includes a voice audition and a short-passage pilot. The current environment cannot execute a free Colab GPU session on your behalf, so the actual first run and listening test remain to be done in Colab.

## Quick start

1. Open the [Colab notebook on this branch](https://colab.research.google.com/github/mahashemi/BookReadingFramework/blob/feature/urdu-translation-pipeline/notebooks/urdu_audiobook_pipeline.ipynb).
2. In Colab, select a GPU runtime (for example, T4 if offered).
3. Run the setup cell; it downloads the required Python libraries and model weights as needed.
4. Upload a short authorized source excerpt as Markdown or plain text.
5. Run Qwen3 translation, download `translation.json`, and review it with a fluent Urdu reader.
6. Upload the reviewed JSON back into the notebook, audition the OmniVoice sample, then generate sentence-level MP3s.
7. Download the output bundle and verify the audio against the transcript before adding anything to the live site.

No OpenAI API key is required. Colab GPU availability, RAM/VRAM, download time, and runtime limits vary; use a short pilot before translating whole chapters.

## Pipeline commands

The notebook uses `tools/urdu_audiobook/local_pipeline.py`:

```bash
python tools/urdu_audiobook/local_pipeline.py translate --input source.md --output-dir build/urdu-book02-pilot
python tools/urdu_audiobook/local_pipeline.py preview --output build/urdu-book02-pilot/voice-preview.wav
python tools/urdu_audiobook/local_pipeline.py audio --translation build/urdu-book02-pilot/translation.json --output-dir build/urdu-book02-pilot
python tools/urdu_audiobook/local_pipeline.py package --output-dir build/urdu-book02-pilot
```

Speech generation deliberately refuses to run while the JSON is marked as a draft. Review the translation and set its top-level `review_status` to `reviewed` first. The notebook enforces the sentence IDs and order when uploading the reviewed JSON.

## Output contract

- `translation.json`: source sentence, Urdu translation, section order, model metadata, and review status.
- `segments/00001.mp3` etc.: one audio segment per Urdu sentence.
- `audio_manifest.json`: ordered sentence IDs and relative audio paths for sentence-level playback/highlighting.
- `chapter.mp3`: concatenated chapter audio when FFmpeg succeeds.
- `review.html`: simple RTL transcript/audio review page.
- `urdu_audiobook_bundle.zip`: package for manual review and transfer.

Sentence-level audio is intentional: the website can highlight the current sentence without estimating sentence positions inside one long MP3. Website integration is a separate step; this notebook never publishes automatically.

## Editorial, rights, and safety requirements

- Start from source text you have permission to translate.
- Human review is required for religious terminology, quotations, names/honorifics, references, omissions, and Urdu fluency.
- Listen for pronunciation of Arabic names and quotations; ASR checks can help detect mismatches but cannot verify meaning.
- Do not clone a person's voice without consent.
- Never commit model weights, generated audio, private source text, or personal reference recordings to Git.

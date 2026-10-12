#!/usr/bin/env python3
"""Generate one MP3 per declared Listen & Learn script.

Audio is generated from the repository's source-grounded narration scripts,
not from a verbatim copy of the source book. MP3 files are build artifacts.
"""
from __future__ import annotations
import argparse, asyncio, json, re, subprocess, tempfile
from pathlib import Path
from gtts import gTTS

ROOT=Path(__file__).resolve().parents[1]
MANIFEST=ROOT/"audio"/"manifest.json"
VOICES={"en":"en","fa":"fa"}

def plain_text(markdown: str) -> str:
    markdown=re.split(r"(?im)^#{2,6}\s+(?:source map|نقشه(?:‌| )منبع|نقشه(?:‌| )منابع)\s*$",markdown,maxsplit=1)[0]
    lines=[]
    for line in markdown.splitlines():
        heading=re.match(r"^\s*#{1,6}\s+(.+?)\s*$",line)
        if heading:
            title=heading.group(1).strip().lower()
            cues={
                "narration":"",
                "عنوان شنیداری":"",
                "deep reading insight":"A deeper point to consider.",
                "بینشِ خوانش عمیق":"حالا کمی عمیق‌تر به این نکته نگاه کنیم.",
                "reflection":"Now, pause and reflect.",
                "مکث و تمرین":"حالا مکث کنیم و فکر کنیم.",
                "transition":"As we move forward, keep this question in mind.",
                "گذار":"از اینجا به نکته‌ی بعد می‌رسیم.",
                "summary":"To bring these ideas together.",
                "conclusion":"To bring these ideas together."
            }
            if title in cues and cues[title]: lines.append(cues[title])
            elif title in cues or title.startswith("listen & learn"): continue
            else:
                cue="The next point is " if not re.search(r"[\u0600-\u06ff]",heading.group(1)) else "نکته‌ی بعدی این است: "
                lines.append(cue+heading.group(1).strip(".،: ") + ".")
            continue
        line=re.sub(r"\[([^\]]+)\]\((?:https?://[^)\s]+|#[^)]+)\)",r"\1",line)
        line=re.sub(r"^\s*>\s?","",line)
        line=re.sub(r"^\s*(?:[-+*]|\d+[.)])\s+","",line)
        line=re.sub(r"https?://\S+","",line)
        line=re.sub(r"[*_~]{1,3}","",line).replace(chr(96),"")
        line=re.sub(r"^\s*[-*_]{3,}\s*$","",line)
        line=line.replace("Mu'awiyah","Muawiyah").replace("Mu’awiyah","Muawiyah")
        line=line.replace("Ja'far","Jafar").replace("Ja’far","Jafar").replace("Qur'an","Quran").replace("Qur’an","Quran")
        line=re.sub(r"\s+"," ",line).strip()
        if line: lines.append(line)
    return re.sub(r"\n{3,}","\n\n","\n\n".join(lines)).strip()

def split_text(text: str, limit: int=2600) -> list[str]:
    # Pack adjacent short paragraphs together; one TTS request per paragraph
    # would turn a book into hundreds of unnecessary network calls.
    result=[]; buffer=""
    def split_long(paragraph):
        parts=[]; remaining=paragraph.strip()
        while len(remaining)>limit:
            cut=max(remaining.rfind(". ",0,limit),remaining.rfind("? ",0,limit),remaining.rfind("! ",0,limit),remaining.rfind("؟ ",0,limit))
            if cut < limit//2: cut=remaining.rfind(" ",0,limit)
            if cut < 1: cut=limit
            parts.append(remaining[:cut+1].strip()); remaining=remaining[cut+1:].strip()
        if remaining: parts.append(remaining)
        return parts
    for paragraph in re.split(r"\n\s*\n",text):
        paragraph=paragraph.strip()
        if not paragraph: continue
        if len(paragraph)>limit:
            if buffer: result.append(buffer); buffer=""
            result.extend(split_long(paragraph)); continue
        candidate=(buffer+"\n\n"+paragraph).strip() if buffer else paragraph
        if len(candidate)<=limit: buffer=candidate
        else:
            if buffer: result.append(buffer)
            buffer=paragraph
    if buffer: result.append(buffer)
    return result

async def synthesize(text: str, lang: str, path: Path):
    try:
        await asyncio.wait_for(asyncio.to_thread(gTTS(text=text, lang=lang, slow=False).save, str(path)), timeout=75)
        return "Google TTS"
    except Exception as exc:
        # Hosted neural TTS endpoints can reject automated runners. Keep the
        # chapter build usable with an explicit offline English fallback.
        if lang != "en":
            raise RuntimeError(f"Online Persian TTS failed for {path.name}; no accurate offline Persian voice is configured: {exc}") from exc
        wav=path.with_suffix(".wav")
        subprocess.run(["espeak-ng","-v","en-us","-s","155","-p","45","-a","170","-w",str(wav),text],check=True)
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(wav),"-codec:a","libmp3lame","-q:a","3",str(path)],check=True)
        wav.unlink(missing_ok=True)
        return "eSpeak NG fallback"

async def generate_unit(book_id: str, unit_id: str, entry: dict, out_dir: Path):
    source=ROOT/entry["script"];spoken=plain_text(source.read_text(encoding="utf-8"))
    if len(spoken)<900:raise ValueError(f"Refusing to create audio from an unusually short script: {source} ({len(spoken)} chars)")
    arabic_count=len(re.findall(r"[\u0600-\u06ff]",spoken)); latin_count=len(re.findall(r"[A-Za-z]",spoken))
    voice=VOICES["fa"] if arabic_count > max(300, latin_count * 0.20) else VOICES["en"]
    pieces=split_text(spoken);target=out_dir/book_id/(unit_id+".mp3");target.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="book-audio-") as tmp:
        tmpdir=Path(tmp);parts=[]
        engines=set()
        for i,piece in enumerate(pieces,1):
            part=tmpdir/f"part-{i:04d}.mp3";engines.add(await synthesize(piece,voice,part));parts.append(part)
        listing=tmpdir/"concat.txt"
        listing.write_text("".join("file '"+str(p).replace("'","'\\''")+"'\n" for p in parts),encoding="utf-8")
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(listing),"-c","copy",str(target)],check=True)
    return {"book_id":book_id,"unit_id":unit_id,"script":entry["script"],"voice":voice,"engine":sorted(engines),"characters":len(spoken),"segments":len(pieces),"mp3":str(target.relative_to(out_dir))}

async def main():
    ap=argparse.ArgumentParser();ap.add_argument("--output-dir",default="dist/audiobook")
    ap.add_argument("--book",action="append",help="limit to one or more manifest book IDs; repeatable")
    ap.add_argument("--limit",type=int,default=0,help="limit units for a smoke test");args=ap.parse_args()
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"));output=Path(args.output_dir)
    if not output.is_absolute():output=ROOT/output
    tasks=[]
    for bid,book in manifest.get("books",{}).items():
        if args.book and bid not in args.book:continue
        for uid,entry in book.get("units",{}).items():
            if entry.get("script"):tasks.append((bid,uid,entry))
    if args.limit:tasks=tasks[:args.limit]
    if not tasks:raise SystemExit("No declared narration scripts matched the requested books.")
    sem=asyncio.Semaphore(3)
    async def worker(bid,uid,entry):
        async with sem:
            print(f"Generating {bid}/{uid} from {entry['script']}",flush=True)
            return await generate_unit(bid,uid,entry,output)
    results=await asyncio.gather(*(worker(bid,uid,entry) for bid,uid,entry in tasks))
    index=output/"audiobook-index.json"
    index.write_text(json.dumps({"source":"BookReadingFramework narration scripts","units":results},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Generated {len(results)} chapter MP3 files in {output}")
if __name__=="__main__":asyncio.run(main())

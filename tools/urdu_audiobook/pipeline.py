import argparse,json,os,re,shutil,subprocess,zipfile
from pathlib import Path
from openai import OpenAI
TM=os.getenv("OPENAI_TRANSLATION_MODEL","gpt-4o")
AM=os.getenv("OPENAI_TTS_MODEL","gpt-4o-mini-tts")
VOICE=os.getenv("OPENAI_TTS_VOICE","marin")
def split(t):
 t=re.sub(r"\s+"," ",t).strip()
 return [x.strip() for x in re.findall(r'.+?(?:[.!?؟۔]+(?=\s|$)|$)',t) if x.strip()] or ([t] if t else [])
def source(path):
 sections=[]; heading=Path(path).stem; paras=[]
 def flush():
  nonlocal paras
  if paras: sections.append({"heading_source":heading,"paragraphs":[{"source_text":p,"sentences":split(p)} for p in paras]}); paras=[]
 for line in Path(path).read_text(encoding="utf-8").splitlines():
  line=line.strip()
  if line.startswith("#"):
   flush(); heading=line.lstrip("#").strip() or heading
  elif not line: flush()
  elif not line.startswith(chr(96)*3): paras.append(line)
 flush(); return sections
def tr(client,ss,model):
 sys=("Translate each sentence into natural standard Urdu in Urdu script. Preserve meaning, names, honorifics, dates, quotations, citations, and distinctions. Do not add or omit content. Return one Urdu sentence per input in the same order. Use faithful transliteration for religious/technical terms if translation could distort them. Return JSON with key translations containing an array.")
 r=client.chat.completions.create(model=model,temperature=.2,response_format={"type":"json_object"},messages=[{"role":"system","content":sys},{"role":"user","content":json.dumps({"sentences":ss},ensure_ascii=False)}])
 out=json.loads(r.choices[0].message.content or "{}").get("translations")
 if not isinstance(out,list) or len(out)!=len(ss) or not all(isinstance(x,str) and x.strip() for x in out): raise ValueError("Translation output count/content mismatch.")
 return [x.strip() for x in out]
def translate(a):
 out=Path(a.output_dir); out.mkdir(parents=True,exist_ok=True); client=OpenAI(); model=a.model or TM; secs=source(a.input); flat=[]; n=0
 for si,s in enumerate(secs):
  s["heading_ur"]=tr(client,[s["heading_source"]],model)[0]
  for pi,p in enumerate(s["paragraphs"]):
   ss=p["sentences"]; ts=[]
   for i in range(0,len(ss),a.batch_size): ts+=tr(client,ss[i:i+a.batch_size],model)
   p["translations_ur"]=ts
   for x,y in zip(ss,ts):
    n+=1; flat.append({"id":f"s{n:05d}","section_index":si,"paragraph_index":pi,"source_text":x,"text_ur":y,"review_status":"needs_human_review","audio":None})
 data={"schema_version":"1.0","language":"ur","direction":"rtl","source_file":Path(a.input).name,"translation_model":model,"review_status":"draft_needs_human_review","sections":secs,"sentences":flat}
 (out/"translation.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); print("Draft saved; human review required:",out/"translation.json")
def audio(a):
 out=Path(a.output_dir); out.mkdir(parents=True,exist_ok=True); d=json.loads(Path(a.translation).read_text(encoding="utf-8")); client=OpenAI(); model=a.model or AM; voice=a.voice or VOICE
 sd=out/"segments"; sd.mkdir(exist_ok=True); manifest=[]
 for i,x in enumerate(d["sentences"],1):
  t=x["text_ur"].strip()
  if not t or len(t)>4000: raise ValueError("Empty or oversized sentence "+x["id"])
  p=sd/f"{i:05d}.mp3"
  if not p.exists() or a.overwrite:
   r=client.audio.speech.create(model=model,voice=voice,input=t,response_format="mp3",instructions="Read this Urdu sentence in a calm, warm, clear educational audiobook style. Use natural standard Urdu pronunciation, measured pace, and respectful delivery. Do not add words.")
   p.write_bytes(r.read())
  rel=p.relative_to(out).as_posix(); x["audio"]=rel; manifest.append({"id":x["id"],"text":t,"audio":rel,"index":i-1})
 d["tts_model"]=model; d["tts_voice"]=voice
 (out/"translation.json").write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 (out/"audio_manifest.json").write_text(json.dumps({"language":"ur","direction":"rtl","model":model,"voice":voice,"segments":manifest},ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 blocks=[]
 for x in d["sentences"]:
  blocks.append('<article><p dir="rtl" lang="ur" style="font-size:1.3rem">'+x["text_ur"].replace("&","&amp;").replace("<","&lt;")+'</p><details><summary>Compare with source</summary><p dir="ltr">'+x["source_text"].replace("&","&amp;").replace("<","&lt;")+'</p></details><audio controls preload="none" src="'+x["audio"]+'"></audio></article>')
 (out/"review.html").write_text('<!doctype html><html lang="ur" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Urdu audiobook review</title><style>body{font-family:system-ui,serif;max-width:900px;margin:2rem auto;padding:1rem;line-height:2}article{border-bottom:1px solid #ddd;padding:1rem 0}audio{width:100%}</style><h1>اردو آڈیو بک — جائزہ</h1><p>مسودہ: اشاعت سے پہلے انسانی جانچ ضروری ہے۔</p>'+''.join(blocks)+'</html>',encoding="utf-8")
 ff=shutil.which("ffmpeg")
 if ff:
  listing=out/"concat.txt"; listing.write_text("".join("file '"+str((out/x["audio"]).resolve()).replace("'","'\\''")+"'\n" for x in manifest),encoding="utf-8")
  r=subprocess.run([ff,"-y","-f","concat","-safe","0","-i",str(listing),"-c","copy",str(out/"chapter.mp3")],capture_output=True)
  if not r.returncode: listing.unlink(missing_ok=True)
 print("Audio, manifest, and review page saved under",out)
def package(a):
 out=Path(a.output_dir); zpath=out/"urdu_audiobook_bundle.zip"
 with zipfile.ZipFile(zpath,"w",zipfile.ZIP_DEFLATED) as z:
  for p in out.rglob("*"):
   if p.is_file() and p!=zpath and p.name!="concat.txt": z.write(p,p.relative_to(out))
 print(zpath)
def main():
 p=argparse.ArgumentParser(); s=p.add_subparsers(dest="cmd",required=True)
 q=s.add_parser("translate"); q.add_argument("--input",required=True); q.add_argument("--output-dir",required=True); q.add_argument("--model"); q.add_argument("--batch-size",type=int,default=10); q.set_defaults(fn=translate)
 q=s.add_parser("audio"); q.add_argument("--translation",required=True); q.add_argument("--output-dir",required=True); q.add_argument("--model"); q.add_argument("--voice"); q.add_argument("--overwrite",action="store_true"); q.set_defaults(fn=audio)
 q=s.add_parser("package"); q.add_argument("--output-dir",required=True); q.set_defaults(fn=package)
 a=p.parse_args(); a.fn(a)
if __name__=="__main__": main()

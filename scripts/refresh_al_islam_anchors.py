#!/usr/bin/env python3
"""Audit/refresh source-section links for Books 01 and 02 from Al-Islam.org.

Only heading metadata and HTML IDs are retained locally; this does not mirror
the source book's prose. Default mode audits current links. Pass --write to
match chunks to headings and update existing source_url fields in place.
"""
from __future__ import annotations
import argparse, json, re, sys, time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urldefrag, urlparse
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[1]
BOOKS={
 "book01":ROOT/"Library"/"Book 01 - Polarization Around _Ali"/"data"/"chunks.json",
 "book02":ROOT/"Library"/"Book 02 - Survey of the Lives of the Infallible Imams"/"data"/"chunks.json"}
INDEX=ROOT/"reference"/"al-islam"/"sections.json"
STOP={"the","and","for","with","from","that","this","into","their","they","were","was","are","its","how","why","what","when","where","chapter","session","part","imam","ali","imams","book","about","between","after","before","through","under","over","than","then","have","has","not","but"}
def words(s): return {w for w in re.findall(r"[a-z0-9]+",s.casefold()) if len(w)>2 and w not in STOP}
class Page(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.sections=[];self.ids=set();self.current=None;self.h=None;self.parts=[];self.hid=""
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if a.get("id"):self.ids.add(a["id"])
  if tag in {"h1","h2","h3","h4","h5","h6"}:self.h,self.parts,self.hid=tag,[],a.get("id","")
 def handle_data(self,data):
  v=" ".join(data.split())
  if not v:return
  if self.h:self.parts.append(v)
  elif self.current is not None:self.current["body"]+=" "+v
 def handle_endtag(self,tag):
  if self.h and tag==self.h:
   title=" ".join(self.parts).strip()
   if title:self.current={"title":title,"id":self.hid,"body":""};self.sections.append(self.current)
   self.h,self.parts=None,[]
def fetch(url):
 p=urlparse(url)
 if p.scheme!="https" or p.hostname!="al-islam.org":raise ValueError("Refusing non-canonical URL: "+url)
 req=Request(url,headers={"User-Agent":"BookReadingFramework-source-link-audit/1.0"});err=None
 for i in range(3):
  try:
   with urlopen(req,timeout=25) as r:raw=r.read().decode("utf-8","replace")
   page=Page();page.feed(raw);return page
  except (HTTPError,URLError,TimeoutError) as ex:err=ex;time.sleep(i+1)
 raise RuntimeError("Fetch failed for "+url+": "+str(err))
def slug(s):return re.sub(r"[^a-z0-9]+","-",s.casefold().replace("’","").replace("'","")).strip("-")
def score(title,text,sec):
 a,b,c,d=words(title),words(sec["title"]),words(text),words(sec["body"])
 return .62*len(a&b)/max(1,len(a))+.38*len(c&d)/max(1,len(c))
def best(title,text,sections):
 ranked=sorted(((score(title,text,s),s) for s in sections),key=lambda x:x[0],reverse=True)
 return ranked[0][1] if ranked and ranked[0][0]>=.055 else None
def base(url):return urldefrag(url)[0]
def link(url,sec):return base(url)+"#"+quote(sec.get("id") or slug(sec["title"]),safe="-._~") if sec else base(url)
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--write",action="store_true");ap.add_argument("--strict",action="store_true");args=ap.parse_args()
 data={k:json.loads(p.read_text(encoding="utf-8")) for k,p in BOOKS.items()}
 urls=sorted({base(u.get("source_url","")) for b in data.values() for u in b.get("units",[]) if u.get("source_url")})
 pages={};fail=[];invalid=[];unresolved=[];changes=0
 for url in urls:
  try:pages[url]=fetch(url)
  except Exception as ex:fail.append(str(ex));print("ERROR "+str(ex),file=sys.stderr)
 index={"source":"Al-Islam.org","policy":"Heading metadata only; original prose is not mirrored.","pages":[]}
 for url,page in pages.items():index["pages"].append({"url":url,"sections":[{"title":s["title"],"id":s["id"] or slug(s["title"])} for s in page.sections]})
 for bid,book in data.items():
  for unit in book.get("units",[]):
   url=base(unit.get("source_url") or "");page=pages.get(url)
   if not page:continue
   u_sec=best(unit.get("title","")," ".join(c.get("text","") for c in unit.get("chunks",[])),page.sections)
   if u_sec:
    u_link=link(url,u_sec)
    if unit.get("source_url")!=u_link:
     changes+=1
     if args.write:unit["source_url"]=u_link
   else:unresolved.append(bid+"/"+unit.get("id","?")+" unit")
   for chunk in unit.get("chunks",[]):
    old=chunk.get("source_url","");sec=best(chunk.get("title",""),chunk.get("text",""),page.sections)
    if not sec:
     unresolved.append(bid+"/"+chunk.get("id","?")+" concept")
     if args.strict and not args.write and "#" in old and old.split("#",1)[1] not in page.ids:invalid.append(bid+"/"+chunk.get("id","?")+" missing #"+old.split("#",1)[1])
     continue
    new=link(url,sec)
    if old!=new:
     changes+=1
     if args.write:chunk["source_url"]=new
    checked=new if args.write else old;frag=checked.split("#",1)[1] if "#" in checked else ""
    if args.strict and frag and frag not in page.ids:invalid.append(bid+"/"+chunk.get("id","?")+" missing #"+frag)
 print("Fetched pages: %d/%d"%(len(pages),len(urls)));print("Suggested URL updates: %d"%changes);print("Unresolved heading matches: %d"%len(unresolved))
 for x in unresolved[:40]:print("UNRESOLVED "+x)
 for x in invalid:print("INVALID "+x,file=sys.stderr)
 if args.write and not fail:
  for bid,book in data.items():BOOKS[bid].write_text(json.dumps(book,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  INDEX.parent.mkdir(parents=True,exist_ok=True);INDEX.write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 return 1 if fail or invalid else 0
if __name__=="__main__":raise SystemExit(main())

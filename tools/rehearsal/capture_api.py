"""Capture every JSON GET endpoint of a running Books-Core-Ideas backend.

usage: python capture_api.py <base_url> <out_dir>
Writes one <name>.json per request (raw bytes) and timing.txt.
"""
import hashlib, io, json, os, sys, time, urllib.request, urllib.error, zipfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252

base, out = sys.argv[1].rstrip('/'), sys.argv[2]
os.makedirs(out, exist_ok=True)
timing = []


def fetch(path):
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(base + path) as r:
            status, body = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    return status, body, (time.perf_counter() - t) * 1000


def save(name, path):
    status, body, ms = fetch(path)
    with open(os.path.join(out, name + '.json'), 'wb') as f:
        f.write(json.dumps({'status': status, 'body': body.decode('utf-8')}, ensure_ascii=False).encode('utf-8'))
    timing.append(f'{name}\t{status}\t{len(body)}\t{ms:.0f}')
    return json.loads(body) if status == 200 and body else None


def save_binary(name, path):
    status, body, ms = fetch(path)
    rec = {'status': status, 'body': json.dumps({'sha256': hashlib.sha256(body).hexdigest(), 'size': len(body)})}
    with open(os.path.join(out, name + '.json'), 'wb') as f:
        f.write(json.dumps(rec).encode('utf-8'))
    timing.append(f'{name}\t{status}\t{len(body)}\t{ms:.0f}')


def save_zip(name, path):
    """Zip export: per-entry content; manifest.exportedAt is a timestamp, so dropped."""
    status, body, ms = fetch(path)
    entries = {}
    if status == 200:
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            for n in sorted(z.namelist()):
                data = z.read(n)
                if n.endswith('.json'):
                    doc = json.loads(data)
                    if n == 'manifest.json':
                        doc.pop('exportedAt', None)
                    entries[n] = doc
                else:
                    entries[n] = hashlib.sha256(data).hexdigest()
    with open(os.path.join(out, name + '.json'), 'wb') as f:
        f.write(json.dumps({'status': status, 'body': json.dumps(entries, ensure_ascii=False)}, ensure_ascii=False).encode('utf-8'))
    timing.append(f'{name}\t{status}\t{len(body)}\t{ms:.0f}')


books = save('books', '/api/books')
save('categories', '/api/books/categories')
save('reviews-all', '/api/reviews')
save('bookmarks-all', '/api/bookmarks')
save('ideas-all', '/api/ideas')
save('excerpts-all', '/api/excerpts')
save('ideas-q', '/api/ideas?q=the')
save('excerpts-q', '/api/excerpts?q=the')
save('ideas-tag', '/api/ideas?tag=mindset')
cols = save('collections', '/api/book-collections')
for c in cols or []:
    save(f'coll-{c["id"]}', f'/api/book-collections/{c["id"]}/books')
for b in books:
    i = b['id']
    save(f'book-{i}', f'/api/books/{i}')
    save(f'book-{i}-detail', f'/api/books/{i}/detail')
    chapters = save(f'book-{i}-chapters', f'/api/books/{i}/chapters')
    save(f'book-{i}-parts', f'/api/books/{i}/parts')
    save(f'book-{i}-reviews', f'/api/books/{i}/reviews')
    save(f'book-{i}-marks', f'/api/books/{i}/marks')
    save(f'book-{i}-bookmarks', f'/api/bookmarks?bookId={i}')
    save(f'book-{i}-latest', f'/api/books/{i}/bookmarks/latest')
    save(f'book-{i}-expl-ids', f'/api/books/{i}/explanation-chapter-ids')
    save(f'book-{i}-export', f'/api/books/{i}/export')
    save(f'book-{i}-ideas', f'/api/ideas?bookId={i}')
    save(f'book-{i}-excerpts', f'/api/excerpts?bookId={i}')
    save(f'coll-for-{i}', f'/api/book-collections/for-book/{i}')
    save_zip(f'book-{i}-migration-export', f'/api/migration/export/{i}')
    for ch in chapters or []:
        c = ch['id']
        save(f'ch-{c}-ideas', f'/api/chapters/{c}/ideas')
        save(f'ch-{c}-excerpts', f'/api/chapters/{c}/excerpts')
        save(f'ch-{c}-explanation', f'/api/chapters/{c}/explanation')
        save(f'ch-{c}-marks', f'/api/chapters/{c}/marks')
        images = save(f'ch-{c}-images', f'/api/chapters/{c}/images')
        for img in images or []:
            save_binary(f'img-{img["id"]}-data', f'/api/chapters/{c}/images/{img["id"]}/data')

with open(os.path.join(out, 'timing.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(timing))
print(f'captured {len(timing)} responses into {out}')

"""Round-trip the real data through both importers into an EMPTY second instance.

usage: python roundtrip.py <source_base_url> <empty_target_base_url>

1. ZIP migration: export every book from the source, import the archive into the target,
   export again from the target and compare the JSON entries (manifest.exportedAt aside).
2. JSON import (FE-08): for every source book, POST its /export JSON to the target's
   /api/books/import and compare the new book's /export with the original.
Prints the differences; exit code 1 if any.
"""
import io, json, sys, urllib.request, uuid, zipfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
source, target = (u.rstrip('/') for u in sys.argv[1:3])


def request(method, url, body=None, headers=None):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req) as r:
        return r.read()


def get_json(url):
    return json.loads(request('GET', url))


def post_json(url, doc):
    return json.loads(request('POST', url, json.dumps(doc).encode('utf-8'), {'Content-Type': 'application/json'}))


def export_zip(base):
    data = request('POST', base + '/api/migration/export', b'{"bookIds":[]}', {'Content-Type': 'application/json'})
    entries = {}
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in z.namelist():
            if name.endswith('.json'):
                doc = json.loads(z.read(name))
                if name == 'manifest.json':
                    doc.pop('exportedAt', None)
                entries[name] = doc
    return data, entries


def import_zip(base, data):
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="all.zip"\r\n'
            f'Content-Type: application/zip\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
    return json.loads(request('POST', base + '/api/migration/import', body,
                              {'Content-Type': f'multipart/form-data; boundary={boundary}'}))


problems = []
if get_json(target + '/api/books'):
    sys.exit('target must be an empty instance')

archive, before = export_zip(source)
result = import_zip(target, archive)
_, after = export_zip(target)
for name in sorted(set(before) | set(after)):
    if before.get(name) != after.get(name):
        problems.append(f'zip: {name} differs')
print(f'zip: {len(before)} entries exported, import result: {result["booksImported"]} imported, '
      f'{result["booksSkipped"]} skipped, {result["booksFailed"]} failed')

books = get_json(source + '/api/books')
for book in books:
    original = get_json(f'{source}/api/books/{book["id"]}/export')
    created = post_json(target + '/api/books/import', {'books': [original]})
    again = get_json(f'{target}/api/books/{created[0]["id"]}/export')
    if again != original:
        problems.append(f'json: book {book["id"]} ({book["title"][:40]}) differs')
print(f'json: {len(books)} books imported and re-exported')

print(f'{len(problems)} problem(s)')
for p in problems:
    print('  ' + p)
sys.exit(1 if problems else 0)

"""Check that every captured /api/books/{id}/detail equals the separate endpoints it replaces.

usage: python check_detail.py <api_dir>     (a capture_api.py output directory)
detail.book == /books/{id}; parts == /parts; bookmarks == /bookmarks?bookId; marks == /marks;
each chapter == /chapters entry + its image count, explanation flag and favorite flag
(/favorites?bookId).
"""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
api = sys.argv[1]


def body(name):
    path = os.path.join(api, name + '.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        rec = json.load(f)
    return json.loads(rec['body']) if rec['status'] == 200 and rec['body'] else None


problems, checked = [], 0
for book in body('books'):
    i = book['id']
    detail = body(f'book-{i}-detail')
    if detail is None:
        problems.append(f'book {i}: no detail response')
        continue
    expected = {
        'book': body(f'book-{i}'),
        'parts': body(f'book-{i}-parts'),
        'bookmarks': body(f'book-{i}-bookmarks'),
        'marks': body(f'book-{i}-marks'),
    }
    for key, value in expected.items():
        if detail[key] != value:
            problems.append(f'book {i}: {key} differs')
    explained = set(body(f'book-{i}-expl-ids') or [])
    # /favorites?bookId is captured since favorites exist (V12); older captures have no favorite flag.
    favorites = body(f'book-{i}-favorites')
    starred = {f['chapterId'] for f in favorites} if favorites is not None else None
    chapters = []
    for ch in body(f'book-{i}-chapters'):
        c = ch['id']
        expected_chapter = {**ch, 'imageCount': len(body(f'ch-{c}-images') or []), 'hasExplanation': c in explained}
        if starred is not None:
            expected_chapter['favorite'] = c in starred
        chapters.append(expected_chapter)
    if detail['chapters'] != chapters:
        problems.append(f'book {i}: chapters differ')
    checked += 1

print(f'checked {checked} books; {len(problems)} problem(s)')
for p in problems:
    print('  ' + p)
sys.exit(1 if problems else 0)

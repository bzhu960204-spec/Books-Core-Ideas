"""Compare two capture_api.py output dirs: same status and same parsed JSON body.

usage: python compare_api.py [--strict] <before_dir> <after_dir>

--strict: also require the same raw body text, so that key order and number or
          string formatting count as differences (e.g. a JSON library upgrade, BE-10).
"""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252

args = sys.argv[1:]
strict = '--strict' in args
before, after = [a for a in args if a != '--strict']
names = sorted(n for n in os.listdir(before) if n.endswith('.json'))
diffs, missing = [], []


def load(d, n):
    with open(os.path.join(d, n), encoding='utf-8') as f:
        rec = json.load(f)
    raw = body = rec['body']
    try:
        body = json.loads(body) if body else body
    except json.JSONDecodeError:
        pass
    return rec['status'], body, raw


def first_diff(a, b, path='$'):
    if type(a) is not type(b):
        return f'{path}: {type(a).__name__} != {type(b).__name__}'
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                return f'{path}.{k}: only in {"after" if k not in a else "before"}'
            d = first_diff(a[k], b[k], f'{path}.{k}')
            if d:
                return d
        return None
    if isinstance(a, list):
        if len(a) != len(b):
            return f'{path}: length {len(a)} != {len(b)}'
        for i, (x, y) in enumerate(zip(a, b)):
            d = first_diff(x, y, f'{path}[{i}]')
            if d:
                return d
        return None
    return None if a == b else f'{path}: {a!r} != {b!r}'


for n in names:
    if not os.path.exists(os.path.join(after, n)):
        missing.append(n)
        continue
    (sa, ba, ra), (sb, bb, rb) = load(before, n), load(after, n)
    if sa != sb:
        diffs.append(f'{n}: status {sa} != {sb}')
        continue
    d = first_diff(ba, bb)
    if not d and strict and ra != rb:
        i = next((i for i, (x, y) in enumerate(zip(ra, rb)) if x != y), min(len(ra), len(rb)))
        d = f'same JSON, different text at char {i}: {ra[max(0, i - 30):i + 30]!r} != {rb[max(0, i - 30):i + 30]!r}'
    if d:
        diffs.append(f'{n}: {d}')

print(f'compared {len(names) - len(missing)} responses; missing {len(missing)}; differing {len(diffs)}')
for line in (missing + diffs)[:40]:
    print('  ' + line)
sys.exit(1 if diffs or missing else 0)

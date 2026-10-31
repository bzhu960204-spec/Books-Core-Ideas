"""Compare two capture_api.py output dirs: same status and same parsed JSON body.

usage: python compare_api.py <before_dir> <after_dir>
"""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252

before, after = sys.argv[1], sys.argv[2]
names = sorted(n for n in os.listdir(before) if n.endswith('.json'))
diffs, missing = [], []


def load(d, n):
    with open(os.path.join(d, n), encoding='utf-8') as f:
        rec = json.load(f)
    body = rec['body']
    try:
        body = json.loads(body) if body else body
    except json.JSONDecodeError:
        pass
    return rec['status'], body


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
    (sa, ba), (sb, bb) = load(before, n), load(after, n)
    if sa != sb:
        diffs.append(f'{n}: status {sa} != {sb}')
        continue
    d = first_diff(ba, bb)
    if d:
        diffs.append(f'{n}: {d}')

print(f'compared {len(names) - len(missing)} responses; missing {len(missing)}; differing {len(diffs)}')
for line in (missing + diffs)[:40]:
    print('  ' + line)
sys.exit(1 if diffs or missing else 0)

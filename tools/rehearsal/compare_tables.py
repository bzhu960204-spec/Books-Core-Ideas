"""Compare the per-table CSV dumps written by rehearse.ps1.

usage: python compare_tables.py <before_tables_dir> <after_tables_dir>
Rows are compared pairwise in ID order, column by column (column order ignored).
Meant for "nothing changed" checks, e.g. a migration on a copy of the real data.
"""
import csv, os, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Windows consoles default to cp1252

csv.field_size_limit(1 << 30)
before, after = sys.argv[1], sys.argv[2]
bad = 0
for name in sorted(os.listdir(before)):
    def load(d):
        with open(os.path.join(d, name), encoding='utf-8', newline='') as f:
            return list(csv.DictReader(f))
    a, b = load(before), load(after)
    diffs = []
    if len(a) != len(b):
        diffs.append(f'row count {len(a)} != {len(b)}')
    if a and b and set(a[0]) != set(b[0]):
        diffs.append(f'columns differ: {sorted(set(a[0]) ^ set(b[0]))}')
    for ra, rb in zip(a, b):
        for k in ra:
            if k in rb and ra[k] != rb[k]:
                diffs.append(f'ID {ra.get("ID")} {k}: {ra[k][:60]!r} != {rb[k][:60]!r}')
    status = 'OK ' if not diffs else 'BAD'
    print(f'{status} {name[:-4]:<22} {len(a):>5} rows')
    for d in diffs[:5]:
        print('     ' + d)
    bad += bool(diffs)
sys.exit(1 if bad else 0)

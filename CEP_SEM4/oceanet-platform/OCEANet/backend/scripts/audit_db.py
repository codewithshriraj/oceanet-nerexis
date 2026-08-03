import sqlite3, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

DB = os.path.join(os.path.dirname(__file__), '..', 'data', 'nerexis_auth.db')
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

total = cur.execute('SELECT COUNT(*) as c FROM datasets').fetchone()['c']
snapshot_name = cur.execute(
    "SELECT COUNT(*) as c FROM datasets WHERE lower(original_name) LIKE '%snapshot%' OR lower(original_name) LIKE '%sample%'"
).fetchone()['c']
live_snap_source = cur.execute(
    "SELECT COUNT(*) as c FROM datasets WHERE lower(source) IN ('gbif','inaturalist','noaa-erddap','open-meteo','nasa') AND lower(status) LIKE '%snapshot%'"
).fetchone()['c']
dup_groups = cur.execute(
    "SELECT COUNT(*) as c FROM (SELECT content_hash FROM datasets WHERE content_hash IS NOT NULL AND content_hash != '' GROUP BY content_hash HAVING COUNT(*) > 1)"
).fetchone()['c']
rejected = cur.execute(
    "SELECT COUNT(*) as c FROM datasets WHERE lower(validation_status) LIKE 'rejected%'"
).fetchone()['c']

print(f'Total: {total} | snapshot_name: {snapshot_name} | live_snap_source: {live_snap_source} | dup_hash_groups: {dup_groups} | rejected_validation: {rejected}')

# Show source distribution
rows = cur.execute('SELECT source, status, COUNT(*) as cnt FROM datasets GROUP BY source, status ORDER BY cnt DESC').fetchall()
print('\n--- Source/Status Distribution ---')
for r in rows:
    print(f"  {r['source']:30s} | {r['status']:20s} | {r['cnt']}")

print('\n--- Latest 20 entries ---')
rows = cur.execute('SELECT id, original_name, source, status, size_bytes FROM datasets ORDER BY id DESC LIMIT 20').fetchall()
for r in rows:
    print(f"  {r['id']:5d} | {r['source']:20s} | {r['status']:15s} | {str(r['original_name'])[:55]:55s} | {r['size_bytes']}")

conn.close()

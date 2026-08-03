from pathlib import Path
import sqlite3, json, csv, datetime, urllib.request, urllib.error, re

backend = Path(__file__).resolve().parents[1]
db_path = backend / 'data' / 'nerexis_auth.db'
dataset_dir = backend / 'data' / 'datasets'
audit_dir = backend / 'data' / 'reports' / 'audits'
audit_dir.mkdir(parents=True, exist_ok=True)

def norm(s):
    return re.sub(r'[^a-z0-9]+', '', (s or '').strip().lower())

verified_sources = {norm(x) for x in [
    'NOAA','NASA EONET','Open-Meteo','GBIF','iNaturalist','OBIS','NOAA ERDDAP',
    'NASA DAAC','CMDS','EMODnet Biology','WoRMS','Global Fishing Watch','Argo Floats'
]}

checks = [
    ('Open-Meteo','https://marine-api.open-meteo.com/v1/marine?latitude=0&longitude=0&hourly=wave_height'),
    ('NOAA Tides','https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=water_level&application=web_services&station=8410140&date=latest&datum=MSL&time_zone=gmt&units=metric&format=json'),
    ('NASA EONET','https://eonet.gsfc.nasa.gov/api/v3/events?limit=1'),
    ('GBIF','https://api.gbif.org/v1/occurrence/search?limit=1'),
    ('iNaturalist','https://api.inaturalist.org/v1/observations?per_page=1'),
    ('OBIS','https://api.obis.org/v3/occurrence?size=1'),
    ('NOAA ERDDAP','https://coastwatch.pfeg.noaa.gov/erddap/index.json'),
    ('NASA DAAC CMR','https://cmr.earthdata.nasa.gov/search/collections.json?page_size=1'),
    ('CMDS','https://goosocean.org/index.php?option=com_api&view=api&format=raw'),
    ('EMODnet Biology','https://www.emodnet-biology.eu/ws/service/search?query=marine'),
    ('WoRMS','https://www.marinespecies.org/rest/AphiaRecordsByName/Delphinus?like=false&marine_only=true'),
    ('Argo GDAC','https://data-argo.ifremer.fr/index.html'),
    ('Global Fishing Watch','https://gateway.api.globalfishingwatch.org/v3/datasets'),
]

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, original_name, stored_name, dataset_type, source, status, size_bytes, created_at FROM datasets ORDER BY id').fetchall()

files_on_disk = {p.name for p in dataset_dir.glob('*') if p.is_file()}
files_in_db = {str(r['stored_name']) for r in rows if r['stored_name']}
orphans = sorted(files_on_disk - files_in_db)

source_counts = {}
mismatches = []
rows_to_delete = []
files_to_delete = set()

for r in rows:
    rid = int(r['id'])
    src = str(r['source'] or 'Unknown').strip() or 'Unknown'
    src_stats = source_counts.setdefault(src, {'total':0,'verified':0,'unverified':0,'missing_file':0})
    src_stats['total'] += 1

    stored = str(r['stored_name'] or '')
    file_exists = bool(stored) and (dataset_dir / stored).exists()
    source_ok = norm(src) in verified_sources
    ok = file_exists and source_ok

    if ok:
        src_stats['verified'] += 1
    else:
        src_stats['unverified'] += 1
        reason = []
        if not file_exists:
            src_stats['missing_file'] += 1
            reason.append('missing_file')
        if not source_ok:
            reason.append('unverified_source')
        mismatches.append({'id':rid,'stored_name':stored,'original_name':r['original_name'],'source':src,'status':r['status'],'reason':','.join(reason)})
        rows_to_delete.append(rid)
        if file_exists:
            files_to_delete.add(stored)

for f in orphans:
    mismatches.append({'id':None,'stored_name':f,'original_name':None,'source':None,'status':None,'reason':'orphan_file'})

probe = []
for name, url in checks:
    status = 'fail'
    code = None
    note = ''
    req = urllib.request.Request(url, method='GET', headers={'User-Agent':'Nerexis-Verification-Audit/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = int(getattr(resp, 'status', 200))
            status = 'pass' if 200 <= code < 400 else 'fail'
            note = f'http_{code}'
    except urllib.error.HTTPError as e:
        code = int(e.code)
        status = 'pass' if 200 <= code < 400 else 'fail'
        note = f'http_{code}'
    except Exception as e:
        note = str(e)[:160]
    probe.append({'source':name,'status':status,'http_code':code,'api_url':url,'note':note})

if rows_to_delete:
    q = ','.join('?' for _ in rows_to_delete)
    conn.execute(f'DELETE FROM datasets WHERE id IN ({q})', rows_to_delete)
    conn.commit()
conn.close()

for fname in sorted(files_to_delete.union(set(orphans))):
    fp = dataset_dir / fname
    if fp.exists() and fp.is_file():
        fp.unlink()

conn2 = sqlite3.connect(db_path)
after_count = int(conn2.execute('SELECT COUNT(*) FROM datasets').fetchone()[0])
conn2.close()

ts = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d_%H%M%S')
report = {
    'generated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'totals': {
        'db_rows_before': len(rows),
        'db_rows_deleted': len(rows_to_delete),
        'db_rows_after': after_count,
        'orphan_files_deleted': len(orphans),
        'linked_files_deleted': len(files_to_delete),
        'mismatch_count': len(mismatches),
    },
    'grouped_counts_by_source': dict(sorted(source_counts.items(), key=lambda kv: kv[0].lower())),
    'mismatches': mismatches,
    'source_api_probe': probe,
}

json_path = audit_dir / f'dataset_verification_report_{ts}.json'
source_csv = audit_dir / f'dataset_source_counts_{ts}.csv'
probe_csv = audit_dir / f'source_api_probe_{ts}.csv'
mismatch_csv = audit_dir / f'dataset_mismatches_{ts}.csv'

json_path.write_text(json.dumps(report, indent=2), encoding='utf-8')

with source_csv.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['source','total','verified','unverified','missing_file'])
    w.writeheader()
    for src, vals in dict(sorted(source_counts.items(), key=lambda kv: kv[0].lower())).items():
        w.writerow({'source':src, **vals})

with probe_csv.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['source','status','http_code','api_url','note'])
    w.writeheader()
    for row in probe:
        w.writerow(row)

with mismatch_csv.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['id','stored_name','original_name','source','status','reason'])
    w.writeheader()
    for row in mismatches:
        w.writerow(row)

print('REPORT_JSON=' + str(json_path))
print('REPORT_SOURCE_CSV=' + str(source_csv))
print('REPORT_PROBE_CSV=' + str(probe_csv))
print('REPORT_MISMATCH_CSV=' + str(mismatch_csv))
print('DB_ROWS_BEFORE=' + str(len(rows)))
print('DB_ROWS_DELETED=' + str(len(rows_to_delete)))
print('DB_ROWS_AFTER=' + str(after_count))
print('ORPHAN_FILES_DELETED=' + str(len(orphans)))
print('LINKED_FILES_DELETED=' + str(len(files_to_delete)))
print('API_PASS=' + str(sum(1 for x in probe if x['status']=='pass')))
print('API_FAIL=' + str(sum(1 for x in probe if x['status']=='fail')))

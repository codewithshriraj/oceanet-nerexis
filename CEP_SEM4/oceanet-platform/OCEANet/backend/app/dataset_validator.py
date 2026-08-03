"""
Dataset Validation and Deduplication Module
============================================
Provides comprehensive validation and deduplication for oceanographic datasets.
- Detects duplicate datasets using content hashing and fuzzy matching
- Validates data quality (structure, completeness, authenticity)
- Filters out fake/synthetic data
- Ensures only verified sources are accepted
"""

import hashlib
import json
import csv
import io
import os
import re
import math
import tarfile
import zipfile
from datetime import datetime
from typing import Any, Optional, Tuple, Set
from collections import defaultdict
import statistics


class DatasetValidator:
    """Validates dataset authenticity, quality, and uniqueness."""

    TEXT_BASED_EXTENSIONS = {'.csv', '.txt', '.json', '.geojson', '.md'}
    BINARY_CONTAINER_EXTENSIONS = {'.zip', '.parquet', '.nc', '.nc4', '.h5', '.hdf5', '.tar', '.gz', '.bz2', '.xz', '.7z'}
    
    # Quality thresholds
    MIN_ROWS_FOR_VALID_CSV = 10
    MIN_COLUMNS_FOR_VALID_CSV = 2
    MAX_NULL_RATIO = 0.5  # Max 50% null values allowed
    MIN_NUMERIC_PRECISION = 100  # Precision decimal places
    
    # Known fake data patterns
    FAKE_PATTERNS = {
        r'test\s*data': re.IGNORECASE,
        r'dummy\s*data': re.IGNORECASE,
        r'sample\s*file': re.IGNORECASE,
        r'lorem\s*ipsum': re.IGNORECASE,
        r'fake.*dataset': re.IGNORECASE,
        r'^xxx+$': re.IGNORECASE,
        r'^zzz+$': re.IGNORECASE,
    }
    
    # Verified oceanographic/environmental keywords
    VERIFIED_KEYWORDS = {
        # Oceanographic
        'temperature', 'salinity', 'ph', 'dissolved oxygen', 'pressure',
        'depth', 'latitude', 'longitude', 'timestamp', 'date', 'time',
        'wave', 'current', 'tide', 'ocean', 'marine', 'sea', 'water',
        'species', 'abundance', 'observation', 'catch', 'biomass',
        
        # Environmental
        'climate', 'carbon', 'co2', 'greenhouse', 'emission', 'temperature',
        'precipitation', 'wind', 'air quality', 'pollution', 'ecosystem',
        'biodiversity', 'habitat', 'conservation', 'species distribution',
        
        # Station/Source identifiers
        'station', 'buoy', 'argo', 'float', 'satellite', 'sensor',
        'noaa', 'gbif', 'obis', 'inaturalist', 'nasa', 'wmo',
    }
    
    # Sources that are verified genuine
    VERIFIED_SOURCES = {
        'noaa', 'nasa', 'open-meteo', 'gbif', 'inaturalist', 'obis',
        'noaa-erddap', 'nasa-daac', 'emodnet-biology', 'worms', 'gfw',
        'argo', 'cmds', 'kaggle', 'github'
    }

    @classmethod
    def build_trust_profile(
        cls,
        *,
        source: str,
        file_type: str,
        size_bytes: int,
        filename: str,
        quality_metrics: Optional[dict[str, Any]] = None,
        accepted: bool = True,
        rejection_reason: str = '',
    ) -> dict[str, Any]:
        score = 45
        notes: list[str] = []
        normalized_source = source.lower().strip()
        normalized_type = file_type.lower().strip()

        if accepted:
            score += 20
            notes.append('Passed structural validation checks')
        else:
            score -= 25
            if rejection_reason:
                notes.append(rejection_reason)

        if normalized_source in cls.VERIFIED_SOURCES:
            score += 20
            notes.append(f'Source {normalized_source} is in the verified-source allowlist')
        elif normalized_source == 'manual':
            score += 5
            notes.append('Manual upload accepted after authenticity and quality screening')

        if normalized_type in cls.BINARY_CONTAINER_EXTENSIONS:
            score += 10
            notes.append(f'Archive/container signature validated for {normalized_type}')

        if normalized_type in cls.TEXT_BASED_EXTENSIONS:
            score += 5
            notes.append(f'Text dataset parsed successfully as {normalized_type}')

        if size_bytes >= 1024 * 1024 * 1024:
            score += 10
            notes.append('Archive-sized dataset volume detected')
        elif size_bytes >= 1024 * 1024 * 25:
            score += 6
            notes.append('Substantial file size suggests non-trivial source data')

        keyword_matches = cls._keyword_match_count(filename)
        if keyword_matches > 0:
            score += min(8, keyword_matches)
            notes.append('Oceanographic or biodiversity terms detected in file metadata')

        metrics = quality_metrics or {}
        if 'rows' in metrics:
            rows = int(metrics.get('rows') or 0)
            if rows >= 1000:
                score += 8
                notes.append('Tabular dataset contains at least 1,000 rows')
            elif rows >= cls.MIN_ROWS_FOR_VALID_CSV:
                score += 4
                notes.append('Tabular dataset exceeds the minimum row threshold')

        if 'items' in metrics:
            items = int(metrics.get('items') or 0)
            if items >= 1000:
                score += 8
                notes.append('JSON dataset contains at least 1,000 records')
            elif items >= cls.MIN_ROWS_FOR_VALID_CSV:
                score += 4
                notes.append('JSON dataset exceeds the minimum item threshold')

        if 'null_ratio' in metrics:
            null_ratio = float(metrics.get('null_ratio') or 0.0)
            if null_ratio <= 0.15:
                score += 6
                notes.append('Low null ratio indicates good field completeness')
            elif null_ratio <= cls.MAX_NULL_RATIO:
                score += 2
                notes.append('Null ratio remains within the allowed threshold')

        bounded_score = max(0, min(100, score))
        return {
            'trust_score': bounded_score,
            'validation_notes': notes[:6],
        }

    @classmethod
    def _keyword_match_count(cls, text: str) -> int:
        lowered = text.lower()
        return sum(1 for keyword in cls.VERIFIED_KEYWORDS if keyword in lowered)

    @classmethod
    def _archive_looks_domain_relevant(cls, file_path: str, filename: str, file_type: str) -> bool:
        ext = file_type.lower()
        if cls._keyword_match_count(filename) > 0:
            return True

        try:
            if ext == '.zip' and zipfile.is_zipfile(file_path):
                with zipfile.ZipFile(file_path, 'r') as archive:
                    names = ' '.join(archive.namelist()[:200])
                    return cls._keyword_match_count(names) > 0

            if ext == '.tar' and tarfile.is_tarfile(file_path):
                with tarfile.open(file_path, 'r') as archive:
                    names = ' '.join(member.name for member in archive.getmembers()[:200])
                    return cls._keyword_match_count(names) > 0
        except Exception:
            return False

        return False
    
    @staticmethod
    def compute_content_hash(content: bytes) -> str:
        """Compute SHA256 hash of content for exact duplicate detection."""
        return hashlib.sha256(content).hexdigest()

    @staticmethod
    def compute_file_content_hash(file_path: str) -> str:
        digest = hashlib.sha256()
        with open(file_path, 'rb') as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024 * 4), b''):
                digest.update(chunk)
        return digest.hexdigest()
    
    @staticmethod
    def compute_semantic_hash(content: bytes, file_type: str) -> str:
        """
        Compute a canonical semantic hash for duplicate detection.
        The hash is resilient to delimiter differences, header casing,
        whitespace, and row-order changes in tabular datasets.
        """
        try:
            ext = file_type.lower()
            if ext in {'.csv', '.txt'}:
                semantic_payload = DatasetValidator._build_csv_semantic_payload(content)
            elif ext in {'.json', '.geojson'}:
                semantic_payload = DatasetValidator._build_json_semantic_payload(content)
            else:
                semantic_payload = {
                    'type': ext or 'binary',
                    'size': len(content),
                    'head': content[:2048].hex(),
                    'tail': content[-1024:].hex() if len(content) > 1024 else content.hex(),
                }

            hash_input = json.dumps(semantic_payload, sort_keys=True, separators=(',', ':'))
            return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        except Exception:
            return hashlib.sha256(content).hexdigest()

    @staticmethod
    def compute_file_semantic_hash(file_path: str, file_type: str) -> str:
        try:
            size_bytes = os.path.getsize(file_path)
            max_read_bytes = 1024 * 1024 * 8

            with open(file_path, 'rb') as handle:
                if size_bytes <= max_read_bytes:
                    sampled = handle.read()
                else:
                    head = handle.read(1024 * 1024 * 3)
                    mid_offset = max(0, (size_bytes // 2) - (1024 * 1024))
                    handle.seek(mid_offset)
                    middle = handle.read(1024 * 1024 * 2)
                    handle.seek(max(0, size_bytes - (1024 * 1024 * 3)))
                    tail = handle.read(1024 * 1024 * 3)
                    sampled = head + middle + tail

            if file_type.lower() in DatasetValidator.TEXT_BASED_EXTENSIONS:
                return DatasetValidator.compute_semantic_hash(sampled, file_type)

            signature = f"{file_type.lower()}::{size_bytes}::{sampled[:2048].hex()}::{sampled[-1024:].hex()}"
            return hashlib.sha256(signature.encode('utf-8')).hexdigest()
        except Exception:
            return hashlib.sha256(file_path.encode('utf-8')).hexdigest()

    @staticmethod
    def _normalize_header_cell(value: str) -> str:
        normalized = re.sub(r'[^a-z0-9]+', '_', (value or '').strip().lower())
        normalized = normalized.strip('_')
        return normalized or 'col'

    @staticmethod
    def _normalize_data_cell(value: Any) -> str:
        raw = str(value if value is not None else '').strip()
        if not raw:
            return ''

        lowered = raw.lower()
        if lowered in {'nan', 'na', 'null', 'none', 'n/a'}:
            return ''

        numeric_candidate = re.sub(r',', '', raw)
        try:
            number = float(numeric_candidate)
            if not math.isfinite(number):
                return lowered
            # 10 significant digits preserves signal while reducing formatting noise.
            return f"{number:.10g}"
        except Exception:
            return re.sub(r'\s+', ' ', lowered)

    @classmethod
    def _build_csv_semantic_payload(cls, content: bytes) -> dict[str, Any]:
        text = content.decode('utf-8', errors='ignore')
        if not text.strip():
            return {'type': 'csv', 'rows': 0, 'columns': 0, 'schema': []}

        lines = [line for line in text.splitlines() if line and not line.strip().startswith('#')]
        if not lines:
            return {'type': 'csv', 'rows': 0, 'columns': 0, 'schema': []}

        sanitized = '\n'.join(lines)
        sample = sanitized[:8192]
        delimiter = ','
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
            delimiter = getattr(dialect, 'delimiter', ',') or ','
        except Exception:
            counts = {d: sample.count(d) for d in [',', ';', '\t', '|']}
            best = max(counts, key=counts.get)
            delimiter = best if counts.get(best, 0) > 0 else ','

        rows = list(csv.reader(io.StringIO(sanitized), delimiter=delimiter))
        rows = [row for row in rows if any(str(cell).strip() for cell in row)]
        if not rows:
            return {'type': 'csv', 'rows': 0, 'columns': 0, 'schema': []}

        header = [cls._normalize_header_cell(cell) for cell in rows[0]]
        data_rows = rows[1:]

        row_hashes: list[str] = []
        null_cells = 0
        total_cells = 0
        for row in data_rows[:5000]:
            normalized = [
                cls._normalize_data_cell(row[idx] if idx < len(row) else '')
                for idx in range(len(header))
            ]
            null_cells += sum(1 for cell in normalized if not cell)
            total_cells += len(normalized)
            row_repr = '|'.join(normalized)
            row_hashes.append(hashlib.sha1(row_repr.encode('utf-8')).hexdigest()[:16])

        row_hashes.sort()
        return {
            'type': 'csv',
            'columns': len(header),
            'rows': len(data_rows),
            'schema': header,
            'null_ratio': round((null_cells / total_cells), 6) if total_cells else 0.0,
            'row_hash_sample': row_hashes[:400],
            'row_hash_unique': len(set(row_hashes)),
        }

    @classmethod
    def _canonicalize_json_value(cls, value: Any, depth: int = 0) -> Any:
        if depth >= 6:
            return str(type(value).__name__)

        if isinstance(value, dict):
            return {
                str(k): cls._canonicalize_json_value(v, depth + 1)
                for k, v in sorted(value.items(), key=lambda item: str(item[0]))[:200]
            }

        if isinstance(value, list):
            if not value:
                return []
            items = [cls._canonicalize_json_value(item, depth + 1) for item in value[:800]]
            return items

        if isinstance(value, (int, float)):
            if isinstance(value, float) and not math.isfinite(value):
                return None
            return cls._normalize_data_cell(value)

        if value is None:
            return None

        return cls._normalize_data_cell(value)

    @classmethod
    def _build_json_semantic_payload(cls, content: bytes) -> dict[str, Any]:
        try:
            parsed = json.loads(content.decode('utf-8', errors='ignore'))
        except Exception:
            return {
                'type': 'json',
                'parseable': False,
                'head': content[:2048].hex(),
                'size': len(content),
            }

        canonical = cls._canonicalize_json_value(parsed)

        if isinstance(parsed, list):
            schema: list[str] = []
            if parsed and isinstance(parsed[0], dict):
                keys = sorted({str(k) for item in parsed[:1000] if isinstance(item, dict) for k in item.keys()})
                schema = keys[:200]
            return {
                'type': 'json-array',
                'items': len(parsed),
                'schema': schema,
                'canonical': canonical,
            }

        if isinstance(parsed, dict):
            return {
                'type': 'json-object',
                'keys': sorted(list(parsed.keys()))[:300],
                'canonical': canonical,
            }

        return {
            'type': f"json-{type(parsed).__name__}",
            'canonical': canonical,
        }

    @classmethod
    def validate_binary_container(cls, file_path: str, file_type: str) -> Tuple[bool, str, dict[str, Any]]:
        try:
            size_bytes = os.path.getsize(file_path)
            if size_bytes <= 0:
                return False, 'File is empty', {}

            with open(file_path, 'rb') as handle:
                head = handle.read(16)
                handle.seek(max(0, size_bytes - 4))
                tail = handle.read(4)

            ext = file_type.lower()
            valid = True
            reason = 'Valid archive/scientific dataset container'

            if ext == '.zip':
                valid = head.startswith((b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'))
                reason = 'ZIP signature check failed' if not valid else reason
            elif ext == '.parquet':
                valid = head.startswith(b'PAR1') or tail == b'PAR1'
                reason = 'Parquet signature check failed' if not valid else reason
            elif ext in {'.h5', '.hdf5'}:
                valid = head.startswith(b'\x89HDF\r\n\x1a\n')
                reason = 'HDF5 signature check failed' if not valid else reason
            elif ext == '.nc':
                valid = head.startswith(b'CDF') or head.startswith(b'\x89HDF\r\n\x1a\n')
                reason = 'NetCDF signature check failed' if not valid else reason
            elif ext == '.gz':
                valid = head.startswith(b'\x1f\x8b')
                reason = 'GZip signature check failed' if not valid else reason
            elif ext == '.bz2':
                valid = head.startswith(b'BZh')
                reason = 'BZip2 signature check failed' if not valid else reason
            elif ext == '.xz':
                valid = head.startswith(b'\xfd7zXZ\x00')
                reason = 'XZ signature check failed' if not valid else reason
            elif ext == '.7z':
                valid = head.startswith(b'7z\xbc\xaf\x27\x1c')
                reason = '7z signature check failed' if not valid else reason
            elif ext == '.tar':
                valid = tarfile.is_tarfile(file_path)
                reason = 'TAR structure check failed' if not valid else reason

            metrics = {
                'type': 'binary-container',
                'size_bytes': size_bytes,
                'extension': ext,
            }
            return valid, reason if not valid else 'Valid', metrics
        except Exception as exc:
            return False, f'Binary validation error: {str(exc)}', {}

    @classmethod
    def validate_dataset_file(
        cls,
        file_path: str,
        filename: str,
        source: str,
        file_type: str,
    ) -> Tuple[bool, str, dict[str, Any]]:
        size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        details = {
            'content_hash': cls.compute_file_content_hash(file_path) if size_bytes else '',
            'semantic_hash': cls.compute_file_semantic_hash(file_path, file_type) if size_bytes else '',
            'file_type': file_type,
            'source': source,
            'size_bytes': size_bytes,
        }

        try:
            with open(file_path, 'rb') as handle:
                preview = handle.read(2048)
        except Exception as exc:
            details['validation_status'] = 'REJECTED_IO'
            return False, f'Unable to read uploaded file: {str(exc)}', details

        if source.lower() == 'manual' and file_type.lower() in cls.BINARY_CONTAINER_EXTENSIONS:
            if not cls._archive_looks_domain_relevant(file_path, filename, file_type):
                details['validation_status'] = 'REJECTED_RELEVANCE'
                return False, 'Rejected: archive filename/content could not be verified as oceanographic or biodiversity related', details

        is_fake, fake_reason = cls.detect_fake_data(preview, filename, source)
        if is_fake:
            details['validation_status'] = 'REJECTED_FAKE'
            return False, f'Rejected: {fake_reason}', details

        if file_type.lower() in {'.csv', '.txt'}:
            with open(file_path, 'rb') as handle:
                sample = handle.read(1024 * 1024 * 2)
            is_valid, reason, metrics = cls.validate_csv_quality(sample)
            details['quality_metrics'] = metrics
        elif file_type.lower() in {'.json', '.geojson'}:
            with open(file_path, 'rb') as handle:
                sample = handle.read(1024 * 1024 * 2)
            is_valid, reason, metrics = cls.validate_json_quality(sample)
            details['quality_metrics'] = metrics
        elif file_type.lower() in cls.BINARY_CONTAINER_EXTENSIONS:
            is_valid, reason, metrics = cls.validate_binary_container(file_path, file_type)
            details['quality_metrics'] = metrics
        else:
            is_valid, reason = True, 'File type not explicitly validated'

        if is_valid:
            details['validation_status'] = 'APPROVED'
            details.update(
                cls.build_trust_profile(
                    source=source,
                    file_type=file_type,
                    size_bytes=size_bytes,
                    filename=filename,
                    quality_metrics=details.get('quality_metrics'),
                    accepted=True,
                )
            )
            return True, 'Valid and genuine', details

        details['validation_status'] = 'REJECTED_QUALITY'
        details.update(
            cls.build_trust_profile(
                source=source,
                file_type=file_type,
                size_bytes=size_bytes,
                filename=filename,
                quality_metrics=details.get('quality_metrics'),
                accepted=False,
                rejection_reason=f'Failed quality check: {reason}',
            )
        )
        return False, f'Failed quality check: {reason}', details
    
    @classmethod
    def validate_csv_quality(cls, content: bytes) -> Tuple[bool, str, dict[str, Any]]:
        """
        Validate CSV data quality.
        Returns: (is_valid, reason, metrics)
        """
        try:
            text = content.decode('utf-8', errors='ignore')
            if not text.strip():
                return False, "CSV content is empty", {}
            
            # Strip leading comment lines common in government/research CSV formats (e.g. NOAA GML uses # prefixes)
            lines = text.splitlines()
            data_lines = [l for l in lines if not l.strip().startswith('#')]
            text = '\n'.join(data_lines)
            if not text.strip():
                return False, "CSV content is empty after stripping comment lines", {}

            # Auto-detect delimiter to support comma/semicolon/tab/pipe formatted datasets.
            sample = text[:8192]
            delimiters = [',', ';', '\t', '|']
            delimiter = ','
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=''.join(delimiters))
                delimiter = getattr(dialect, 'delimiter', ',') or ','
            except Exception:
                counts = {d: sample.count(d) for d in delimiters}
                best = max(counts, key=counts.get)
                delimiter = best if counts.get(best, 0) > 0 else ','

            parsed_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
            if not parsed_rows:
                return False, "CSV has no data rows", {}

            # Drop completely empty lines that can appear in exported files.
            parsed_rows = [row for row in parsed_rows if any(str(cell).strip() for cell in row)]
            if not parsed_rows:
                return False, "CSV has no data rows", {}

            fieldnames = [str(col).strip() for col in parsed_rows[0]]
            rows = parsed_rows[1:]
            
            if not rows:
                return False, "CSV has no data rows", {}
            
            if len(rows) < cls.MIN_ROWS_FOR_VALID_CSV:
                return False, f"CSV has only {len(rows)} rows (minimum: {cls.MIN_ROWS_FOR_VALID_CSV})", {}

            if len(fieldnames) < cls.MIN_COLUMNS_FOR_VALID_CSV:
                return False, f"CSV has only {len(fieldnames)} columns (minimum: {cls.MIN_COLUMNS_FOR_VALID_CSV})", {}
            
            # Check for null/empty values
            total_cells = len(rows) * len(fieldnames)
            null_count = 0
            numeric_count = 0

            for row in rows:
                normalized_row = list(row[:len(fieldnames)])
                if len(normalized_row) < len(fieldnames):
                    normalized_row.extend([''] * (len(fieldnames) - len(normalized_row)))
                for value in normalized_row:
                    if value is None or str(value).strip() == '':
                        null_count += 1
                    try:
                        float(value)
                        numeric_count += 1
                    except:
                        pass
            
            null_ratio = null_count / total_cells if total_cells > 0 else 0
            
            if null_ratio > cls.MAX_NULL_RATIO:
                return False, f"CSV has {null_ratio:.1%} null values (max: {cls.MAX_NULL_RATIO:.0%})", {}
            
            metrics = {
                'rows': len(rows),
                'columns': len(fieldnames),
                'null_ratio': null_ratio,
                'numeric_ratio': numeric_count / total_cells if total_cells > 0 else 0,
                'fieldnames': fieldnames,
                'delimiter': delimiter,
            }
            
            return True, "Valid", metrics
        
        except Exception as e:
            return False, f"CSV parsing error: {str(e)}", {}
    
    @classmethod
    def validate_json_quality(cls, content: bytes) -> Tuple[bool, str, dict[str, Any]]:
        """
        Validate JSON data quality.
        Returns: (is_valid, reason, metrics)
        """
        try:
            text = content.decode('utf-8', errors='ignore')
            data = json.loads(text)
            
            if isinstance(data, dict):
                if not data:
                    return False, "JSON object is empty", {}
                
                metrics = {
                    'type': 'object',
                    'keys': len(data),
                    'key_names': list(data.keys())[:20]
                }
                return True, "Valid", metrics
            
            elif isinstance(data, list):
                if len(data) < cls.MIN_ROWS_FOR_VALID_CSV:
                    return False, f"JSON array has only {len(data)} items (minimum: {cls.MIN_ROWS_FOR_VALID_CSV})", {}
                
                first_item_keys = set()
                if data and isinstance(data[0], dict):
                    first_item_keys = set(data[0].keys())
                
                metrics = {
                    'type': 'array',
                    'items': len(data),
                    'first_item_keys': list(first_item_keys)[:20]
                }
                return True, "Valid", metrics
            else:
                return False, f"JSON root is {type(data).__name__}, expected object or array", {}
        
        except json.JSONDecodeError as e:
            return False, f"JSON parsing error: {str(e)}", {}
        except Exception as e:
            return False, f"Unexpected error: {str(e)}", {}
    
    @classmethod
    def detect_fake_data(cls, content: bytes, filename: str, source: str) -> Tuple[bool, str]:
        """
        Detect if dataset appears to be fake or dummy data.
        Returns: (is_fake, reason)
        """
        try:
            # Check filename for fake patterns
            filename_lower = filename.lower()
            for pattern in cls.FAKE_PATTERNS:
                if re.search(pattern, filename_lower):
                    return True, f"Filename matches fake pattern: {pattern}"
            
            # Check content preview for fake patterns
            text_preview = content[:2000].decode('utf-8', errors='ignore').lower()
            for pattern in cls.FAKE_PATTERNS:
                if re.search(pattern, text_preview):
                    return True, f"Content matches fake pattern: {pattern}"
            
            # For verified sources, assume authentic
            if source.lower() in cls.VERIFIED_SOURCES:
                return False, "Source is verified"
            
            # Check for oceanographic keywords in unverified sources
            if source.lower() == 'manual':
                text_lower = (filename + ' ' + text_preview).lower()
                keyword_matches = sum(
                    1 for keyword in cls.VERIFIED_KEYWORDS
                    if keyword in text_lower
                )
                
                if keyword_matches == 0:
                    return True, "No oceanographic keywords found in unverified manual source"
            
            return False, "Appears genuine"
        
        except Exception as e:
            return False, f"Could not determine authenticity: {str(e)}"
    
    @classmethod
    def validate_dataset(
        cls,
        content: bytes,
        filename: str,
        source: str,
        file_type: str
    ) -> Tuple[bool, str, dict[str, Any]]:
        """
        Comprehensive dataset validation.
        Returns: (is_valid, reason, details)
        """
        details = {
            'content_hash': cls.compute_content_hash(content),
            'semantic_hash': cls.compute_semantic_hash(content, file_type),
            'file_type': file_type,
            'source': source,
            'size_bytes': len(content),
        }
        
        # Check for fake data first
        is_fake, fake_reason = cls.detect_fake_data(content, filename, source)
        if is_fake:
            details['validation_status'] = 'REJECTED_FAKE'
            details.update(
                cls.build_trust_profile(
                    source=source,
                    file_type=file_type,
                    size_bytes=len(content),
                    filename=filename,
                    accepted=False,
                    rejection_reason=f'Rejected: {fake_reason}',
                )
            )
            return False, f"Rejected: {fake_reason}", details
        
        # Validate based on file type
        if file_type.lower() in {'.csv', '.txt'}:
            is_valid, reason, metrics = cls.validate_csv_quality(content)
            details['quality_metrics'] = metrics
        elif file_type.lower() in {'.json', '.geojson'}:
            is_valid, reason, metrics = cls.validate_json_quality(content)
            details['quality_metrics'] = metrics
        else:
            is_valid, reason = True, "File type not explicitly validated"
        
        if is_valid:
            details['validation_status'] = 'APPROVED'
            details.update(
                cls.build_trust_profile(
                    source=source,
                    file_type=file_type,
                    size_bytes=len(content),
                    filename=filename,
                    quality_metrics=details.get('quality_metrics'),
                    accepted=True,
                )
            )
            return True, "Valid and genuine", details
        else:
            details['validation_status'] = 'REJECTED_QUALITY'
            details.update(
                cls.build_trust_profile(
                    source=source,
                    file_type=file_type,
                    size_bytes=len(content),
                    filename=filename,
                    quality_metrics=details.get('quality_metrics'),
                    accepted=False,
                    rejection_reason=f'Failed quality check: {reason}',
                )
            )
            return False, f"Failed quality check: {reason}", details


class DatasetDeduplicator:
    """Detects and removes duplicate datasets."""
    
    def __init__(self):
        self.content_hashes: dict[str, list[str]] = defaultdict(list)  # hash -> [dataset_ids]
        self.semantic_hashes: dict[str, list[str]] = defaultdict(list)  # hash -> [dataset_ids]
        self.datasets_metadata: dict[str, dict[str, Any]] = {}  # dataset_id -> metadata
    
    def register_dataset(
        self,
        dataset_id: str,
        content: bytes,
        filename: str,
        file_type: str,
        source: str,
        created_at: str
    ) -> dict[str, Any]:
        """Register a dataset and check for duplicates."""
        
        validator = DatasetValidator()
        content_hash = validator.compute_content_hash(content)
        semantic_hash = validator.compute_semantic_hash(content, file_type)
        
        # Check for exact duplicates
        exact_duplicates = self.content_hashes.get(content_hash, [])
        semantic_duplicates = self.semantic_hashes.get(semantic_hash, [])
        
        duplicate_info = {
            'is_duplicate': len(exact_duplicates) > 0 or len(semantic_duplicates) > 0,
            'exact_duplicates': exact_duplicates,
            'semantic_duplicates': semantic_duplicates,
            'content_hash': content_hash,
            'semantic_hash': semantic_hash,
        }
        
        # Register this dataset
        self.content_hashes[content_hash].append(dataset_id)
        self.semantic_hashes[semantic_hash].append(dataset_id)
        
        self.datasets_metadata[dataset_id] = {
            'filename': filename,
            'file_type': file_type,
            'source': source,
            'created_at': created_at,
            'size_bytes': len(content),
            'content_hash': content_hash,
            'semantic_hash': semantic_hash,
        }
        
        return duplicate_info
    
    def get_duplicates_to_remove(self) -> dict[str, list[str]]:
        """
        Identify which datasets should be removed as duplicates.
        Keeps the first occurrence, removes later ones.
        Returns: {reason: [dataset_ids_to_remove]}
        """
        to_remove = {'exact_duplicates': [], 'semantic_duplicates': []}
        
        # Find exact duplicates
        for content_hash, dataset_ids in self.content_hashes.items():
            if len(dataset_ids) > 1:
                # Keep first, remove rest
                to_remove['exact_duplicates'].extend(dataset_ids[1:])
        
        # Find semantic duplicates (excluding already marked exact duplicates)
        exact_dup_set = set(to_remove['exact_duplicates'])
        for semantic_hash, dataset_ids in self.semantic_hashes.items():
            if len(dataset_ids) > 1:
                # Filter out already marked exact duplicates
                filtered_ids = [d for d in dataset_ids if d not in exact_dup_set]
                if len(filtered_ids) > 1:
                    # Keep first, remove rest
                    to_remove['semantic_duplicates'].extend(filtered_ids[1:])
        
        return to_remove
    
    def get_statistics(self) -> dict[str, Any]:
        """Get deduplication statistics."""
        return {
            'total_unique_content_hashes': len(self.content_hashes),
            'total_unique_semantic_hashes': len(self.semantic_hashes),
            'total_datasets_registered': len(self.datasets_metadata),
            'exact_duplicate_groups': sum(1 for ids in self.content_hashes.values() if len(ids) > 1),
            'semantic_duplicate_groups': sum(1 for ids in self.semantic_hashes.values() if len(ids) > 1),
        }


# Utility functions for integration

def validate_before_ingestion(
    content: bytes,
    filename: str,
    source: str,
    file_type: str
) -> Tuple[bool, str]:
    """
    Quick validation before ingesting a dataset.
    Returns: (should_ingest, message)
    """
    is_valid, reason, details = DatasetValidator.validate_dataset(
        content, filename, source, file_type
    )
    return is_valid, reason


def check_for_duplicate(
    content: bytes,
    existing_hashes: dict[str, list[str]]
) -> Tuple[bool, Optional[str]]:
    """
    Check if content matches any existing dataset.
    Returns: (is_duplicate, duplicate_id)
    """
    content_hash = DatasetValidator.compute_content_hash(content)
    semantic_hash = DatasetValidator.compute_semantic_hash(content, '')
    
    if content_hash in existing_hashes.get('content', {}):
        return True, existing_hashes['content'][content_hash][0]
    
    if semantic_hash in existing_hashes.get('semantic', {}):
        return True, existing_hashes['semantic'][semantic_hash][0]
    
    return False, None

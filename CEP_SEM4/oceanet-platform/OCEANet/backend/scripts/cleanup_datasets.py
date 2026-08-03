#!/usr/bin/env python3
"""
Dataset Cleanup and Deduplication Script
=========================================
Scans all existing datasets and removes duplicates and fakes.
Usage:
    python -m scripts.cleanup_datasets --analyze-only  # Just report what would be deleted
    python -m scripts.cleanup_datasets --execute        # Actually delete duplicates/fakes
"""

import os
import sys
import json
import sqlite3
import hashlib
import argparse
from pathlib import Path
from collections import defaultdict
from datetime import datetime
from typing import Any, Tuple

# Add backend app to path
BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.dataset_validator import DatasetValidator, DatasetDeduplicator

class DatasetCleanupManager:
    def __init__(self, data_root: str):
        self.data_root = data_root
        self.datasets_dir = os.path.join(data_root, 'datasets')
        self.db_path = os.path.join(data_root, 'nerexis_auth.db')
        self.validator = DatasetValidator()
        self.deduplicator = DatasetDeduplicator()
        
        # Statistics
        self.stats = {
            'total_files': 0,
            'readable_files': 0,
            'fake_datasets': [],
            'duplicate_datasets': [],
            'invalid_datasets': [],
            'valid_datasets': [],
            'errors': [],
        }
    
    def list_all_datasets(self) -> dict[str, dict[str, Any]]:
        """List all datasets from database."""
        datasets = {}
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT id, original_name, stored_name, source, dataset_type, mime_type, size_bytes, status, created_at FROM datasets"
            )
            
            for row in cursor:
                dataset_id = str(row['id'])
                datasets[dataset_id] = {
                    'id': dataset_id,
                    'original_name': row['original_name'],
                    'stored_name': row['stored_name'],
                    'source': row['source'],
                    'dataset_type': row['dataset_type'],
                    'mime_type': row['mime_type'],
                    'size_bytes': row['size_bytes'],
                    'status': row['status'],
                    'created_at': row['created_at'],
                }
            
            conn.close()
        except Exception as e:
            self.stats['errors'].append(f"Database error: {str(e)}")
        
        return datasets
    
    def analyze_datasets(self) -> dict[str, Any]:
        """Analyze all datasets for duplicates, fakes, and validity."""
        
        datasets = self.list_all_datasets()
        total = len(datasets)
        
        print(f"\n{'='*80}")
        print(f"Dataset Cleanup Analysis")
        print(f"{'='*80}")
        print(f"Total datasets in database: {total}")
        print(f"Scanning for duplicates, fakes, and quality issues...\n")
        
        processed = 0
        
        for dataset_id, metadata in datasets.items():
            processed += 1
            if processed % 100 == 0:
                print(f"  Progress: {processed}/{total} ({100*processed//total}%)")
            
            stored_name = metadata['stored_name']
            file_path = os.path.join(self.datasets_dir, stored_name)
            
            # Try to read file
            try:
                with open(file_path, 'rb') as f:
                    content = f.read()
                self.stats['readable_files'] += 1
            except Exception as e:
                self.stats['errors'].append(f"Cannot read {stored_name}: {str(e)}")
                self.stats['total_files'] += 1
                continue
            
            self.stats['total_files'] += 1
            original_name = metadata['original_name']
            source = metadata['source']
            file_type = os.path.splitext(original_name)[1]
            
            # Validate dataset
            is_valid, reason, details = self.validator.validate_dataset(
                content, original_name, source, file_type
            )
            
            # Check for fakes first
            is_fake, fake_reason = self.validator.detect_fake_data(content, original_name, source)
            
            if is_fake:
                self.stats['fake_datasets'].append({
                    'id': dataset_id,
                    'name': original_name,
                    'reason': fake_reason,
                    'file_path': file_path,
                    'size_bytes': metadata['size_bytes'],
                })
                continue
            
            # Check for duplicates
            dup_context = self.deduplicator.register_dataset(
                dataset_id, content, original_name, file_type, source, metadata['created_at']
            )
            
            if dup_context['is_duplicate']:
                self.stats['duplicate_datasets'].append({
                    'id': dataset_id,
                    'name': original_name,
                    'exact_duplicates': dup_context['exact_duplicates'],
                    'semantic_duplicates': dup_context['semantic_duplicates'],
                    'file_path': file_path,
                    'size_bytes': metadata['size_bytes'],
                })
                continue
            
            # Check validity
            if not is_valid:
                self.stats['invalid_datasets'].append({
                    'id': dataset_id,
                    'name': original_name,
                    'reason': reason,
                    'file_path': file_path,
                    'size_bytes': metadata['size_bytes'],
                })
                continue
            
            # Valid dataset
            self.stats['valid_datasets'].append({
                'id': dataset_id,
                'name': original_name,
                'size_bytes': metadata['size_bytes'],
                'source': source,
            })
        
        print(f"\n{'='*80}")
        print(f"Analysis Complete")
        print(f"{'='*80}\n")
        
        return self._generate_report()
    
    def _generate_report(self) -> dict[str, Any]:
        """Generate cleanup report."""
        
        fakes_count = len(self.stats['fake_datasets'])
        duplicates_count = len(self.stats['duplicate_datasets'])
        invalid_count = len(self.stats['invalid_datasets'])
        valid_count = len(self.stats['valid_datasets'])
        total_removable = fakes_count + duplicates_count + invalid_count
        
        print(f"  Total Datasets Analyzed:     {self.stats['total_files']:>6}")
        print(f"  Successfully Read:           {self.stats['readable_files']:>6}")
        print(f"\n  [VALID] Valid & Genuine:           {valid_count:>6}")
        print(f"  [FAKE] FAKE Datasets:             {fakes_count:>6}")
        print(f"  [DUP] DUPLICATE Datasets:        {duplicates_count:>6}")
        print(f"  [ERR] Invalid/Poor Quality:      {invalid_count:>6}")
        print(f"  {'-'*40}")
        print(f"  TOTAL TO DELETE:             {total_removable:>6}")
        
        if fakes_count > 0:
            print(f"\n  [FAKE] FAKE DATASETS ({fakes_count}):")
            for item in self.stats['fake_datasets'][:10]:
                print(f"      - {item['name']}: {item['reason']}")
            if fakes_count > 10:
                print(f"      ... and {fakes_count - 10} more")
        
        if duplicates_count > 0:
            print(f"\n  [DUP] DUPLICATE DATASETS ({duplicates_count}):")
            for item in self.stats['duplicate_datasets'][:10]:
                print(f"      - {item['name']}")
                if item['exact_duplicates']:
                    print(f"        Exact duplicates: {item['exact_duplicates'][:3]}")
                if item['semantic_duplicates']:
                    print(f"        Semantic duplicates: {item['semantic_duplicates'][:3]}")
            if duplicates_count > 10:
                print(f"      ... and {duplicates_count - 10} more")
        
        if invalid_count > 0:
            print(f"\n  [ERR] INVALID/POOR QUALITY ({invalid_count}):")
            for item in self.stats['invalid_datasets'][:10]:
                print(f"      - {item['name']}: {item['reason']}")
            if invalid_count > 10:
                print(f"      ... and {invalid_count - 10} more")
        
        print(f"\n  Deduplication Stats:")
        dup_stats = self.deduplicator.get_statistics()
        print(f"    - Unique content hashes: {dup_stats['total_unique_content_hashes']}")
        print(f"    - Duplicate groups (exact): {dup_stats['exact_duplicate_groups']}")
        print(f"    - Duplicate groups (semantic): {dup_stats['semantic_duplicate_groups']}")
        
        space_saved_mb = (sum(d['size_bytes'] for d in self.stats['fake_datasets']) +
                         sum(d['size_bytes'] for d in self.stats['duplicate_datasets']) +
                         sum(d['size_bytes'] for d in self.stats['invalid_datasets'])) / (1024 * 1024)
        
        print(f"\n  [SPACE] Space that could be freed: {space_saved_mb:.2f} MB")
        
        return {
            'total_analyzed': self.stats['total_files'],
            'valid_count': valid_count,
            'fake_count': fakes_count,
            'duplicate_count': duplicates_count,
            'invalid_count': invalid_count,
            'total_removable': total_removable,
            'space_savings_mb': space_saved_mb,
        }
    
    def cleanup(self, dry_run: bool = True) -> dict[str, Any]:
        """Execute cleanup (remove fake and duplicate datasets)."""
        
        all_to_remove = (
            self.stats['fake_datasets'] +
            self.stats['duplicate_datasets'] +
            self.stats['invalid_datasets']
        )
        
        if not all_to_remove:
            print("\n[CLEAN] No datasets to remove. Your collection is clean!")
            return {'removed': 0, 'errors': 0}
        
        removed_count = 0
        error_count = 0
        
        mode_str = "DRY RUN" if dry_run else "EXECUTING"
        print(f"\n{'='*80}")
        print(f"Dataset Cleanup - {mode_str}")
        print(f"{'='*80}\n")
        
        for item in all_to_remove:
            file_path = item['file_path']
            dataset_id = item['id']
            
            try:
                # Delete file from filesystem
                if not dry_run:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    
                    # Delete from database
                    conn = sqlite3.connect(self.db_path)
                    conn.execute("DELETE FROM datasets WHERE id = ?", (int(dataset_id),))
                    conn.commit()
                    conn.close()
                
                removed_count += 1
                print(f"  [OK] Removed: {item['name']}")
            
            except Exception as e:
                error_count += 1
                print(f"  [ERROR] Error removing {item['name']}: {str(e)}")
        
        print(f"\n{'='*80}")
        print(f"Cleanup Summary")
        print(f"{'='*80}")
        print(f"  Datasets removed: {removed_count}")
        print(f"  Errors: {error_count}")
        print(f"  Mode: {'DRY RUN (no changes made)' if dry_run else 'EXECUTED'}")
        
        return {'removed': removed_count, 'errors': error_count}


def main():
    parser = argparse.ArgumentParser(description='Clean up duplicate and fake datasets')
    parser.add_argument('--data-root', default=None, help='Path to data root (default: auto-detect)')
    parser.add_argument('--analyze-only', action='store_true', help='Only analyze, do not delete')
    parser.add_argument('--execute', action='store_true', help='Execute cleanup (remove datasets)')
    parser.add_argument('--output-report', help='Save report to JSON file')
    
    args = parser.parse_args()
    
    # Determine data root
    if args.data_root:
        data_root = args.data_root
    else:
        # Auto-detect
        backend_root = Path(__file__).parent.parent
        data_root = os.path.join(backend_root, 'data')
    
    if not os.path.exists(data_root):
        print(f"Error: Data root not found: {data_root}")
        sys.exit(1)
    
    manager = DatasetCleanupManager(data_root)
    
    # Analyze
    report = manager.analyze_datasets()
    
    # Save report if requested
    if args.output_report:
        with open(args.output_report, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'report': report,
                'fake_datasets': manager.stats['fake_datasets'],
                'duplicate_datasets': manager.stats['duplicate_datasets'],
                'invalid_datasets': manager.stats['invalid_datasets'],
            }, f, indent=2)
        print(f"\nReport saved to: {args.output_report}")
    
    # Execute cleanup if requested
    if args.execute:
        result = manager.cleanup(dry_run=False)
    elif not args.analyze_only:
        print("\n[WARN] DRY RUN MODE (no datasets were deleted)")
        print("Run with --execute to actually delete duplicates and fakes")
        result = manager.cleanup(dry_run=True)


if __name__ == '__main__':
    main()

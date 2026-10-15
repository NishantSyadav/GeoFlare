"""Safely extract each raw ZIP to its own folder using only the standard library.

Run: python data-pipeline/extract_data.py
Check without writing: python data-pipeline/extract_data.py --verify-only
Existing differing files are reported and never replaced. Loose files are copied,
never moved. Embedded ZIPs are preserved as members, not recursively expanded.
"""
import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import tempfile
import zipfile

CHUNK = 1024 * 1024
REPO = Path(__file__).resolve().parents[1]


def digest(stream):
    size, checksum = 0, hashlib.sha256()
    while chunk := stream.read(CHUNK):
        size += len(chunk)
        checksum.update(chunk)
    return size, checksum.hexdigest()


def file_digest(path):
    with path.open("rb") as stream:
        return digest(stream)


def checked_path(base, parts):
    """Reject links/junctions as well as paths outside the extraction root."""
    base = base.absolute()
    target = base.joinpath(*parts)
    if not target.resolve().is_relative_to(base.resolve()):
        raise ValueError("path escapes destination")
    for path in (target, *target.parents):
        if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
            raise ValueError(f"linked path is not allowed: {path}")
    return target


def member_path(base, info):
    name = info.orig_filename
    parts = PurePosixPath(name).parts
    reserved = {"CON", "PRN", "AUX", "NUL"}
    reserved.update(f"{prefix}{n}" for prefix in ("COM", "LPT") for n in range(1, 10))
    if (not parts or name.startswith("/") or "\\" in name or "\x00" in name
            or any(p in (".", "..") or p.endswith((" ", "."))
                   or any(c in p for c in '<>:"|?*')
                   or any(ord(c) < 32 for c in p)
                   or p.split(".")[0].upper() in reserved for p in parts)):
        raise ValueError(f"unsafe archive path: {name!r}")
    kind = stat.S_IFMT(info.external_attr >> 16)
    if kind not in (0, stat.S_IFREG, stat.S_IFDIR):
        raise ValueError(f"unsupported special member: {name!r}")
    return checked_path(base, parts)


def matches(path, expected):
    return (path.is_file() and path.stat().st_size == expected[0]
            and file_digest(path) == expected)


def publish(stream, target, expected):
    """Validate a temporary file, then install atomically without replacing."""
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".extract-", suffix=".tmp", dir=target.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as out:
            shutil.copyfileobj(stream, out, CHUNK)
        if file_digest(temporary) != expected:
            raise ValueError("size or SHA-256 mismatch while writing")
        # Unlike replace(), link() fails if the destination already exists.
        os.link(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def run(zip_dir, output_dir, verify_only=False):
    archives = sorted(p for p in zip_dir.iterdir()
                      if p.is_file() and p.suffix.lower() == ".zip")
    print(f"ZIPs found: {len(archives)} (expected 11)")
    if len(archives) != 11:
        print("NOTICE: ZIP count differs from the expected 11; using those present.")
    # Index loose regular files by size; hash only plausible candidates.
    loose, cached = {}, {}
    if output_dir.is_dir():
        for path in sorted(output_dir.iterdir()):
            if path.is_file() and not path.is_symlink():
                loose.setdefault(path.stat().st_size, []).append(path)
    totals = dict(already_complete=0, newly_completed=0, incomplete=0,
                  skipped=0, copied=0, extracted=0, issues=0)
    destinations = set()
    for archive in archives:
        counts = dict(skipped=0, copied=0, extracted=0)
        issues, expected_members = [], []
        was_complete = True
        try:
            base = checked_path(output_dir, (archive.stem,))
            key = str(base).casefold()
            if key in destinations:
                raise ValueError("archive destination collides with another ZIP")
            destinations.add(key)
            with zipfile.ZipFile(archive) as source:
                for info in source.infolist():
                    try:
                        target = member_path(base, info)
                        if info.is_dir():
                            expected_members.append((info, target, None))
                            if not target.is_dir():
                                was_complete = False
                                if target.exists():
                                    raise ValueError(f"CONFLICT: {target} is not a directory")
                                if not verify_only:
                                    target.mkdir(parents=True, exist_ok=True)
                            continue
                        # Reading to EOF also checks the ZIP member's stored CRC32.
                        with source.open(info) as stream:
                            expected = digest(stream)
                        if expected[0] != info.file_size:
                            raise ValueError("archive member size mismatch")
                        expected_members.append((info, target, expected))
                        if target.exists():
                            if not matches(target, expected):
                                raise ValueError(f"CONFLICT: differing existing file: {target}")
                            counts["skipped"] += 1
                            continue
                        was_complete = False
                        if verify_only:
                            continue
                        candidate = None
                        for path in loose.get(expected[0], []):
                            if path not in cached:
                                cached[path] = file_digest(path)
                            if cached[path] == expected:
                                candidate = path
                                break
                        if candidate is not None:
                            with candidate.open("rb") as stream:
                                publish(stream, target, expected)
                            counts["copied"] += 1
                        else:
                            with source.open(info) as stream:
                                publish(stream, target, expected)
                            counts["extracted"] += 1
                    except (OSError, ValueError, RuntimeError, EOFError,
                            zipfile.BadZipFile, NotImplementedError) as error:
                        was_complete = False
                        issues.append(f"{info.filename!r}: {error}")
                # Re-read every final file, including reused/skipped members.
                verified = 0
                for info, target, expected in expected_members:
                    try:
                        member_path(base, info)
                        valid = target.is_dir() if expected is None else matches(target, expected)
                        if valid:
                            verified += 1
                        else:
                            issues.append(f"INCOMPLETE: {info.filename!r}")
                    except (OSError, ValueError) as error:
                        issues.append(f"VERIFY: {info.filename!r}: {error}")
                complete = not issues and verified == len(source.infolist())
                print(f"{archive.name}: {'COMPLETE' if complete else 'INCOMPLETE'} "
                      f"{verified}/{len(source.infolist())} members; "
                      f"skipped={counts['skipped']}, copied={counts['copied']}, "
                      f"extracted={counts['extracted']}")
        except (OSError, ValueError, RuntimeError, EOFError, zipfile.BadZipFile) as error:
            complete = False
            issues.append(str(error))
            print(f"{archive.name}: INCOMPLETE")
        for issue in issues:
            print(f"  {issue}")
        totals["issues"] += len(issues)
        totals["already_complete" if complete and was_complete
               else "newly_completed" if complete else "incomplete"] += 1
        for key, value in counts.items():
            totals[key] += value
    print("SUMMARY " + " ".join(f"{key}={value}" for key, value in totals.items()))
    return 1 if totals["incomplete"] or not archives else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--zip-dir", type=Path, default=REPO / "data/raw/zips")
    parser.add_argument("--output-dir", type=Path, default=REPO / "data/raw/extracted")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    try:
        return run(args.zip_dir.absolute(), args.output_dir.absolute(), args.verify_only)
    except OSError as error:
        print(f"ERROR: {error}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


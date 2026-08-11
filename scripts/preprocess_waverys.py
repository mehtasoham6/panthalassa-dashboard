#!/usr/bin/env python3
"""
One-time preprocessing of a Copernicus Marine WAVERYS NetCDF extract
(GLOBAL_MULTIYEAR_WAV_001_032, cmems_mod_glo_wav_my_0.2deg_PT3H-i) at the
representative sea-park point into a compact JSON asset consumed directly by
the dashboard model (src/model/waverys.ts) -- no NetCDF/HDF5 parsing happens
in the browser or in tests.

Usage:
    python3 scripts/preprocess_waverys.py <path-to-file.nc> [output.json]

Requires h5py (the WAVERYS extract is HDF5-based NetCDF4):
    pip3 install h5py

Conversion formula (deep-water incident wave-energy flux):
    waveFluxKWPerM = 0.49 * VHM0^2 * VTM10
Observations where either VHM0 or VTM10 is missing/non-finite are dropped.
"""
import sys
import json
import datetime
import h5py
import numpy as np

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else "src/model/data/waverysSeaPark.json"

    f = h5py.File(in_path, "r")
    lat = float(f["latitude"][0])
    lon = float(f["longitude"][0])
    time_s = f["time"][:]
    vhm0 = f["VHM0"][:, 0, 0].astype(np.float64)
    vtm10 = f["VTM10"][:, 0, 0].astype(np.float64)

    total_count = len(time_s)
    valid = np.isfinite(vhm0) & np.isfinite(vtm10)
    excluded_count = int(total_count - valid.sum())

    time_valid = time_s[valid]
    vhm0_valid = vhm0[valid]
    vtm10_valid = vtm10[valid]

    # Chronological order is required by the file already (verified monotonic
    # increasing on the source extract); assert it here so a future re-run
    # against a different extract fails loudly instead of silently shipping
    # scrambled data.
    if not np.all(np.diff(time_valid) > 0):
        raise ValueError("time is not strictly increasing after filtering -- cannot assume chronological order")

    diffs_hours = np.unique(np.diff(time_valid)) / 3600.0
    if len(diffs_hours) != 1:
        raise ValueError(f"non-uniform sampling interval after filtering: {diffs_hours} hours")
    interval_hours = float(diffs_hours[0])

    flux = 0.49 * vhm0_valid**2 * vtm10_valid
    flux_rounded = np.round(flux, 3)

    mean_flux = float(flux_rounded.mean())

    period_start = datetime.datetime.utcfromtimestamp(float(time_valid.min())).strftime("%Y-%m-%dT%H:%M:%SZ")
    period_end = datetime.datetime.utcfromtimestamp(float(time_valid.max())).strftime("%Y-%m-%dT%H:%M:%SZ")

    data = {
        "source": {
            "product": "GLOBAL_MULTIYEAR_WAV_001_032",
            "dataset": "cmems_mod_glo_wav_my_0.2deg_PT3H-i",
            "provider": "Copernicus Marine Service (CMEMS)",
        },
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "periodStart": period_start,
        "periodEnd": period_end,
        "intervalHours": interval_hours,
        "observationCount": int(valid.sum()),
        "excludedInvalidCount": excluded_count,
        "meanFluxKwPerM": round(mean_flux, 3),
        "fluxKwPerM": [round(float(x), 3) for x in flux_rounded],
    }

    with open(out_path, "w") as out:
        json.dump(data, out)

    print(f"wrote {out_path}")
    print(f"  observations: {data['observationCount']} (excluded {data['excludedInvalidCount']})")
    print(f"  period: {period_start} .. {period_end}, interval {interval_hours}h")
    print(f"  lat/lon: {data['latitude']}, {data['longitude']}")
    print(f"  mean flux: {data['meanFluxKwPerM']} kW/m")

if __name__ == "__main__":
    main()

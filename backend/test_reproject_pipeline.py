import requests
import io
import sys
from pathlib import Path
from astropy.io import fits
from astropy.wcs import WCS
from astropy.stats import sigma_clipped_stats
from photutils.detection import DAOStarFinder
from reproject import reproject_interp
import numpy as np
from astropy.time import Time

sys.path.insert(0, str(Path(__file__).parent))
from app.services import spherex_service

ra = 133.795129
dec = -7.245147
search_res = spherex_service.search_observations(ra, dec, 0.05, collection="spherex_dr1")
obs_list = search_res["observations"]

print("Total observations:", len(obs_list))
obs1 = obs_list[0]
obs2 = obs_list[-1]  # Maximum baseline

print(f"Epoch 1: {obs1['obs_id']}, Date: {obs1['date']}, Band: {obs1['band']}")
print(f"Epoch 2: {obs2['obs_id']}, Date: {obs2['date']}, Band: {obs2['band']}")

# Download / get cutouts
c1 = spherex_service.get_cutout(ra, dec, size=0.1, access_url=obs1["access_url"], obs_id=obs1["obs_id"])
c2 = spherex_service.get_cutout(ra, dec, size=0.1, access_url=obs2["access_url"], obs_id=obs2["obs_id"])

print("Cutout 1 cached path:", c1["obs_metadata"].get("cached_fits_path"))
print("Cutout 2 cached path:", c2["obs_metadata"].get("cached_fits_path"))

path1 = c1["obs_metadata"]["cached_fits_path"]
path2 = c2["obs_metadata"]["cached_fits_path"]

with fits.open(path1) as h1, fits.open(path2) as h2:
    img1 = np.nan_to_num(h1['IMAGE'].data, nan=0.0)
    wcs1 = WCS(h1['IMAGE'].header)
    hdr1 = h1['IMAGE'].header

    img2 = np.nan_to_num(h2['IMAGE'].data, nan=0.0)
    wcs2 = WCS(h2['IMAGE'].header)
    hdr2 = h2['IMAGE'].header

    print("Image 1 shape:", img1.shape)
    print("Image 2 shape:", img2.shape)

    # Reproject img2 onto img1 celestial grid
    reprojected2, footprint = reproject_interp((img2, wcs2), wcs1, shape_out=img1.shape)
    reprojected2 = np.nan_to_num(reprojected2, nan=0.0)
    print("Reprojected 2 shape:", reprojected2.shape)

    # Source detection on img1 and reprojected2
    mean1, med1, std1 = sigma_clipped_stats(img1, sigma=3.0)
    mean2, med2, std2 = sigma_clipped_stats(reprojected2, sigma=3.0)

    dao1 = DAOStarFinder(fwhm=2.5, threshold=2.5 * std1)
    dao2 = DAOStarFinder(fwhm=2.5, threshold=2.5 * std2)

    src1 = dao1(img1 - med1)
    src2 = dao2(reprojected2 - med2)

    cnt1 = len(src1) if src1 is not None else 0
    cnt2 = len(src2) if src2 is not None else 0
    print(f"Sources in Epoch 1: {cnt1}, Sources in Epoch 2 (reprojected): {cnt2}")

    # Match sources by position on the common grid
    if src1 is not None and src2 is not None:
        pts1 = [(row['x_centroid'], row['y_centroid'], row['peak']) for row in src1]
        pts2 = [(row['x_centroid'], row['y_centroid'], row['peak']) for row in src2]

        t1_str = hdr1.get('DATE-OBS', '2025-05-05T16:48:02')
        t2_str = hdr2.get('DATE-OBS', '2026-05-14T06:53:35')
        t1 = Time(t1_str)
        t2 = Time(t2_str)
        dt_yr = max(abs((t2 - t1).jd) / 365.25, 0.001)
        print(f"Time baseline between FITS headers: {dt_yr:.4f} years")

        matches = []
        for i, p1 in enumerate(pts1):
            best_d = float('inf')
            best_j = -1
            for j, p2 in enumerate(pts2):
                d = np.hypot(p2[0] - p1[0], p2[1] - p1[1])
                if d < best_d:
                    best_d = d
                    best_j = j
            if best_j >= 0 and best_d < 15.0:
                pix_scale = 6.15  # arcsec/pixel
                disp_arcsec = best_d * pix_scale
                speed = disp_arcsec / dt_yr
                matches.append({
                    "src1_idx": i,
                    "x1": float(p1[0]), "y1": float(p1[1]),
                    "x2": float(pts2[best_j][0]), "y2": float(pts2[best_j][1]),
                    "disp_px": float(best_d),
                    "disp_arcsec": float(disp_arcsec),
                    "speed_arcsec_yr": float(speed),
                })
        print(f"Matched sources: {len(matches)}")
        for m in matches[:5]:
            print(f"  Match: ({m['x1']:.1f}, {m['y1']:.1f}) -> ({m['x2']:.1f}, {m['y2']:.1f}), disp: {m['disp_arcsec']:.2f} arcsec, speed: {m['speed_arcsec_yr']:.2f} arcsec/yr")


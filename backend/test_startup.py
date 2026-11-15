"""Test that uvicorn can start the COSMIC LENS app."""
import sys, os, subprocess, time

backend_dir = r"c:\Users\Amrutha\Desktop\SPHERE X\backend"
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"],
    cwd=backend_dir,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
)
time.sleep(4)
proc.terminate()
out, _ = proc.communicate(timeout=5)
print(out)
if "Application startup complete" in out or "Started server process" in out or "Uvicorn running" in out:
    print("STARTUP SUCCESS")
else:
    print("STARTUP OUTPUT (check above for errors)")

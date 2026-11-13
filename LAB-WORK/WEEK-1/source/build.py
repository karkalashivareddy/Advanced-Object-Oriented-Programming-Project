import os
import shutil
import subprocess
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
CS4 = os.path.normpath(os.path.join(REPO, "case-studies", "case-study-4", "doc", "screenshots"))
CS5 = os.path.normpath(os.path.join(REPO, "case-studies", "case-study-5", "doc", "screenshots"))
SHOTS = os.path.join(HERE, "screenshots")
HTML = os.path.join(HERE, "report.html")
PDF = os.path.normpath(os.path.join(ROOT, "Case-Study-4-5-Report.pdf"))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

FILES = {
    "vscode-run.png": CS4,
    "terminal-q5.png": CS4,
    "vscode-editor-cs5.png": CS5,
    "terminal-cs5-top-crop.png": CS5,
    "terminal-cs5-bottom-crop.png": CS5,
}


def copy_assets():
    os.makedirs(SHOTS, exist_ok=True)
    for name, folder in FILES.items():
        shutil.copy2(os.path.join(folder, name), os.path.join(SHOTS, name))


def main():
    copy_assets()
    if os.path.exists(PDF):
        os.remove(PDF)
    cmd = [
        EDGE,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=8000",
        f"--print-to-pdf={PDF}",
        "file:///" + HTML.replace("\\", "/"),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(PDF):
        print(result.stdout, result.stderr)
        sys.exit("PDF was not created")

    doc = pymupdf.open(PDF)
    doc.set_metadata({
        "title": "Case Study 4 and 5 - K. Shiva Reddy",
        "author": "K. Shiva Reddy (2520030105)",
        "subject": "Advanced Object Oriented Programming - Case Study 4 and 5",
        "creator": "K. Shiva Reddy",
    })
    tmp = PDF + ".tmp"
    doc.save(tmp, garbage=3, deflate=True)
    doc.close()
    os.replace(tmp, PDF)
    print("pages:", len(pymupdf.open(PDF)))
    print("pdf:", PDF)


if __name__ == "__main__":
    main()

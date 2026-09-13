"""
CINEM PRO — bulk test-user generator + Supabase seeder + credentials PDF.

What it does
------------
1. Generates N unique users (realistic name, unique email, US-format WhatsApp,
   strong unique password, country = Pakistan mostly).
2. Creates each one in Supabase Auth (auth.users) via the admin API, with
   email pre-confirmed, and upserts the matching public.profiles row.
3. Writes:
     - CINEMPRO_Users_Credentials.pdf   (professional table)
     - CINEMPRO_Users_Credentials.csv   (backup, same data)

Setup
-----
    pip install requests reportlab

    # set your SERVICE ROLE key (Supabase → Settings → API → service_role).
    # DO NOT hardcode it or commit it.
    Windows (PowerShell):
        $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ...the_service_role_key..."
    macOS/Linux:
        export SUPABASE_SERVICE_ROLE_KEY="eyJ...the_service_role_key..."

Run
---
    python seed_users.py

Notes
-----
* The service_role key bypasses RLS — keep it secret, run this locally only.
* For very large batches (e.g. 10,000) raise USER_COUNT, but expect it to take
  a while and possibly hit auth rate limits; the script retries and continues.
"""

from __future__ import annotations

import csv
import os
import random
import string
import sys
import time

import requests

# ── Config ─────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gevhtxmsamqvdiypiwbb.supabase.co").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

USER_COUNT = 500          # change to 10000 for a larger batch
PAKISTAN_RATIO = 0.85     # ~85% Pakistan, rest mixed
REQUEST_PAUSE = 0.05      # seconds between API calls (be gentle on auth)
MAX_RETRIES = 3

PDF_PATH = "CINEMPRO_Users_Credentials.pdf"
CSV_PATH = "CINEMPRO_Users_Credentials.csv"

# ── Name pools (realistic mix; Pakistani-leaning + international) ───────
FIRST_NAMES = [
    "Ali", "Ahmed", "Hassan", "Hussain", "Bilal", "Usman", "Hamza", "Saad", "Zain", "Faisal",
    "Imran", "Kamran", "Tariq", "Asad", "Adnan", "Rizwan", "Salman", "Junaid", "Waqas", "Noman",
    "Ayesha", "Fatima", "Maryam", "Sana", "Hira", "Iqra", "Mahnoor", "Zara", "Areeba", "Noor",
    "Sara", "Amna", "Komal", "Rabia", "Sadia", "Nimra", "Laiba", "Aleena", "Eman", "Mehwish",
    "Daniel", "Sofia", "Liam", "Olivia", "Noah", "Emma", "Lucas", "Mia", "Omar", "Layla",
]
LAST_NAMES = [
    "Khan", "Ahmed", "Ali", "Malik", "Sheikh", "Butt", "Chaudhry", "Qureshi", "Hussain", "Iqbal",
    "Raza", "Javed", "Aslam", "Farooq", "Nawaz", "Riaz", "Younis", "Bhatti", "Awan", "Saleem",
    "Smith", "Garcia", "Rossi", "Cruz", "Tanaka", "Mwangi", "Lin", "Park", "Hassan", "Aziz",
]

COUNTRIES_OTHER = ["India", "UAE", "USA", "UK", "Saudi Arabia", "Canada"]

PASSWORD_CHARS = string.ascii_letters + string.digits + "!@#$%&*"


# ── Generators ─────────────────────────────────────────────────────────
def strong_password() -> str:
    """8-10 chars, guaranteed upper/lower/digit/symbol."""
    length = random.randint(8, 10)
    base = [
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(string.digits),
        random.choice("!@#$%&*"),
    ]
    base += [random.choice(PASSWORD_CHARS) for _ in range(length - 4)]
    random.shuffle(base)
    return "".join(base)


def us_whatsapp() -> str:
    """US format: +1 (NXX) NXX-XXXX (area/exchange first digit 2-9)."""
    area = f"{random.randint(2,9)}{random.randint(0,9)}{random.randint(0,9)}"
    exch = f"{random.randint(2,9)}{random.randint(0,9)}{random.randint(0,9)}"
    line = f"{random.randint(0,9999):04d}"
    return f"+1 ({area}) {exch}-{line}"


def build_users(n: int) -> list[dict]:
    users, used_emails = [], set()
    for i in range(1, n + 1):
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        # unique email: userNNNNN@gmail.com (index + random suffix)
        while True:
            email = f"user{i:05d}{random.randint(10, 99)}@gmail.com"
            if email not in used_emails:
                used_emails.add(email)
                break
        country = "Pakistan" if random.random() < PAKISTAN_RATIO else random.choice(COUNTRIES_OTHER)
        users.append({
            "serial": i,
            "name": name,
            "email": email,
            "password": strong_password(),
            "whatsapp": us_whatsapp(),
            "country": country,
        })
    return users


# ── Supabase insertion ─────────────────────────────────────────────────
def admin_headers() -> dict:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def create_auth_user(u: dict) -> str | None:
    """Creates the auth user (email pre-confirmed). Returns the new user id."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    body = {
        "email": u["email"],
        "password": u["password"],
        "email_confirm": True,
        "user_metadata": {"name": u["name"], "whatsapp": u["whatsapp"], "country": u["country"]},
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.post(url, json=body, headers=admin_headers(), timeout=20)
            if r.status_code in (200, 201):
                return r.json().get("id")
            # 422 usually means the email already exists — skip, not fatal.
            if r.status_code == 422:
                print(f"  ! {u['email']} already exists — skipping")
                return None
            print(f"  ! {u['email']} auth error {r.status_code}: {r.text[:120]}")
        except requests.RequestException as e:
            print(f"  ! {u['email']} network error (try {attempt}): {e}")
        time.sleep(0.5 * attempt)
    return None


def upsert_profile(user_id: str, u: dict) -> None:
    """Safety net: ensure the public.profiles row exists (trigger may also do this)."""
    url = f"{SUPABASE_URL}/rest/v1/profiles?on_conflict=id"
    headers = admin_headers() | {"Prefer": "resolution=merge-duplicates,return=minimal"}
    body = {
        "id": user_id, "name": u["name"], "email": u["email"],
        "whatsapp": u["whatsapp"], "country": u["country"], "status": "active",
    }
    try:
        requests.post(url, json=body, headers=headers, timeout=20)
    except requests.RequestException as e:
        print(f"  ! profile upsert failed for {u['email']}: {e}")


def seed(users: list[dict]) -> list[dict]:
    created = []
    print(f"Creating {len(users)} users in Supabase…")
    for idx, u in enumerate(users, 1):
        uid = create_auth_user(u)
        if uid:
            upsert_profile(uid, u)
            created.append(u)
        if idx % 25 == 0:
            print(f"  …{idx}/{len(users)} processed ({len(created)} created)")
        time.sleep(REQUEST_PAUSE)
    print(f"Done. {len(created)} users created.")
    return created


# ── Output files ───────────────────────────────────────────────────────
def write_csv(users: list[dict]) -> None:
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Serial", "Full Name", "Email", "Password", "WhatsApp", "Country"])
        for i, u in enumerate(users, 1):
            w.writerow([i, u["name"], u["email"], u["password"], u["whatsapp"], u["country"]])
    print(f"Wrote {CSV_PATH}")


def write_pdf(users: list[dict]) -> None:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,
    )

    NEON = colors.HexColor("#0f8b86")
    DARK = colors.HexColor("#0a141a")
    LIGHT = colors.HexColor("#eafbfa")

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"], fontName="Helvetica-Bold",
        fontSize=20, textColor=NEON, spaceAfter=2,
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"], fontSize=9,
        textColor=colors.HexColor("#5a7d7b"), spaceAfter=12,
    )
    cell = ParagraphStyle("cell", parent=styles["Normal"], fontSize=8, leading=10)

    doc = SimpleDocTemplate(
        PDF_PATH, pagesize=A4,
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
        title="CINEM PRO User Credentials",
    )

    elements = [
        Paragraph("CINEM PRO — User Credentials", title_style),
        Paragraph(
            f"Personal Intelligent Cyber Assistant &nbsp;•&nbsp; {len(users)} accounts "
            f"&nbsp;•&nbsp; Generated {time.strftime('%Y-%m-%d %H:%M')}",
            sub_style,
        ),
        Spacer(1, 4),
    ]

    header = ["#", "Full Name", "Email", "Password", "WhatsApp"]
    data = [header]
    for i, u in enumerate(users, 1):
        data.append([
            str(i),
            Paragraph(u["name"], cell),
            Paragraph(u["email"], cell),
            Paragraph(f"<b>{u['password']}</b>", cell),
            Paragraph(u["whatsapp"], cell),
        ])

    table = Table(
        data,
        colWidths=[10 * mm, 38 * mm, 52 * mm, 30 * mm, 36 * mm],
        repeatRows=1,
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("TEXTCOLOR", (0, 0), (-1, 0), NEON),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b9dedb")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(table)

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#9ab8b6"))
        canvas.drawRightString(A4[0] - 12 * mm, 8 * mm, f"Page {_doc.page}")
        canvas.drawString(12 * mm, 8 * mm, "CINEM PRO — Confidential")
        canvas.restoreState()

    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {PDF_PATH}")


# ── Main ───────────────────────────────────────────────────────────────
def main() -> int:
    random.seed()  # nondeterministic
    users = build_users(USER_COUNT)

    if not SERVICE_ROLE_KEY:
        print("WARNING: SUPABASE_SERVICE_ROLE_KEY not set — generating files WITHOUT inserting.")
        print("         Set the env var and re-run to actually create the accounts.\n")
        created = users  # still produce the credential files for review
    else:
        created = seed(users)
        if not created:
            print("No users were created; writing the generated list for reference.")
            created = users

    write_csv(created)
    write_pdf(created)
    print("\nAll done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

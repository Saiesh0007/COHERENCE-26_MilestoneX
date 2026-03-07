import sqlite3


def main() -> None:
    conn = sqlite3.connect("backend/database/clinical_trial.db")
    cur = conn.cursor()

    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    print("Tables:", ", ".join(tables))

    for label, table in [
        ("users", "users"),
        ("patients", "patients"),
        ("trials", "clinical_trials"),
        ("matches", "trial_matches"),
        ("submissions", "submission_logs"),
    ]:
        count = cur.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"{label}: {count}")

    conn.close()


if __name__ == "__main__":
    main()


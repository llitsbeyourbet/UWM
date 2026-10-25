import os, time, requests, subprocess, json, pathlib, traceback
BASE = os.environ["UWM_BACKEND_URL"].rstrip("/") + "/api/admin/internal/training"
TOKEN = os.environ["MODERATION_WORKER_TOKEN"]
HEADERS = {"x-training-token": TOKEN}
ROOT = pathlib.Path(__file__).resolve().parent
def post(path, payload=None):
    r = requests.post(BASE + path, json=payload or {}, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()
def status(jid, state, **kw): post(f"/{jid}/status", {"status": state, **kw})
while True:
    try:
        data = post("/claim")
        if not data.get("jobId"):
            time.sleep(int(os.getenv("POLL_SECONDS", "60")))
            continue
        jid = data["jobId"]
        try:
            # Only train when human-reviewed contextual examples exist for every new word.
            path = ROOT / "job_words.json"
            path.write_text(json.dumps(data["words"], ensure_ascii=False), encoding="utf-8")
            status(jid, "training")
            subprocess.run(["python", "train_incremental.py", str(jid)], check=True)
            status(jid, "evaluating")
            metrics = json.loads((ROOT / "outputs" / str(jid) / "metrics.json").read_text())
            if not metrics["passed"]: raise RuntimeError("Evaluation threshold not met: " + str(metrics))
            # Completed means candidate artifact produced, NOT deployed to live moderation.
            status(jid, "completed", modelVersion=f"candidate-job-{jid}")
        except Exception as e:
            print(traceback.format_exc(), flush=True)
            try: status(jid, "failed", errorMessage=str(e))
            except Exception: print("Could not report failure", flush=True)
    except Exception:
        print(traceback.format_exc(), flush=True)
        time.sleep(60)

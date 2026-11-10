
import os
import sys
import time
import json
import pathlib
import requests
import subprocess
import traceback
import signal

BASE = (
    os.environ["UWM_BACKEND_URL"].rstrip("/")
    + "/api/admin/internal/training"
)
TOKEN = os.environ["MODERATION_WORKER_TOKEN"]

HEADERS = {"x-training-token": TOKEN}
ROOT = pathlib.Path(__file__).resolve().parent

BATCH_SIZE = 30
ALLOWED_LABELS = {"profanity", "insult", "sexual", "spam"}

HEARTBEAT_SECONDS = max(
    5, int(os.getenv("HEARTBEAT_SECONDS", "30"))
)


class LeaseLostError(Exception):
    pass


def request_headers(lease_token=None):
    headers = dict(HEADERS)

    if lease_token:
        headers["x-training-lease"] = lease_token

    return headers


def post(path, payload=None, lease_token=None):
    response = requests.post(
        BASE + path,
        json=payload if payload is not None else {},
        headers=request_headers(lease_token),
        timeout=30,
    )

    if response.status_code == 409 and lease_token:
        raise LeaseLostError(
            f"Lease rejected by Backend: {path}"
        )

    response.raise_for_status()
    return response.json()


def get(path):
    response = requests.get(
        BASE + path,
        headers=HEADERS,
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def status(job_id, state, lease_token, **kwargs):
    return post(
        f"/{job_id}/status",
        {"status": state, **kwargs},
        lease_token=lease_token,
    )


def heartbeat(job_id, lease_token):
    return post(
        f"/{job_id}/heartbeat",
        lease_token=lease_token,
    )


def write_json_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = path.with_suffix(path.suffix + ".tmp")

    temporary_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    temporary_path.replace(path)


def validate_examples(examples):
    if not isinstance(examples, list):
        raise ValueError("Training examples must be a list")

    if len(examples) != BATCH_SIZE:
        raise ValueError(
            f"Expected {BATCH_SIZE} examples, "
            f"received {len(examples)}"
        )

    cleaned = []
    seen = set()

    for item in examples:
        if not isinstance(item, dict):
            raise ValueError("Invalid training example")

        text = item.get("text")
        label = item.get("label")

        if not isinstance(text, str) or not text.strip():
            raise ValueError("Training example text is empty")

        if not isinstance(label, str) or label not in ALLOWED_LABELS:
            raise ValueError(f"Invalid training label: {label}")

        text = text.strip()

        if text in seen:
            raise ValueError("Duplicate training example")

        seen.add(text)
        cleaned.append({
            "text": text,
            "label": label,
        })

    return cleaned


def sync_completed_jobs(current_job_id):
    data = get("/completed")
    jobs = data.get("jobs")

    if not isinstance(jobs, list):
        raise ValueError("Invalid completed jobs response")

    completed_ids = set()

    for job in jobs:
        if not isinstance(job, dict):
            raise ValueError("Invalid completed job")

        job_id = job.get("jobId")

        if type(job_id) is not int or job_id <= 0:
            raise ValueError("Invalid completed job ID")

        if job_id >= current_job_id:
            continue

        if job_id in completed_ids:
            raise ValueError(
                f"Duplicate completed job ID: {job_id}"
            )

        examples = validate_examples(
            job.get("examples")
        )

        completed_ids.add(job_id)
        job_dir = ROOT / "jobs" / str(job_id)

        write_json_atomic(
            job_dir / "examples.json",
            examples,
        )

        write_json_atomic(
            job_dir / "completed.json",
            {
                "job_id": job_id,
                "model_version": job.get("modelVersion"),
                "passed": True,
            },
        )

    jobs_root = ROOT / "jobs"

    if jobs_root.exists():
        for job_dir in jobs_root.iterdir():
            if not job_dir.is_dir():
                continue

            if not job_dir.name.isdigit():
                continue

            job_id = int(job_dir.name)

            if job_id >= current_job_id:
                continue

            marker = job_dir / "completed.json"

            if marker.is_file() and job_id not in completed_ids:
                marker.unlink()

    print(
        f"Synced {len(completed_ids)} "
        "completed jobs from Backend",
        flush=True,
    )


def stop_training_process(process):
    if process.poll() is not None:
        return

    print(
        "Stopping training subprocess...",
        flush=True,
    )

    if os.name == "nt":
        # Windows: หยุด Python ที่ฝึกโมเดล
        # และกระบวนการลูกที่อาจถูกสร้างขึ้น
        subprocess.run(
            [
                "taskkill",
                "/PID",
                str(process.pid),
                "/T",
                "/F",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    else:
        process.terminate()

        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()

    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def run_training_with_heartbeat(job_id, lease_token):
    command = [
        sys.executable,
        str(ROOT / "train_incremental.py"),
        str(job_id),
    ]

    process = subprocess.Popen(
        command,
        cwd=str(ROOT),
    )

    print(
        f"Job {job_id}: training started",
        flush=True,
    )

    next_heartbeat = time.monotonic()

    try:
        while True:
            return_code = process.poll()

            if return_code is not None:
                if return_code != 0:
                    raise subprocess.CalledProcessError(
                        return_code,
                        command,
                    )
                break

            if time.monotonic() >= next_heartbeat:
                try:
                    heartbeat(job_id, lease_token)

                    print(
                        f"Job {job_id}: heartbeat OK",
                        flush=True,
                    )

                except LeaseLostError:
                    print(
                        f"Job {job_id}: lease lost",
                        flush=True,
                    )
                    raise

                except requests.HTTPError as error:
                    response = error.response

                    if (
                        response is not None
                        and response.status_code in (401, 403)
                    ):
                        raise LeaseLostError(
                            "Worker authentication rejected"
                        ) from error

                    print(
                        f"Job {job_id}: heartbeat HTTP error: "
                        f"{error}",
                        flush=True,
                    )

                except requests.RequestException as error:
                    print(
                        f"Job {job_id}: heartbeat network "
                        f"error: {error}",
                        flush=True,
                    )

                next_heartbeat = (
                    time.monotonic() + HEARTBEAT_SECONDS
                )

            time.sleep(1)

    finally:
        stop_training_process(process)

    print(
        f"Job {job_id}: training finished",
        flush=True,
    )


def process_job(data):
    job_id = data.get("jobId")
    lease_token = data.get("leaseToken")

    if (
        type(job_id) is not int
        or job_id <= 0
        or not isinstance(lease_token, str)
        or not lease_token
    ):
        raise ValueError(
            "Invalid job ID or missing lease token"
        )

    backend_completed = False

    try:
        examples = validate_examples(
            data.get("examples")
        )

        job_dir = ROOT / "jobs" / str(job_id)

        write_json_atomic(
            job_dir / "examples.json",
            examples,
        )

        print(
            f"Job {job_id}: received "
            f"{len(examples)} examples",
            flush=True,
        )

        sync_completed_jobs(job_id)

        status(
            job_id,
            "training",
            lease_token,
        )

        run_training_with_heartbeat(
            job_id,
            lease_token,
        )

        status(
            job_id,
            "evaluating",
            lease_token,
        )

        metrics_path = (
            ROOT / "outputs" / str(job_id) / "metrics.json"
        )

        if not metrics_path.is_file():
            raise FileNotFoundError(
                f"Training metrics not found: {metrics_path}"
            )

        metrics = json.loads(
            metrics_path.read_text(encoding="utf-8")
        )

        if not metrics.get("passed", False):
            raise RuntimeError(
                f"Evaluation threshold not met: {metrics}"
            )

        model_version = f"candidate-job-{job_id}"

        status(
            job_id,
            "completed",
            lease_token,
            modelVersion=model_version,
        )

        backend_completed = True

        write_json_atomic(
            job_dir / "completed.json",
            {
                "job_id": job_id,
                "model_version": model_version,
                "passed": True,
            },
        )

        print(
            f"Job {job_id}: completed",
            flush=True,
        )

    except LeaseLostError as error:
        # ห้ามรายงาน failed เพราะ Job อาจถูกมอบ
        # ให้ Worker ตัวอื่นไปแล้ว
        print(
            f"Job {job_id}: stopped - {error}",
            flush=True,
        )

    except requests.RequestException as error:
        # เครือข่ายขัดข้อง ไม่เปลี่ยนสถานะ Job
        # ปล่อยให้ Lease หมดอายุและกู้คืนภายหลัง
        print(
            f"Job {job_id}: network error: {error}",
            flush=True,
        )

    except Exception as error:
        print(traceback.format_exc(), flush=True)

        if backend_completed:
            print(
                f"Job {job_id}: already completed",
                flush=True,
            )
            return

        try:
            status(
                job_id,
                "failed",
                lease_token,
                errorMessage=str(error),
            )
        except Exception:
            print(
                f"Job {job_id}: could not report failure",
                flush=True,
            )


def main():
    poll_seconds = max(
        5,
        int(os.getenv("POLL_SECONDS", "60")),
    )

    print(
        "UWM Training Worker started",
        flush=True,
    )

    while True:
        try:
            data = post("/claim")

            if not data.get("jobId"):
                time.sleep(poll_seconds)
                continue

            process_job(data)

        except KeyboardInterrupt:
            print(
                "Training Worker stopped",
                flush=True,
            )
            break

        except Exception:
            print(traceback.format_exc(), flush=True)
            time.sleep(poll_seconds)


if __name__ == "__main__":
    main()

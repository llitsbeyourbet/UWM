
import os
import sys
import json
import pathlib

import numpy as np
import pandas as pd
import torch

from datasets import Dataset
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments,
    DataCollatorWithPadding,
)

ROOT = pathlib.Path(__file__).resolve().parent
JOBS_DIR = ROOT / "jobs"
OUTPUTS_DIR = ROOT / "outputs"

LABELS = ["safe", "profanity", "insult", "sexual", "spam"]
LABEL_TO_ID = {label: i for i, label in enumerate(LABELS)}
BATCH_SIZE = 30


def read_examples(path):
    data = json.loads(path.read_text(encoding="utf-8"))

    if not isinstance(data, list) or len(data) != BATCH_SIZE:
        raise ValueError(f"ข้อมูลใน {path} ต้องมี 30 ประโยค")

    rows = []

    for item in data:
        if not isinstance(item, dict):
            raise ValueError(f"รูปแบบข้อมูลไม่ถูกต้อง: {path}")

        text = item.get("text")
        label = item.get("label")

        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"พบข้อความว่างใน {path}")

        if label not in LABEL_TO_ID:
            raise ValueError(f"Label ไม่ถูกต้อง: {label}")

        rows.append({
            "text": text.strip(),
            "label": label,
        })

    frame = pd.DataFrame(rows)

    if frame["text"].duplicated().any():
        raise ValueError(f"พบประโยคซ้ำใน {path}")

    return frame


def load_accumulated_examples(current_job_id):
    frames = []
    previous_jobs = []

    current_path = (
        JOBS_DIR / str(current_job_id) / "examples.json"
    )

    if not current_path.is_file():
        raise FileNotFoundError(current_path)

    for job_dir in JOBS_DIR.iterdir():
        if not job_dir.is_dir():
            continue

        if not job_dir.name.isdigit():
            continue

        previous_id = int(job_dir.name)

        if previous_id >= current_job_id:
            continue

        # นับเฉพาะ Job ที่ Worker ยืนยัน completed แล้ว
        completed_marker = job_dir / "completed.json"
        examples_path = job_dir / "examples.json"

        if not completed_marker.is_file():
            continue

        if not examples_path.is_file():
            raise FileNotFoundError(examples_path)

        marker = json.loads(
            completed_marker.read_text(encoding="utf-8")
        )

        if marker.get("job_id") != previous_id:
            raise ValueError(
                f"Completed marker ไม่ตรงกับ Job {previous_id}"
            )

        frames.append(read_examples(examples_path))
        previous_jobs.append(previous_id)

    frames.append(read_examples(current_path))

    combined = pd.concat(frames, ignore_index=True)

    conflicts = combined.groupby("text")["label"].nunique()

    if (conflicts > 1).any():
        raise ValueError(
            "พบประโยคเดียวกันแต่มี Label ต่างกัน"
        )

    combined = combined.drop_duplicates(
        subset=["text"]
    ).reset_index(drop=True)

    print(
        f"Previous completed jobs: {sorted(previous_jobs)}",
        flush=True,
    )
    print(
        f"Accumulated examples: {len(combined)}",
        flush=True,
    )

    return combined, sorted(previous_jobs)


def load_base_dataset():
    path = ROOT / "uwm_moderation_dataset_v5.csv"

    base = pd.read_csv(path)

    if not {"text", "label", "split"}.issubset(base.columns):
        raise ValueError(
            "V5 dataset ต้องมี text, label, split"
        )

    if base[["text", "label", "split"]].isna().any().any():
        raise ValueError("V5 dataset มีค่าว่าง")

    base = base.copy()
    base["text"] = base["text"].astype(str).str.strip()

    if base["text"].eq("").any():
        raise ValueError("V5 dataset มีข้อความว่าง")

    if not base["label"].isin(LABELS).all():
        raise ValueError("V5 dataset มี Label ไม่ถูกต้อง")

    if not base["split"].isin(
        ["train", "validation", "test"]
    ).all():
        raise ValueError("V5 dataset มี split ไม่ถูกต้อง")

    return base


def prepare_data(base, extra):
    def split(name):
        return base.loc[
            base["split"] == name,
            ["text", "label"],
        ].copy()

    base_train = split("train")
    validation = split("validation")
    test = split("test")

    if base_train.empty or validation.empty or test.empty:
        raise ValueError("ชุด Train/Validation/Test ต้องไม่ว่าง")

    heldout = set(validation["text"]) | set(test["text"])

    if set(extra["text"]) & heldout:
        raise ValueError(
            "ข้อมูลใหม่ซ้ำกับ Validation หรือ Test"
        )

    if set(base_train["text"]) & heldout:
        raise ValueError(
            "ข้อมูล Train เดิมซ้ำกับ Validation/Test"
        )

    if set(validation["text"]) & set(test["text"]):
        raise ValueError(
            "Validation และ Test มีข้อความซ้ำกัน"
        )

    train = pd.concat(
        [base_train, extra],
        ignore_index=True,
    )

    conflicts = train.groupby("text")["label"].nunique()

    if (conflicts > 1).any():
        raise ValueError(
            "ข้อความใน Train มี Label ขัดแย้งกัน"
        )

    train = train.drop_duplicates(
        subset=["text"]
    ).reset_index(drop=True)

    return train, validation, test


def encode_dataset(frame, tokenizer):
    data = frame.copy()
    data["labels"] = data["label"].map(LABEL_TO_ID)

    dataset = Dataset.from_pandas(
        data[["text", "labels"]],
        preserve_index=False,
    )

    return dataset.map(
        lambda batch: tokenizer(
            batch["text"],
            truncation=True,
            max_length=128,
        ),
        batched=True,
        remove_columns=["text"],
    )


def calculate_metrics(prediction):
    predictions = np.argmax(
        prediction.predictions,
        axis=-1,
    )

    return {
        "f1_macro": float(
            f1_score(
                prediction.label_ids,
                predictions,
                labels=list(range(len(LABELS))),
                average="macro",
                zero_division=0,
            )
        ),
        "accuracy": float(
            accuracy_score(
                prediction.label_ids,
                predictions,
            )
        ),
    }


def main():
    if len(sys.argv) != 2:
        raise ValueError(
            "Usage: python train_incremental.py <job_id>"
        )

    job_id = int(sys.argv[1])

    if job_id <= 0:
        raise ValueError("Invalid Job ID")

    if not torch.cuda.is_available():
        raise RuntimeError("ไม่พบ CUDA GPU")

    print(
        "GPU:", torch.cuda.get_device_name(0),
        flush=True,
    )

    extra, previous_jobs = load_accumulated_examples(job_id)
    base = load_base_dataset()

    train, validation, test = prepare_data(base, extra)

    print(
        f"Train={len(train)}, "
        f"Validation={len(validation)}, "
        f"Test={len(test)}",
        flush=True,
    )

    model_path = pathlib.Path(
        os.getenv(
            "BASE_TRAINED_MODEL_PATH",
            str(ROOT / "model_v5"),
        )
    )

    if not model_path.is_dir():
        raise FileNotFoundError(model_path)

    tokenizer = AutoTokenizer.from_pretrained(
        str(model_path),
        use_fast=False,
    )

    model = AutoModelForSequenceClassification.from_pretrained(
        str(model_path),
        num_labels=len(LABELS),
    )

    train_ds = encode_dataset(train, tokenizer)
    val_ds = encode_dataset(validation, tokenizer)
    test_ds = encode_dataset(test, tokenizer)

    output_dir = OUTPUTS_DIR / str(job_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=int(os.getenv("EPOCHS", "3")),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={
            "use_reentrant": False
        },
        fp16=True,
        learning_rate=2e-5,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        report_to="none",
        save_total_limit=2,
        optim="adamw_torch",
        dataloader_pin_memory=False,
    )

    collator = DataCollatorWithPadding(tokenizer)

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        compute_metrics=calculate_metrics,
        data_collator=collator,
    )

    # ประเมิน V5 เดิมบน Validation
    baseline_val = calculate_metrics(
        trainer.predict(val_ds)
    )

    # ประเมิน V5 เดิมบน Test เพื่อรายงาน
    baseline_test = calculate_metrics(
        trainer.predict(test_ds)
    )

    print(
        "Baseline validation Macro F1:",
        baseline_val["f1_macro"],
        flush=True,
    )

    # เริ่ม Fine-tuning จาก V5 เดิม
    trainer.train()

    final_val = calculate_metrics(
        trainer.predict(val_ds)
    )

    final_test = calculate_metrics(
        trainer.predict(test_ds)
    )

    min_f1 = float(
        os.getenv("MIN_VALIDATION_MACRO_F1", "0.0")
    )

    # ใช้ Validation ตัดสินผ่าน/ไม่ผ่าน
    passed = (
        final_val["f1_macro"]
        >= baseline_val["f1_macro"]
        and final_val["f1_macro"] >= min_f1
    )

    report = {
        "job_id": job_id,
        "previous_jobs": previous_jobs,
        "accumulated_examples": len(extra),
        "train_samples": len(train),
        "validation_samples": len(validation),
        "test_samples": len(test),
        "baseline_validation_macro_f1": baseline_val["f1_macro"],
        "validation_macro_f1": final_val["f1_macro"],
        "baseline_test_macro_f1": baseline_test["f1_macro"],
        "test_macro_f1": final_test["f1_macro"],
        "test_accuracy": final_test["accuracy"],
        "minimum_validation_macro_f1": min_f1,
        "passed": bool(passed),
    }

    (output_dir / "metrics.json").write_text(
        json.dumps(
            report,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    # เก็บ Candidate แยกจากโมเดล V5 เดิม
    candidate_dir = output_dir / "model"

    trainer.save_model(str(candidate_dir))
    tokenizer.save_pretrained(str(candidate_dir))

    print(
        json.dumps(
            report,
            indent=2,
            ensure_ascii=False,
        ),
        flush=True,
    )

    print(
        "Candidate model:", candidate_dir,
        flush=True,
    )


if __name__ == "__main__":
    main()

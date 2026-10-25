import os, sys, json, pathlib, pandas as pd, numpy as np
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from sklearn.metrics import f1_score, accuracy_score
ROOT = pathlib.Path(__file__).parent
job_id = sys.argv[1]
words = json.loads((ROOT / "job_words.json").read_text(encoding="utf-8"))
base = pd.read_csv(ROOT / "uwm_moderation_dataset_v5.csv")
extra = pd.read_csv(ROOT / "reviewed_training_examples.csv")
labels = ["safe", "profanity", "insult", "sexual", "spam"]
for frame in (base, extra):
    if not {"text", "label"}.issubset(frame.columns): raise ValueError("Required columns: text,label")
    if not set(frame.label).issubset(labels): raise ValueError("Unexpected label")
if not {"text", "label", "word"}.issubset(extra.columns): raise ValueError("Reviewed examples need word column")
# Fail closed rather than inventing training examples from isolated words.
for item in words:
    n = ((extra.word.astype(str) == item["word"]) & (extra.label == item["category"])).sum()
    if n < int(os.getenv("MIN_REVIEWED_EXAMPLES_PER_WORD", "3")):
        raise ValueError(f"Insufficient reviewed examples for word {item['word']!r}: {n}")
extra = extra[extra.word.astype(str).isin([x["word"] for x in words])].copy()
if "split" in extra.columns: extra = extra[extra.split == "train"]
base_train = base[base.split == "train"][["text", "label"]]
train = pd.concat([base_train, extra[["text", "label"]]], ignore_index=True).drop_duplicates("text")
validation = base[base.split == "validation"][["text", "label"]]
test = base[base.split == "test"][["text", "label"]]
heldout = set(validation.text.astype(str)) | set(test.text.astype(str))
if set(extra.text.astype(str)) & heldout: raise ValueError("Reviewed examples overlap held-out sets")
name = os.environ.get(
    "BASE_TRAINED_MODEL_PATH",
    str(ROOT / "model_v5")
)

if not os.path.isdir(name):
    raise FileNotFoundError(
        f"ไม่พบโฟลเดอร์โมเดล V5: {name}"
    )

tok = AutoTokenizer.from_pretrained(
    name,
    use_fast=False
)

model = AutoModelForSequenceClassification.from_pretrained(
    name,
    num_labels=5
)

print(f"Loaded V5 model from: {name}")
def ds(frame):
    frame = frame.copy(); frame["labels"] = frame.label.map({l:i for i,l in enumerate(labels)})
    dataset = Dataset.from_pandas(frame[["text", "labels"]], preserve_index=False)
    return dataset.map(lambda b: tok(b["text"], truncation=True, padding="max_length", max_length=128), batched=True)
tr, va, te = map(ds, (train, validation, test))
out = ROOT / "outputs" / str(job_id); out.mkdir(parents=True, exist_ok=True)
args = TrainingArguments(output_dir=str(out / "checkpoints"), num_train_epochs=int(os.getenv("EPOCHS", "3")), per_device_train_batch_size=8, per_device_eval_batch_size=8, learning_rate=2e-5, eval_strategy="epoch", save_strategy="epoch", load_best_model_at_end=True, metric_for_best_model="f1_macro", greater_is_better=True, report_to="none", save_total_limit=2)
def metrics(p):
    return {"f1_macro": f1_score(p.label_ids, np.argmax(p.predictions, axis=-1), average="macro", zero_division=0)}
trainer = Trainer(model=model, args=args, train_dataset=tr, eval_dataset=va, compute_metrics=metrics)
trainer.train()
result = trainer.predict(te)
pred = np.argmax(result.predictions, axis=-1)
f1 = float(f1_score(result.label_ids, pred, average="macro", zero_division=0))
threshold = float(os.getenv("MIN_TEST_MACRO_F1", "0.0"))
report = {"test_macro_f1": f1, "test_accuracy": float(accuracy_score(result.label_ids, pred)), "passed": f1 >= threshold, "threshold": threshold, "job_id": job_id}
(out / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
trainer.save_model(str(out / "model")); tok.save_pretrained(str(out / "model"))
print(report)

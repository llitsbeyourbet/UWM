from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_MODEL_PATH = os.path.join(BASE_DIR, "model_v3_1")
HF_MODEL_ID = "bettyboops/uwm-moderation-model"

# ถ้ามี HF_TOKEN (เช่นบน Render) ให้โหลดจาก Hugging Face
# ถ้าไม่มีและมี model_v3_1 ในเครื่อง ให้ใช้โมเดล Local เหมือนเดิม
HF_TOKEN = os.getenv("HF_TOKEN")

if HF_TOKEN:
    MODEL_PATH = HF_MODEL_ID
    MODEL_TOKEN = HF_TOKEN
    MODEL_SOURCE = "huggingface"
else:
    MODEL_PATH = LOCAL_MODEL_PATH
    MODEL_TOKEN = None
    MODEL_SOURCE = "local"

ALLOW_LABELS = {"safe", "alcohol"}

print(f"Loading UWM moderation model from {MODEL_SOURCE}...")

tokenizer = AutoTokenizer.from_pretrained(
    MODEL_PATH,
    token=MODEL_TOKEN,
    use_fast=False
)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_PATH,
    token=MODEL_TOKEN
)

model.eval()

print("UWM moderation model loaded!")

def predict(text):
    text = str(text or "").strip()

    if not text:
        return {
            "label": "safe",
            "confidence": 1.0,
            "decision": "allow"
        }

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=128
    )

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = torch.softmax(
            outputs.logits,
            dim=-1
        )[0]

    index = int(torch.argmax(probabilities))
    label = model.config.id2label[index]
    confidence = float(probabilities[index])

    return {
        "label": label,
        "confidence": round(confidence, 4),
        "decision": (
            "allow"
            if label in ALLOW_LABELS
            else "block"
        )
    }

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "model_v3_1",
        "source": MODEL_SOURCE
    })

@app.route("/moderate", methods=["POST"])
def moderate():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    result = predict(text)

    return jsonify(result)

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )
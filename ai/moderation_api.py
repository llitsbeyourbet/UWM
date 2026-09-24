from flask import Flask, request, jsonify
from tokenizers import Tokenizer
import onnxruntime as ort
import numpy as np
import urllib.request
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "model_int8_v2.onnx")

TOKENIZER_PATH = os.path.join(BASE_DIR, "tokenizer.json")

HF_MODEL_URL = (
    "https://huggingface.co/bettyboops/"
    "uwm-moderation-model/resolve/main/model_int8_v2.onnx"
)

HF_TOKEN = os.getenv("HF_TOKEN")

# V5: อนุญาตเฉพาะ safe
ALLOW_LABELS = {"safe"}

# ต้องตรงกับลำดับ label ตอน train V5
ID2LABEL = {
    0: "safe",
    1: "profanity",
    2: "insult",
    3: "sexual",
    4: "spam",
}


def download_model():
    if os.path.exists(MODEL_PATH):
        return

    if not HF_TOKEN:
        raise RuntimeError("HF_TOKEN is not configured")

    print("Downloading UWM V5 ONNX FP32 model from Hugging Face...")

    model_request = urllib.request.Request(
        HF_MODEL_URL,
        headers={"Authorization": f"Bearer {HF_TOKEN}"}
    )

    with urllib.request.urlopen(model_request) as response:
        with open(MODEL_PATH, "wb") as file:
            while True:
                chunk = response.read(1024 * 1024)

                if not chunk:
                    break

                file.write(chunk)

    print("UWM V5 ONNX FP32 model downloaded!")


download_model()

print("Loading UWM V5 ONNX FP32 moderation model...")

tokenizer = Tokenizer.from_file(TOKENIZER_PATH)

session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"]
)

input_names = [item.name for item in session.get_inputs()]

print("UWM V5 ONNX FP32 moderation model loaded!")


def predict(text):
    text = str(text or "").strip()

    if not text:
        return {
            "label": "safe",
            "confidence": 1.0,
            "decision": "allow",
        }

    encoded = tokenizer.encode(text)

    input_ids = encoded.ids[:128]
    attention_mask = encoded.attention_mask[:128]

    inputs = {}

    if "input_ids" in input_names:
        inputs["input_ids"] = np.array(
            [input_ids],
            dtype=np.int64
        )

    if "attention_mask" in input_names:
        inputs["attention_mask"] = np.array(
            [attention_mask],
            dtype=np.int64
        )

    logits = session.run(None, inputs)[0][0]

    exp = np.exp(logits - np.max(logits))
    probabilities = exp / exp.sum()

    index = int(np.argmax(probabilities))
    label = ID2LABEL[index]
    confidence = float(probabilities[index])

    return {
        "label": label,
        "confidence": round(confidence, 4),
        "decision": "allow" if label in ALLOW_LABELS else "block",
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": "model_v5_int8_v2",
        "runtime": "onnxruntime",
    })


@app.route("/moderate", methods=["POST"])
def moderate():
    data = request.get_json(silent=True) or {}
    return jsonify(predict(data.get("text", "")))


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )
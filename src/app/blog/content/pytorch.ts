import type { Post } from "../posts-types";

export const pytorch: Post = {
  slug: "tensors-to-trustworthy-model",
  focus: "deep-learning-with-pytorch",
  title: "From Tensors to a Model You Can Trust",
  subtitle: "Autograd, the five-line training loop, and the evaluation habits that separate a demo from a model you'd deploy.",
  date: "2026-10-03",
  minutes: 16,
  accent: "#f97316",
  motif: "neurons",
  kit: {
    name: "Model Training Notebook Pack",
    tagline: "Reproducible PyTorch templates from first tensor to fine-tuned model.",
    includes: [
      "Seeded, device-agnostic training loop with validation and early stopping",
      "Transfer-learning recipe for a pretrained ResNet-18 (torchvision weights API)",
      "Mixed-precision and checkpoint/resume boilerplate",
      "Evaluation report template: confusion matrix, per-class errors, failure gallery",
    ],
  },
  sections: [
    {
      id: "mental-model",
      access: "anonymous",
      title: "The whole of deep learning in one loop",
      teaser: "",
      blocks: [
        { kind: "p", text: "Strip away the frameworks and every neural network is trained the same way: run inputs forward to get predictions, measure how wrong they are with a loss, ask autograd for the gradient of that loss with respect to every weight, and nudge each weight a little downhill. Repeat a few hundred thousand times." },
        { kind: "diagram", name: "training-loop", caption: "Forward pass, loss, backward pass, optimizer step — the loop every PyTorch model runs, from a two-layer network to a large language model." },
        {
          kind: "code",
          lang: "python",
          title: "The five lines that train everything",
          text: `for x, y in loader:
    loss = loss_fn(model(x), y)   # forward + how wrong
    optimizer.zero_grad()         # clear last step's gradients
    loss.backward()               # autograd: d(loss)/d(every weight)
    optimizer.step()              # move weights downhill`,
        },
        { kind: "p", text: "Tensors are just n-dimensional arrays that remember how they were computed. That memory — the computation graph — is what lets loss.backward() work out millions of partial derivatives automatically." },
        { kind: "video", id: "aircAruvnKk", title: "But what is a neural network?", by: "3Blue1Brown · Deep learning, chapter 1", note: "The clearest visual introduction to what the weights in that loop actually are." },
        { kind: "video", id: "VMj-3S1tku0", title: "Building micrograd: the spelled-out intro to backpropagation", by: "Andrej Karpathy", note: "Autograd built from scratch in 100 lines of Python — after this, loss.backward() is no longer magic." },
        {
          kind: "resources",
          items: [
            { title: "Learn the Basics", by: "PyTorch (official tutorials)", url: "https://pytorch.org/tutorials/beginner/basics/intro.html", kind: "course", note: "Tensors, datasets, models, autograd and optimisation, end to end." },
            { title: "Dive into Deep Learning", by: "Zhang, Lipton, Li & Smola", url: "https://d2l.ai/", kind: "book", note: "Free, runnable textbook with PyTorch code for every chapter; used at 500+ universities." },
            { title: "torch.autograd mechanics", by: "PyTorch docs", url: "https://pytorch.org/docs/stable/notes/autograd.html", kind: "doc", note: "How the graph is recorded and when gradients flow." },
            { title: "Deep Learning", by: "Goodfellow, Bengio & Courville (MIT Press)", url: "https://www.deeplearningbook.org/", kind: "book", note: "The standard theoretical reference, free to read online." },
          ],
        },
      ],
    },
    {
      id: "full-loop",
      access: "member",
      title: "A complete, reproducible training run",
      teaser: "The full train/validate loop with seeds, devices and metrics — the template every later project starts from.",
      blocks: [
        { kind: "p", text: "A model you can trust is one you can retrain and get the same answer. That starts with three habits: fix the seeds, keep a validation set the optimizer never sees, and record metrics every epoch." },
        {
          kind: "code",
          lang: "python",
          title: "train_fashion_mnist.py",
          text: `import torch, torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms

torch.manual_seed(0)
device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

data = datasets.FashionMNIST("data", train=True, download=True, transform=transforms.ToTensor())
train_set, val_set = random_split(data, [54_000, 6_000], generator=torch.Generator().manual_seed(0))
train = DataLoader(train_set, batch_size=128, shuffle=True)
val = DataLoader(val_set, batch_size=512)

model = nn.Sequential(nn.Flatten(), nn.Linear(784, 256), nn.ReLU(), nn.Dropout(0.2), nn.Linear(256, 10)).to(device)
loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)

for epoch in range(10):
    model.train()
    for x, y in train:
        x, y = x.to(device), y.to(device)
        loss = loss_fn(model(x), y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

    model.eval()
    correct = total = 0
    with torch.no_grad():
        for x, y in val:
            pred = model(x.to(device)).argmax(1).cpu()
            correct += (pred == y).sum().item()
            total += y.numel()
    print(f"epoch {epoch}: val accuracy {correct / total:.3f}")`,
        },
        { kind: "callout", tone: "warn", text: "model.eval() and torch.no_grad() are not optional: without them, dropout stays on and gradients are tracked during validation, so your numbers are wrong and slow." },
        { kind: "video", id: "V_xro1bcAuA", title: "PyTorch for Deep Learning & Machine Learning — Full Course", by: "freeCodeCamp.org (Daniel Bourke)", note: "A long, hands-on course: workflow, classification, computer vision and custom datasets." },
      ],
    },
    {
      id: "lab",
      access: "platinum",
      title: "Lab: fine-tune a pretrained model and prove it works",
      teaser: "Transfer learning with a pretrained ResNet-18, mixed precision, checkpoints — and an evaluation report that finds where it fails.",
      blocks: [
        { kind: "p", text: "Real projects rarely train from scratch. You will adapt an ImageNet-pretrained ResNet-18 to a new 10-class dataset, train only the head first, then unfreeze, and finish with an evaluation report that shows where the model breaks." },
        {
          kind: "code",
          lang: "python",
          title: "finetune.py — model, stages and mixed precision",
          text: `import torch, torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights

weights = ResNet18_Weights.DEFAULT
model = resnet18(weights=weights)
preprocess = weights.transforms()              # the exact resize/normalise the weights were trained with

for p in model.parameters():                   # stage 1: freeze the backbone
    p.requires_grad = False
model.fc = nn.Linear(model.fc.in_features, 10) # new head for our 10 classes
model = model.to(device)

scaler = torch.amp.GradScaler("cuda", enabled=torch.cuda.is_available())  # no-op on CPU / Apple GPUs

def train_epoch(params, lr):
    optimizer = torch.optim.AdamW(params, lr=lr, weight_decay=1e-4)
    model.train()
    for x, y in train_loader:
        x, y = x.to(device), y.to(device)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=torch.cuda.is_available()):
            loss = nn.functional.cross_entropy(model(x), y, label_smoothing=0.1)
        optimizer.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()

for _ in range(3):                             # stage 1: head only
    train_epoch(model.fc.parameters(), 1e-3)
for p in model.parameters():                   # stage 2: unfreeze, smaller learning rate
    p.requires_grad = True
for epoch in range(5):
    train_epoch(model.parameters(), 1e-4)
    torch.save({"model": model.state_dict(), "epoch": epoch}, f"ckpt_{epoch}.pt")`,
        },
        { kind: "h", text: "The evaluation report" },
        {
          kind: "list",
          items: [
            "Overall accuracy and macro-F1 on a held-out test set touched exactly once.",
            "Confusion matrix — which classes swap with which, and is it symmetric?",
            "Per-class recall: a 94% average can hide a class at 60%.",
            "Failure gallery: the 25 most confident wrong predictions. Label errors, ambiguous images and real model blind spots look very different here.",
            "Calibration: does 90% confidence mean right 90% of the time? Plot a reliability diagram.",
          ],
        },
        { kind: "video", id: "kCc8FmEb1nY", title: "Let's build GPT: from scratch, in code, spelled out", by: "Andrej Karpathy", note: "The same loop, scaled up to a transformer language model — the natural next project." },
        { kind: "video", id: "wjZofJX0v4M", title: "Transformers, the tech behind LLMs", by: "3Blue1Brown · Deep learning, chapter 5", note: "The architecture you'll meet next, visualised." },
      ],
    },
  ],
};

# Practical LLM Training Runbook

A teaching-ready, hands-on guide to modern LLM training and post-training: datasets, tokenization, continued pretraining, supervised/instruction fine-tuning, full fine-tuning, PEFT, LoRA, QLoRA, preference optimization, RL-style post-training, evaluation, scaling, cost estimation, and the API-vs-training decision.

> **Audience:** ML/AI engineers, researchers, and instructors who already know basic Python/PyTorch and want to understand what to train, why, how, and when.
>
> **Status:** Designed for practical teaching. Examples use small open-weight models so the notebook can be adapted to a laptop/Colab GPU; larger configurations are discussed separately.

## What is in the notebook?

1. The LLM lifecycle: pretraining → continued pretraining → SFT/instruction tuning → preference optimization → evaluation/deployment.
2. Dataset design: task data vs domain text vs preference data; quality, deduplication, leakage, splits, and contamination.
3. Tokenization and causal next-token prediction.
4. A minimal supervised fine-tuning example with Hugging Face Transformers/TRL.
5. Full fine-tuning vs parameter-efficient fine-tuning (PEFT).
6. LoRA mechanics and the rank/target-module trade-off.
7. QLoRA: 4-bit frozen base + trainable LoRA adapters.
8. Instruction tuning and chat templates.
9. Continued/domain-adaptive pretraining (CPT/DAPT).
10. Preference methods: reward modeling, DPO, and where RL/GRPO fits.
11. Evaluation: held-out loss/perplexity, task metrics, pairwise preference, regression tests, safety, latency and cost.
12. Memory/compute estimation and GPU sizing.
13. Practical cloud-cost scenarios.
14. A decision tree for API vs RAG vs prompt engineering vs SFT/LoRA/QLoRA vs full fine-tuning vs continued pretraining vs training from scratch.
15. Production failure modes and an operational checklist.

## Recommended teaching sequence

**Session 1 — Foundations:** Sections 1–5.

**Session 2 — Fine-tuning:** Sections 6–10. Students should run the SFT and LoRA/QLoRA cells.

**Session 3 — Alignment and evaluation:** Sections 11–13.

**Session 4 — Architecture decisions:** Sections 14–16. Give students real scenarios and ask them to choose the least expensive method that can satisfy the requirement.

## Core rule

Do not train because training is interesting. First establish that a simpler intervention cannot meet the requirement.

A useful hierarchy is:

**API/model selection → prompting → structured output/tool use → RAG → caching/routing → SFT/LoRA → QLoRA → continued pretraining → full fine-tuning → pretraining from scratch.**

This is not a universal ordering of model quality. It is a practical escalation path based on how much model behavior/knowledge you need to change and how much infrastructure you are willing to own.

## Method cheat sheet

| Need | Typical method | Why |
|---|---|---|
| Current/private facts from documents | RAG | Knowledge stays external and updateable |
| Better instructions / output schema / tone | SFT, often LoRA/QLoRA | Teaches repeatable behavior |
| Domain vocabulary/style | Continued pretraining, sometimes followed by SFT | Adapts representations to a domain corpus |
| Specific preferred-vs-rejected behavior | DPO or related preference optimization | Learns relative response preferences |
| Very small hardware budget | QLoRA | Frozen quantized base + small adapters |
| Need to modify every parameter / major distribution shift | Full fine-tuning | Maximum parameter freedom, highest cost/risk |
| Need a general-purpose foundation model | Pretraining from scratch | Requires very large data, compute, infra, and expertise |

## Important distinction: knowledge vs behavior

Fine-tuning is usually strongest for **behavior**: format, style, task procedure, classification boundaries, tool-call conventions, response patterns, and domain/task adaptation. It is usually a poor substitute for a continuously changing document store. For frequently changing or large private knowledge bases, use retrieval/tooling and evaluate the resulting system end-to-end.

## Resource rules of thumb

These are planning heuristics, not guarantees. Sequence length, batch size, optimizer, checkpointing, model architecture, quantization, kernels, and framework versions can change the real requirement substantially.

| Workload | Typical starting point |
|---|---|
| Learn the mechanics | 0.5–1.5B model, 8–16 GB VRAM |
| LoRA/QLoRA on 3–8B | 16–24 GB VRAM; 24–48 GB is more comfortable |
| LoRA/QLoRA on ~14B | ~24–48+ GB depending on context/batch |
| Full FT around 7B | Roughly >112 GB for parameter/optimizer/gradient state before activations; usually multi-GPU |
| Full FT around 13B | Roughly >208 GB before activations; multi-GPU is normal |
| Large-scale pretraining | Distributed multi-GPU cluster; model/data/parallelism and network become first-class design problems |

A useful rough lower-bound calculation for Adam-style full fine-tuning in mixed precision is **~16 bytes per parameter for model/gradient/optimizer state**, before activation memory, temporary buffers, fragmentation and framework overhead. Thus 7B parameters already imply ~112 GB of state. Do not confuse this with inference memory.

## Example cloud-cost arithmetic

As a transparent teaching example, RunPod currently lists (on the cited page) roughly **$0.34/hr for RTX 4090, $1.39/hr for A100 80GB, and $2.89/hr for H100**. Prices vary by region, availability and instance type, so students should verify before budgeting.

Illustrative compute-only cost:

- 4 hours on a $0.34/hr 4090 ≈ **$1.36**
- 8 hours on a $1.39/hr A100 ≈ **$11.12**
- 12 hours on a $2.89/hr H100 ≈ **$34.68**

The real project cost also includes storage, data processing, failed experiments, evaluation, engineering time, inference, monitoring and model lifecycle work.

## Primary references

- Hugging Face Transformers fine-tuning: https://huggingface.co/docs/transformers/main/training
- Hugging Face Trainer: https://huggingface.co/docs/transformers/main/en/trainer
- Hugging Face TRL: https://huggingface.co/docs/trl/
- TRL SFTTrainer: https://huggingface.co/docs/trl/main/en/sft_trainer
- Hugging Face PEFT: https://huggingface.co/docs/peft/
- Hugging Face LoRA guide: https://huggingface.co/docs/peft/main/conceptual_guides/lora
- QLoRA paper: https://arxiv.org/abs/2305.14314
- LoRA paper: https://arxiv.org/abs/2106.09685
- Instruction-tuning survey: https://arxiv.org/abs/2308.10792
- DPO paper: https://arxiv.org/abs/2305.18290
- Domain-adaptive pretraining: https://arxiv.org/abs/2004.10964
- DeepSpeed ZeRO: https://www.deepspeed.ai/tutorials/zero/
- NVIDIA Megatron Core: https://docs.nvidia.com/megatron-core/developer-guide/latest/get-started/quickstart.html
- Google Gemma fine-tuning: https://ai.google.dev/gemma/docs/tune
- Anthropic model/pricing documentation: https://docs.anthropic.com/en/docs/about-claude/models/overview and https://docs.anthropic.com/en/docs/about-claude/pricing
- RunPod GPU pricing example: https://www.runpod.io/articles/guides/how-llm-powered-agents-are-shaping-future-automation

## Caveat on “mandatory” training

Very few application problems make model training mathematically mandatory. What can make training **practically necessary** is a requirement that cannot be met reliably by prompting, retrieval, tools, routing or an available API model—for example a highly specific behavioral policy at very high volume, strict on-prem/offline execution with an open-weight model, a model that must internalize a specialized distribution, or a task where adaptation consistently beats the available general model under your measured constraints.

The notebook therefore frames the final decision as an engineering experiment: define the target metric, establish an API baseline, establish a RAG baseline when knowledge is involved, then train only if the measured gap justifies the additional data/compute/maintenance burden.

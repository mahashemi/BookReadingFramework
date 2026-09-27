# LLM adaptation method taxonomy

This file complements the runnable notebook. The names overlap across papers and vendors, so always define the **objective**, **data**, and **trainable parameters** rather than relying on a method name alone.

## 1. Foundation-model pretraining

### Causal language-model pretraining
Random/near-random weights are optimized on a very large corpus with next-token prediction. This is the expensive foundation-model stage.

### Continued pretraining (CPT)
Continue next-token training from an existing model using more text.

### Domain-adaptive pretraining (DAPT)
CPT using domain-specific text. Useful when the domain distribution itself is the adaptation target.

### Task-adaptive pretraining (TAPT)
CPT on unlabeled text associated with a downstream task/domain before supervised adaptation.

**Use CPT/DAPT/TAPT when:** you have substantial unlabeled text and the problem is representation/domain adaptation, not merely a missing fact.

---

## 2. Supervised adaptation

### Full-parameter supervised fine-tuning (SFT)
All or nearly all model weights are updated using desired input/output examples.

### Instruction tuning
Usually SFT with instruction-following examples. It teaches a model to respond to instructions rather than simply continue arbitrary text.

### Preference-conditioned supervised data
Some teams use multiple candidate answers or richer labels to construct SFT or preference data. The important distinction is whether the loss explicitly models relative preference.

**Use SFT when:** the desired behavior can be demonstrated with good examples.

---

## 3. Parameter-efficient fine-tuning (PEFT)

PEFT changes the optimization strategy rather than the task objective. SFT, DPO and other objectives can be combined with PEFT.

### LoRA
Freeze the base weights and learn low-rank matrices injected into selected layers.

### QLoRA
LoRA plus a quantized frozen base model, commonly 4-bit. This substantially lowers the base-weight memory footprint.

### AdaLoRA
Dynamically allocates LoRA rank during training instead of keeping rank fixed everywhere.

### DoRA
Decomposes weight magnitude and direction to improve adaptation capacity while retaining a parameter-efficient structure.

### Prefix tuning
Freeze model weights and learn continuous virtual tokens/prefix representations that condition the transformer.

### Prompt tuning
Learn continuous embeddings corresponding to virtual prompt tokens while freezing the model.

### P-tuning
A family of prompt-encoding/continuous-prompt approaches. Terminology varies by implementation.

### Adapters
Insert small trainable modules between/inside transformer blocks while freezing most original weights.

### IA³
Learn a small set of learned rescaling vectors rather than full weight updates.

**PEFT selection:** start with the simplest supported method—usually LoRA/QLoRA—then test variants only if the evaluation gap justifies them.

---

## 4. Preference optimization

### Reward modeling
Train a model to assign a scalar reward/score to a response. The reward can drive later optimization.

### RLHF
A broad pipeline: collect human preferences → train a reward model → optimize the policy, historically often with PPO-like RL. It is powerful but operationally complex.

### DPO
Directly optimize chosen-vs-rejected responses without the classic explicit reward-model + PPO loop. Good default when reliable pairwise preference data exists.

### KTO
Preference learning based on desirable/undesirable examples rather than requiring paired chosen/rejected responses in the same form as DPO.

### ORPO
A preference-oriented method that combines supervised learning and preference pressure without the same explicit reference-model setup as classic DPO.

### SimPO
A simplified preference-optimization formulation designed to remove some reference-model dependence and change the reward parameterization.

These methods are not interchangeable recipes. Dataset structure and the quality of the preference signal matter as much as the algorithm.

---

## 5. Reward-driven / RL-style post-training

### GRPO
Group Relative Policy Optimization. Sample multiple outputs and use a reward function to compare/optimize them. Especially useful when rewards are automatically verifiable.

### RLOO
Leave-one-out style policy optimization using sampled responses and relative rewards.

### Reinforcement fine-tuning / verifier-guided training
Use an expert grader, programmatic verifier or environment reward to reinforce higher-quality outputs. This is useful when the task has a measurable reward that correlates strongly with the real objective.

**Use RL-style methods when:** you can define a reliable reward and the task benefits from exploring candidate solutions. Do not use RL simply because it sounds more advanced than SFT.

---

## 6. Distillation

### Logit distillation
Train a smaller student to imitate teacher probability distributions.

### Response distillation
Use a stronger teacher to generate high-quality instruction/answer examples, then SFT the student.

### Preference distillation
Use teacher rankings/preferences as preference data for a smaller model.

Distillation can be much cheaper than training a large model from scratch and is often useful for production cost/latency targets.

---

## 7. Quantization-aware adaptation

### Post-training quantization (PTQ)
Quantize a trained model after training. This is primarily a deployment optimization, not a learning method.

### Quantization-aware training (QAT)
Train while simulating quantization effects so the resulting model better preserves quality at the target precision.

### QLoRA
A particularly important training recipe because quantization is applied to the frozen base while LoRA parameters remain trainable.

Do not confuse **quantization** with **fine-tuning**: quantization changes numerical representation; fine-tuning changes learned parameters.

---

## 8. Retrieval/tool augmentation (not training)

### RAG
Retrieve external information at inference time and place it in the model context. No model-weight update is required.

### Tool use / function calling
The model learns or is prompted to call external systems for computation, search, databases, APIs, or actions.

### Agent training
A model can be trained against tool/environment outcomes, but a tool-using application is not automatically a trained model.

These are important alternatives because many 'fine-tune on our documents' requests are actually knowledge-retrieval problems.

---

## 9. Managed API fine-tuning vs open-weight fine-tuning

There are two broad operational models:

**Managed:** send a dataset to a provider and receive a tuned model endpoint. You trade infrastructure control for managed training/deployment. OpenAI currently documents SFT, vision fine-tuning, DPO and reinforcement fine-tuning for supported models; exact model/method availability changes over time.

**Open-weight:** download a model, train it yourself with Transformers/TRL/PEFT/DeepSpeed/Megatron/etc., then own the resulting artifacts and serving stack subject to the model license.

The correct comparison is not simply 'API vs fine-tuning'. Compare:

- quality on your evaluation set;
- privacy/data residency;
- licensing and commercial use;
- latency and throughput;
- cost at expected traffic;
- ability to update knowledge;
- vendor/model lock-in;
- operational burden;
- observability and safety controls;
- model lifecycle and rollback.

## 10. A practical escalation strategy

1. Model selection.
2. Prompt engineering / structured outputs.
3. Tool use / function calling.
4. RAG for external/current knowledge.
5. Routing/caching/system-level optimization.
6. SFT on a strong open or managed model.
7. LoRA/QLoRA for efficient open-weight adaptation.
8. Preference optimization if preference data exists.
9. Continued/domain pretraining when the distribution itself must change.
10. Full fine-tuning when PEFT is insufficient and the additional capacity is justified.
11. Pretraining from scratch only when no suitable foundation model meets the capability, data, licensing or control requirements.

This escalation is a decision heuristic, not a quality ranking.

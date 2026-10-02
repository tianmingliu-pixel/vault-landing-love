export const focusAreas = [
  {
    slug: "secure-software-engineering",
    title: "Secure Software Engineering",
    body: "Threat modeling, API authorization testing (BOLA / BFLA), SBOM and dependency risk, DevSecOps pipeline gates.",
    topics: [
      { title: "Threat modeling", detail: "Map trust boundaries, sensitive data flows, and likely abuse paths before implementation." },
      { title: "API authorization", detail: "Examine object-level and function-level access controls, including BOLA and BFLA scenarios." },
      { title: "DevSecOps", detail: "Use dependency inventories, SBOMs, and automated checks to make security part of delivery." },
    ],
  },
  {
    slug: "deep-learning-with-pytorch",
    title: "Deep Learning with PyTorch",
    body: "Tensors, autograd, training loops, and putting pretrained models to work on real data.",
    topics: [
      { title: "Foundations", detail: "Work with tensors, automatic differentiation, and model architectures in PyTorch." },
      { title: "Model training", detail: "Build reproducible training and evaluation loops with appropriate metrics." },
      { title: "Practical inference", detail: "Adapt pretrained models to real data and evaluate their limits before deployment." },
    ],
  },
  {
    slug: "agentic-ai-development",
    title: "Agentic AI Development",
    body: "LLM-powered apps and agents designed with prompt-injection and tool-misuse risks in mind from day one.",
    topics: [
      { title: "Agent workflows", detail: "Connect models to tools and data with explicit scopes and observable execution." },
      { title: "Prompt-injection defense", detail: "Treat retrieved content and external instructions as untrusted input." },
      { title: "Tool safety", detail: "Constrain permissions and review sensitive actions before agents act on a user's behalf." },
    ],
  },
  {
    slug: "data-systems",
    title: "Data Systems",
    body: "SQL, PostgreSQL, Spark, and reproducible Docker-based data environments.",
    topics: [
      { title: "Relational data", detail: "Design queries and schemas that make data reliable and easy to inspect." },
      { title: "Distributed processing", detail: "Use Spark for transformation and analysis when datasets outgrow a single machine." },
      { title: "Reproducible environments", detail: "Package services and dependencies with Docker for consistent local development." },
    ],
  },
] as const;
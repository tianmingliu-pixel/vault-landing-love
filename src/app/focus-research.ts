/* Research map for each focus area: landmark papers (title, and DOI where reliable) and the search phrases that feed each module's endless stream. */

export const FOCUS_RESEARCH: Record<string, { accent: string; article: string; canon: { title: string; doi: string }[]; streams: { label: string; phrase: string }[] }> = {
  "secure-software-engineering": {
    accent: "#34d399",
    article: "break-your-own-api",
    canon: [
      { title: "The protection of information in computer systems", doi: "10.1109/proc.1975.9939" },
      { title: "Reflections on trusting trust", doi: "10.1145/358198.358210" },
      { title: "The Matter of Heartbleed", doi: "10.1145/2663716.2663755" },
      { title: "Spectre Attacks: Exploiting Speculative Execution", doi: "10.1109/sp.2019.00002" },
      { title: "Backstabber’s Knife Collection: A Review of Open Source Software Supply Chain Attacks", doi: "10.1007/978-3-030-52683-2_2" },
    ],
    streams: [
      { label: "Threat modeling", phrase: "threat modeling" },
      { label: "Access control", phrase: "access control" },
      { label: "Supply chain", phrase: "software supply chain" },
      { label: "Vulnerability detection", phrase: "vulnerability detection" },
    ],
  },
  "deep-learning-with-pytorch": {
    accent: "#f97316",
    article: "tensors-to-trustworthy-model",
    canon: [
      { title: "Learning representations by back-propagating errors", doi: "10.1038/323533a0" },
      { title: "Deep learning", doi: "10.1038/nature14539" },
      { title: "ImageNet classification with deep convolutional neural networks", doi: "10.1145/3065386" },
      { title: "Deep Residual Learning for Image Recognition", doi: "10.1109/cvpr.2016.90" },
      { title: "Attention Is All You Need", doi: "" },
      { title: "Adam: A Method for Stochastic Optimization", doi: "10.48550/arxiv.1412.6980" },
      { title: "PyTorch: An Imperative Style, High-Performance Deep Learning Library", doi: "10.48550/arxiv.1912.01703" },
    ],
    streams: [
      { label: "Neural networks", phrase: "deep neural networks" },
      { label: "Optimization", phrase: "stochastic gradient descent" },
      { label: "Transfer learning", phrase: "transfer learning" },
      { label: "Transformers", phrase: "transformer" },
    ],
  },
  "agentic-ai-development": {
    accent: "#a78bfa",
    article: "agents-that-cant-be-turned",
    canon: [
      { title: "Language Models are Few-Shot Learners", doi: "10.48550/arxiv.2005.14165" },
      { title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models", doi: "" },
      { title: "ReAct: Synergizing Reasoning and Acting in Language Models", doi: "" },
      { title: "Toolformer: Language Models Can Teach Themselves to Use Tools", doi: "10.48550/arxiv.2302.04761" },
      { title: "Not What You’ve Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection", doi: "10.48550/arxiv.2302.12173" },
      { title: "Constitutional AI: Harmlessness from AI Feedback", doi: "" },
      { title: "Training language models to follow instructions with human feedback", doi: "" },
      { title: "Generative Agents: Interactive Simulacra of Human Behavior", doi: "" },
    ],
    streams: [
      { label: "LLM agents", phrase: "language model agents" },
      { label: "Tool use", phrase: "tool learning" },
      { label: "Prompt injection", phrase: "prompt injection" },
      { label: "Alignment", phrase: "alignment" },
    ],
  },
  "data-systems": {
    accent: "#38bdf8",
    article: "data-you-can-rebuild",
    canon: [
      { title: "A relational model of data for large shared data banks", doi: "10.1145/362384.362685" },
      { title: "Access path selection in a relational database management system", doi: "10.1145/582095.582099" },
      { title: "MapReduce: simplified data processing on large clusters", doi: "10.1145/1327452.1327492" },
      { title: "Bigtable: A Distributed Storage System for Structured Data", doi: "10.1145/1365815.1365816" },
      { title: "Dynamo: Amazon’s highly available key-value store", doi: "10.1145/1323293.1294281" },
      { title: "Apache Spark: a unified engine for big data processing", doi: "10.1145/2934664" },
    ],
    streams: [
      { label: "Query processing", phrase: "query optimization" },
      { label: "Distributed processing", phrase: "MapReduce" },
      { label: "Stream processing", phrase: "stream processing" },
      { label: "Reproducibility", phrase: "reproducibility" },
    ],
  },
};

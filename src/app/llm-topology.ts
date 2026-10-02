export const accessLevels = ["public", "auth", "operator", "manager"] as const;
export type AccessLevel = (typeof accessLevels)[number];

export const services = [
  { id: "user", label: "User", zone: "Public entry", responsibility: "Initiates an application session; the human user is not a trusted network principal by default." },
  { id: "spa", label: "React SPA", zone: "Public client", responsibility: "Renders the browser interface and carries user actions to the API. Browser code cannot safely keep service secrets." },
  { id: "api", label: "FastAPI", zone: "Authenticated ingress", responsibility: "Validates requests and coordinates the approved operations behind a single application boundary." },
  { id: "sso", label: "SSO / OAuth2", zone: "Identity provider", responsibility: "Issues identity claims; FastAPI verifies tokens or introspects them. The browser authorization redirect is a separate flow." },
  { id: "postgres", label: "PostgreSQL", zone: "Operator data", responsibility: "Stores application state and structured records with service-scoped database credentials." },
  { id: "s3", label: "Object storage / S3", zone: "Operator data", responsibility: "Stores approved objects and model artifacts under narrowly scoped bucket policies." },
  { id: "llm", label: "LLM API", zone: "Inference", responsibility: "Runs model inference behind authenticated API calls; generated tool intentions are not direct execution privileges." },
  { id: "rag", label: "RAG / vector store", zone: "Retrieval", responsibility: "Retrieves permitted context with collection-level access policies. The depicted LLM-to-RAG edge is a logical retrieval path, typically mediated by the application." },
  { id: "agent", label: "Agent orchestration", zone: "Policy-governed tools", responsibility: "Validates model-suggested actions and invokes tools only after policy checks and audit logging." },
  { id: "hpc", label: "HPC scheduler API", zone: "Managed compute", responsibility: "Submits compute jobs under a scoped manager identity with quotas and approvals." },
  { id: "external", label: "Literature / data APIs", zone: "External research", responsibility: "Fetches vetted external research sources through a controlled egress path." },
  { id: "notify", label: "Email / notifications", zone: "Managed outbound", responsibility: "Delivers approved notifications, not arbitrary model-generated messages." },
] as const;

export type ServiceId = (typeof services)[number]["id"];

export const connections = [
  { id: "user-spa", from: "user", to: "spa", access: "public", purpose: "User opens the client application." },
  { id: "spa-api", from: "spa", to: "api", access: "auth", purpose: "React SPA sends authenticated application requests to FastAPI." },
  { id: "api-sso", from: "api", to: "sso", access: "auth", purpose: "FastAPI verifies identity claims or tokens with the SSO/OAuth2 provider." },
  { id: "api-postgres", from: "api", to: "postgres", access: "operator", purpose: "The API accesses structured state using a scoped operator identity." },
  { id: "api-s3", from: "api", to: "s3", access: "operator", purpose: "The API reads or writes approved objects under bucket-scoped permissions." },
  { id: "api-llm", from: "api", to: "llm", access: "operator", purpose: "The API invokes the model endpoint under a service identity." },
  { id: "llm-rag", from: "llm", to: "rag", access: "operator", purpose: "Logical retrieval path; a trusted application component brokers vector-store access." },
  { id: "llm-agent", from: "llm", to: "agent", access: "operator", purpose: "Model tool intent reaches an orchestrator for validation; the model does not gain direct tool credentials." },
  { id: "agent-hpc", from: "agent", to: "hpc", access: "manager", purpose: "The orchestrator submits approved HPC jobs with manager-scoped authority." },
  { id: "agent-external", from: "agent", to: "external", access: "operator", purpose: "The orchestrator queries approved literature and data APIs through restricted egress." },
  { id: "agent-notify", from: "agent", to: "notify", access: "manager", purpose: "The orchestrator sends approved notifications with manager-scoped authority." },
] as const satisfies readonly { id: string; from: ServiceId; to: ServiceId; access: AccessLevel; purpose: string }[];

export type ConnectionId = (typeof connections)[number]["id"];
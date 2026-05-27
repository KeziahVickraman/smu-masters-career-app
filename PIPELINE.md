User Input (JSON schema)
        ↓
Industry + Programme + Role
        ↓
┌─────────────────────────────────┐
│         RAG Pipeline            │
│  - GitHub API                   │
│  - Company docs (public)        │
│  - Financial reports            │
│  - YouTube/Podcast metadata     │
│  - WEF/MAS displacement data   │
└─────────────────────────────────┘
        ↓
Vector DB (Pinecone / pgvector)
        ↓
Claude API (synthesis layer)
        ↓
┌──────────────────────────────────────┐
│           Three Outputs              │
│  1. Job Risk Score + Skills Gap      │
│  2. Interview Prep (pre/during/post) │
│  3. Checklist + Resource Feed        │
└──────────────────────────────────────┘
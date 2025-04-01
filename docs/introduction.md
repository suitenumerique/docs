# Introduction

The Docs project is an open-source collaborative note-taking, wiki, and documentation platform designed to scale efficiently. It serves as an alternative to tools like Notion or Outline, emphasizing simplicity and real-time collaboration. The architecture of Docs is structured to support these goals, integrating various technologies and components.

## 🛠️ Quick Start

Follow these steps to get the project up and running:

```bash
git clone https://github.com/suitenumerique/docs.git && \
cd docs && \
make bootstrap FLUSH_ARGS='--no-input'
```

The last command prepares the application for use by building the necessary services, installing dependencies, applying migrations, and compiling translations — all in one step.


## 🧩 Core Components

🛠️ Backend (Django + DRF) aka impress:
Powers the business logic, API endpoints, authentication, and permission management. Built with Django and the Django Rest Framework, it's the backbone of all server-side operations.

🖼️ Frontend (React):
The user interface is crafted with React, providing a fast, clean, and intuitive experience for document editing and navigation.

🤝 Real-Time Collaboration (Yjs):
Enables multiplayer editing with real-time syncing using Yjs, a CRDT-based framework that ensures conflict-free collaboration across users and devices.

🧠 AI Assistant:
Built-in AI actions let users generate, summarize, translate, and correct content, helping teams work faster and smarter.


## 🔌 Integration with External Services

📦 Storage (MinIO):
Uses MinIO, an S3-compatible object storage system, to handle uploaded documents, media assets, and persistent file storage — ideal for scalable deployments.

🗃️ Database (PostgreSQL):
Relies on PostgreSQL for reliable and structured data management, ensuring transactional integrity and scalability across user and document data.

⚡ Caching & Task Queues (Redis):
Leverages Redis for both caching and message queuing between services — boosting performance and enabling asynchronous operations like background processing.

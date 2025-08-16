# Cursor Rules Structure

This project uses a hierarchical cursor rules structure to provide context-aware assistance:

## Structure

```
.cursor/rules/                    # Project-wide rules
├── project-wide.mdc             # General monorepo guidelines
├── global-architecture.mdc      # Architecture patterns
└── README.md                    # This file

services/
└── .cursor/rules/               # Backend-specific rules
    └── backend-python.mdc       # Python service guidelines

apps/
└── .cursor/rules/               # Frontend-specific rules
    └── frontend-react.mdc       # React/TypeScript guidelines
```

## Usage

- **Project-wide rules** apply to all files in the monorepo
- **Backend rules** apply specifically to Python services in `services/`
- **Frontend rules** apply specifically to React/TypeScript apps in `apps/`

## Rule Files

### Project-wide Rules (`.cursor/rules/project-wide.mdc`)
- General monorepo structure and guidelines
- Cross-service communication patterns
- Shared coding standards

### Backend Rules (`services/.cursor/rules/backend-python.mdc`)
- Python coding standards (PEP 8)
- API design patterns
- Testing and security guidelines
- Service-specific architecture

### Frontend Rules (`apps/.cursor/rules/frontend-react.mdc`)
- React/TypeScript best practices
- Component architecture
- State management patterns
- Performance optimization guidelines

## Adding New Rules

1. Create new `.mdc` files in the appropriate directory
2. Follow the existing format with clear sections and guidelines
3. Update this README if adding new rule categories
4. Test the rules by creating new files in the relevant directories

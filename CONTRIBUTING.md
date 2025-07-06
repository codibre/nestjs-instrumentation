# Contributing to New Relic NestJS Instrumentation

Thank you for your interest in contributing to this project! We welcome contributions from the community.

## Development Setup

### Prerequisites

- Node.js >= 22
- pnpm >= 10.12.4
- Git

### Getting Started

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/newrelic-nestjs-instrumentation.git
   cd newrelic-nestjs-instrumentation
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run tests**
   ```bash
   pnpm test
   ```

4. **Build the project**
   ```bash
   pnpm build
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:cov

# Run tests in watch mode (for development)
pnpm test -- --watch
```

### Code Quality

We maintain high code quality standards:

```bash
# Lint and format check
pnpm lint

# Auto-fix linting and formatting issues
pnpm run lint:fix
```

### Building

```bash
# Build the library
pnpm build

# Clean build artifacts
pnpm run prebuild
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Provide comprehensive type definitions
- Use strict TypeScript configuration
- Document public APIs with TSDoc

### Documentation

- All public APIs must have TSDoc documentation
- Include usage examples in documentation
- Update README.md for significant changes
- Document breaking changes in commit messages

### Testing

- Write unit tests for all new functionality
- Maintain test coverage above 80%
- Use descriptive test names
- Test both success and error scenarios

### Commit Convention

We use conventional commits:

```
type(scope): description

feat(core): add support for HTTP/2 instrumentation
fix(events): resolve memory leak in event emitter
docs(readme): update installation instructions
test(guard): add tests for transaction context
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `test`: Test additions or modifications
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process or auxiliary tool changes

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   pnpm test
   pnpm lint
   pnpm build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): description of your changes"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description of changes
   - Link any related issues
   - Include screenshots if UI changes are involved

### Pull Request Checklist

- [ ] Code follows the style guidelines
- [ ] Tests pass locally
- [ ] New functionality has tests
- [ ] Documentation is updated
- [ ] Commit messages follow conventional commit format
- [ ] No breaking changes (or properly documented)

## Project Structure

```
src/
├── index.ts                           # Main exports
├── nestjs-newrelic-instrumentation.module.ts  # Main module
├── newrelic-context-guard.ts          # Transaction context guard
├── newrelic.interceptor.ts           # Transaction lifecycle interceptor
├── newrelic-nestjs-event.ts          # Event emitter service
└── internal/                         # Internal utilities
    ├── emitter-symbol.ts              # DI symbol
    ├── get-transaction-name.ts        # Transaction naming utility
    ├── internal-context.ts            # Async local storage context
    └── index.ts                       # Internal exports

test/                                  # Test files
├── **/*.spec.ts                       # Unit tests
└── jest-setup.ts                      # Test configuration
```

## Adding New Features

### For New Instrumentation Types

1. **Identify the use case**
   - What scenario isn't covered by existing instrumentation?
   - How does it differ from HTTP requests?

2. **Design the solution**
   - Can it work with existing guards/interceptors?
   - Does it need new components?

3. **Implement with tests**
   - Add comprehensive unit tests
   - Test integration scenarios
   - Document with examples

4. **Update documentation**
   - Add to README.md use cases
   - Include code examples
   - Update API documentation

### For Bug Fixes

1. **Reproduce the issue**
   - Create a test that demonstrates the bug
   - Understand the root cause

2. **Fix the issue**
   - Make minimal changes to fix the bug
   - Ensure the fix doesn't break other functionality

3. **Test thoroughly**
   - Verify the bug is fixed
   - Run full test suite
   - Test edge cases

## Release Process

Releases are automated using release-it:

1. **Prepare for release**
   - Ensure all tests pass
   - Update documentation
   - Review changelog

2. **Create release**
   ```bash
   pnpm dlx release-it
   ```

3. **Post-release**
   - Monitor for issues
   - Update documentation if needed

## Getting Help

- **Questions**: Open a [discussion](https://github.com/your-org/newrelic-nestjs-instrumentation/discussions)
- **Bugs**: Create an [issue](https://github.com/your-org/newrelic-nestjs-instrumentation/issues)
- **Features**: Open a [feature request](https://github.com/your-org/newrelic-nestjs-instrumentation/issues/new?template=feature_request.md)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Please be respectful and inclusive in all interactions.

## License

By contributing to this project, you agree that your contributions will be licensed under the ISC License.

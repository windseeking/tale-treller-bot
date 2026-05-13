# Clean Architecture

Clean Architecture is a way to organize application code around business rules instead of frameworks, databases, or delivery mechanisms. Its main goal is to keep the core behavior understandable, testable, and replaceable when external details change.

This document describes the methodology, not the current state of this repository.

## Dependency Rule

Dependencies should point inward. Outer layers may depend on inner layers, but inner layers should not depend on outer layers.

```text
infrastructure -> controllers -> use-cases -> entities
                       |             |
                       v             v
                  interfaces     interfaces
```

The core application should not know whether it is called from HTTP, CLI, Telegram, a browser app, a job runner, or tests. It should also not depend directly on Express, Telegraf, Vue, PostgreSQL, Trello SDKs, LLM SDKs, ORMs, or validation libraries.

Frameworks and external services are implementation details. They are connected to the application through interfaces and dependency injection.

## Practical Structure

A practical Node.js/TypeScript structure can look like this:

```text
config/
interfaces/
controllers/
entities/
use-cases/
infrastructure/
```

| Layer | Responsibility |
| --- | --- |
| `entities/` | Core business objects and rules that are independent of the application runtime. Entities may depend on other entities, but not on infrastructure. |
| `use-cases/` | Application-specific business processes. A use case coordinates entities, validates business preconditions, calls interfaces, and returns application results. |
| `interfaces/` | Ports and contracts used by use cases and controllers: repositories, gateways, validators, request shapes, result shapes, and common abstractions. |
| `controllers/` | Application-facing orchestration. Controllers normalize input into application-level requests, call use cases, and return application-level responses. |
| `infrastructure/` | Concrete implementations: HTTP routes, CLI commands, database access, external API clients, validators, crypto helpers, logging integrations, and framework setup. |
| `config/` | Runtime configuration and composition wiring. It can centralize which concrete implementations are used. |

The exact folder names are less important than the dependency direction and clear responsibility boundaries.

## Layer Guidance

### Entities

Entities represent business concepts that would still make sense without the current framework or database. They should avoid imports from infrastructure, config, controllers, and use cases.

In TypeScript, entities may be classes, plain objects with functions, or strongly typed domain models. Use classes only when behavior or construction rules benefit from them.

Examples from the article:

- `User` and `Article` are entities because they represent business concepts, not database tables or HTTP resources.
- `AuthUser` is a specialized entity-like model used for registration/login data.
- A shared base `Entity` class can be useful for common fields such as `id`, `createdAt`, or `updatedAt`, but it is optional.

Entities should answer questions such as:

- what is this business object?
- what invariants or construction rules belong to the object itself?
- what behavior would still be true if the app moved from Express to CLI, or from MySQL to PostgreSQL?

Entities should not answer:

- how is this object stored?
- which route created it?
- which ORM model represents it?
- which external provider returned it?

### Use Cases

Use cases describe what the application can do. They should be named after business actions, not storage operations, even when a simple project makes them look similar to CRUD.

Typical use cases:

- register a user;
- authorize a request;
- create an article;
- create a Trello card from a message draft;
- disconnect an integration.

Use cases should receive dependencies through constructors or function parameters. Those dependencies should usually be interfaces such as repositories, gateways, validators, not concrete database clients or SDKs.

Use cases answer questions such as:

- what business action is being performed?
- what rules or preconditions must be checked?
- which repositories, gateways, validators, or helpers are needed?
- what result should the application return?
- which failures are business/application failures?

Examples from the article:

- `RegisterUser` validates registration data, encrypts the password, sets the default role, and creates the user through `IUserDAO`.
- `LoginUser` checks credentials and issues a token. It is a business action, not just a database lookup.
- `CreateArticle` validates article data, assigns the current user as author, applies publication defaults, and persists the article through `IArticleDAO`.
- `DeleteArticle` may allow an admin to delete any article but a regular user only to delete their own article. That authorization rule belongs in the use case because it is business behavior.

The article also points out that some methods look like CRUD in small examples, but real use cases should be named and shaped around business tasks. A method that only forwards to a DAO is a sign that the boundary may be premature, or that the business rule has not appeared yet.

### Interfaces

Interfaces define what the core needs from the outside world. They can describe:

- repositories or DAOs;
- external service gateways;
- validators;
- use case contracts;
- normalized request objects;
- response DTOs;
- pagination or error shapes.

Interfaces are allowed to evolve while the application is being implemented. Start with the methods the use cases need now, and add more only when a concrete use case requires them.

Examples from the article:

- `IUserDAO` and `IArticleDAO` are interfaces because use cases need user/article persistence without depending on MySQL.
- `IValidator<T>` is an interface because use cases need validation without depending on Joi directly.
- `IUseCase<T>` is a common interface that gives controllers a consistent way to call application actions.

Naming can vary by responsibility:

- use `Repository` or `DAO` for persistence ports;
- use `Gateway` for external service/API ports;
- use `Provider` for context-like data providers, such as current time, auth context, or configuration-derived values;
- use `Validator` for validation contracts.

In the article, `DAO` is the generic name used for persistence ports. In systems with external providers, `Gateway` is often clearer for APIs such as Trello, email, payments, or LLMs.

### Controllers

Controllers are glue between delivery mechanisms and use cases. They should not contain framework-specific code if the same application behavior must be callable from multiple entrypoints.

A controller may receive a normalized request object, extract required data, call one or more use cases, and return a plain result. Express routes, Telegram handlers, CLI commands, or scheduled jobs can then adapt their native inputs into this controller-level shape.

Controllers answer questions such as:

- where is the input in the normalized request?
- which use case should handle this application request?
- which request fields become use case arguments?
- should multiple use cases be called to serve this request?
- what plain response shape should be returned to the delivery adapter?

Examples from the article:

- `AuthController` receives normalized request data and calls `RegisterUser`, `LoginUser`, `AuthorizeUser`, and related use cases.
- `ArticleController` calls use cases such as `ArticleFeed`, `ViewArticle`, `CreateArticle`, `UpdateArticle`, and `DeleteArticle`.
- `ScriptsController` can reuse the same use cases from a CLI entrypoint.

Infrastructure routes still exist. For example, Express routes parse HTTP requests, instantiate controllers with configured use cases, and send HTTP responses. The controller should be reusable without importing Express request/response objects.

### Infrastructure

Infrastructure contains concrete details:

- HTTP framework setup and routes;
- Telegram bot handlers;
- CLI entrypoints;
- database clients and repository implementations;
- ORM or query builder models;
- migrations;
- external API clients;
- validation library adapters;
- crypto, token, and SDK-specific helpers.

Infrastructure may import inward layers. Inward layers should not import infrastructure.

Examples from the article:

- `MySQLUserDAO` implements `IUserDAO` using a concrete MySQL client.
- `MySQLArticleDAO` implements `IArticleDAO`.
- Joi schemas and `JOIValidator` live under infrastructure validation.
- password hashing, token issuing, and token verification utilities live in infrastructure utilities.
- Express API routes live under infrastructure because Express is a delivery detail.

For larger projects, it can be useful to split entrypoints from infrastructure:

```text
entrypoints/
infrastructure/
```

For smaller projects, keeping API, CLI, and adapter implementations under `infrastructure/` is often sufficient.

The same tradeoff applies to HTML or UI rendering. If rendering is a thin delivery detail, it can live inside `infrastructure/` next to the HTTP adapter:

```text
infrastructure/
  http/
  views/
```

If presentation has its own models, formatting rules, templates, or multiple delivery variants, a separate presentation layer can make the boundary clearer:

```text
presentation/
infrastructure/
```

In both variants, presentation code should adapt use case results for display. It should not become the place where business rules live.

## Common Placement Decisions

### Validation

Validation has two parts:

- validation implementation, such as Zod, Joi, or custom parsers;
- the business decision that data must be valid before a use case continues.

The implementation typically belongs in `infrastructure/validation`. The use case should call an injected validator or parse result when validation is part of the business process. Avoid hiding business validation entirely inside HTTP middleware if the same use case can be called from another entrypoint.

Article example:

```text
interfaces/
  validator.ts        # IValidator<T>
infrastructure/
  validation/
    joi/
      validator.ts    # JOIValidator<T>
      user/register.ts
      article/createUpdate.ts
```

Use cases receive a validator through their constructor and throw a validation/application error when validation fails. This keeps Joi/Zod/etc. replaceable while still keeping the decision to validate inside the business flow.

### Authentication And Authorization

Token parsing, password hashing, session storage, and provider-specific OAuth calls are infrastructure details. The decision that a user must be authorized, or must have a specific role, belongs in use cases or application services.

### Data Access And ORMs

Repositories, DAOs, or gateways are interfaces. SQL clients, ORM models, query builders, and API SDKs are infrastructure.

Do not make ORM models your entities. If an ORM is used, keep ORM-specific models in infrastructure and map them to application entities or DTOs at the boundary.

Article example:

```text
interfaces/
  user/
    userDAO.ts        # IUserDAO
  article/
    articleDAO.ts     # IArticleDAO
infrastructure/
  data-access/
    mysql/
      userDAO.ts      # MySQLUserDAO implements IUserDAO
      articleDAO.ts   # MySQLArticleDAO implements IArticleDAO
```

The use case imports `IUserDAO`; the infrastructure DAO imports and implements that interface. The dependency points inward.

### Migrations

Migrations are tied to a concrete persistence technology. They usually belong next to the matching adapter, for example:

```text
infrastructure/data-access/postgres/migrations/
```

This keeps database-specific setup with the database-specific implementation.

### External Services

External APIs, SDK clients, LLM clients, email clients, payment clients, and Trello clients are infrastructure adapters. Use cases should depend on a gateway interface that describes the application need, not on the provider's SDK shape.

### Configuration And Composition

`config/` can hold environment-derived settings, constants, and service wiring. A `config/services.ts` file, dependency container, or composition root can centralize concrete implementation choices.

This is useful when adapters may be replaced, such as swapping MySQL for PostgreSQL or changing a validation library. In small projects, direct wiring near the entrypoint may be simpler.

Article example:

```text
config/
  services.ts
```

`services.ts` can expose which DAO classes, validators, and utility functions the infrastructure entrypoints should wire into controllers/use cases. This is not required for every project, but it can make replacements explicit: swap `MySQLUserDAO` for another DAO in one composition location instead of changing use cases.

## Examples

### Register User

```text
Entity:       User / AuthUser
Interface:    IUserDAO, IValidator<AuthUser>
Use case:     RegisterUser
Infrastructure: JOI register validator, MySQLUserDAO, encryptPassword
Controller:   AuthController.register
Entrypoint:   Express route or CLI command
```

Flow:

1. Entrypoint adapts HTTP/CLI input into a plain request.
2. Controller extracts registration payload.
3. Use case validates payload through `IValidator<AuthUser>`.
4. Use case hashes/encrypts password through an injected utility.
5. Use case creates the user through `IUserDAO`.
6. Infrastructure DAO persists it in MySQL.

The use case does not know whether the request came from HTTP or CLI, and it does not know how MySQL is queried.

### Create Article

```text
Entity:       Article, User
Interface:    IArticleDAO, IValidator<Article>
Use case:     CreateArticle
Infrastructure: JOI article validator, MySQLArticleDAO
Controller:   ArticleController.create
Entrypoint:   Express route
```

Flow:

1. Controller receives the authorized user and article payload.
2. Use case validates article data.
3. Use case assigns `authorID` from the current user.
4. Use case applies default publication state when needed.
5. Use case calls `IArticleDAO.create`.

The rule “the current user becomes the author” belongs in the use case, not in the route handler or DAO.

### Trello Card From Draft

For this project, the same pattern maps naturally:

```text
Entity/model: task draft or generated task content
Interface:    task generator, Trello cards gateway, auth context provider, validator
Use case:     CreateTrelloTask
Infrastructure: OpenAI/LLM adapter, Trello REST adapter, Zod validators
Controller:   Bot destination handler or App API controller
Entrypoint:   Telegraf handler or Express route
```

The use case should know that a Trello task requires valid draft text, selected board/list data, active Trello auth, generated content, and a card creation gateway. It should not know how Telegraf stores sessions, how OpenAI response JSON is shaped, or how Trello HTTP URLs are built.

## Do's And Don'ts

### Do

- Do name use cases after business actions: `RegisterUser`, `CreateArticle`, `CreateTrelloTask`, `DisconnectTrelloAccount`.
- Do inject dependencies into use cases as interfaces: DAO/repository, gateway, validator, clock, token utility, notifier.
- Do keep provider SDKs, HTTP clients, SQL clients, and validation libraries in infrastructure.
- Do keep controller inputs and outputs plain enough to be reused by HTTP, CLI, bot handlers, tests, or jobs.
- Do let use cases enforce business preconditions: current user must exist, user must be authorized, draft must be valid, article author must be assigned.
- Do keep DAOs/repositories/gateways as ports in `interfaces/` and implementations in `infrastructure/`.
- Do keep migrations close to the concrete persistence adapter.
- Do use composition roots, such as `config/services.ts`, when wiring becomes repetitive or when implementations may be swapped.
- Do test use cases with fake DAOs/gateways/validators before testing full infrastructure.
- Do map infrastructure-specific payloads into application/domain types at the boundary.

### Don't

- Do not import Express, Telegraf, Vue, `pg`, ORM models, Trello SDKs, OpenAI SDKs, Joi, or Zod directly into entities or use cases.
- Do not make a database table row or ORM model your entity.
- Do not put business rules only in HTTP middleware, route handlers, Telegram handlers, or SQL queries.
- Do not turn use cases into thin CRUD wrappers unless the project is intentionally that small.
- Do not let controllers decide business rules such as ownership, authorization, publication defaults, or whether a task can be created.
- Do not let DAOs/gateways decide product behavior; they should execute persistence/API operations requested by the use case.
- Do not pass framework request/response objects into use cases.
- Do not expose provider-specific auth details to every controller when a use case can depend on an auth/context provider.
- Do not add broad interfaces before a use case needs them; grow ports from concrete use-case needs.
- Do not create a presentation layer only because the diagram has one; add it when formatting/presentation logic becomes substantial.

## When To Use It

Clean Architecture is most useful when:

- the product has meaningful business rules;
- several entrypoints need the same behavior;
- external providers or frameworks may change;
- tests should cover business logic without real infrastructure;
- the codebase is expected to grow over time.

It may be excessive when:

- the application is small and mostly framework glue;
- the feature set is fixed and unlikely to evolve;
- development speed matters more than long-term replaceability;
- the team does not need multiple entrypoints or provider swaps.

The approach adds structure and upfront design cost. That cost is easier to justify when the product is complex, long-lived, or likely to change in ways that would otherwise couple business rules to infrastructure.

## Implementation Checklist

- Keep business rules in `entities/` and `use-cases/`.
- Define ports in `interfaces/` before binding to a concrete implementation.
- Inject dependencies into use cases instead of importing infrastructure directly.
- Keep framework request/response objects out of use cases.
- Keep ORM models and SDK response shapes out of entities.
- Put migrations and provider-specific setup near their adapters.
- Use `config/` or a composition root to wire concrete implementations.
- Test use cases with fake interfaces before testing full infrastructure.

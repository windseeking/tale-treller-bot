# Clean Architecture

When I first learned about
clean architecture, I was quite intrigued. And the more
I learned about it — the more I got hooked. But there
was one problem: At the time, I couldn’t find good and
clear enough examples to get started. I was focusing
primarily on JS, and there weren’t too many relevant
examples on JS specifically. So I had to figure stuff
out on the go and apply my favorite “Learning by doing”
principle. Now, that I am more comfortable with this
approach — I’d like to provide what I was missing at the
time — A clear guide that shows how to set up a
NodeJS-specific clean architecture app, that provides a
general outline and answers some of the common questions
I had (Where to put auth/validations, how to tie the
business-logic and the implementations together,
etc).

It’s important to note that
this is probably not a “100% clean architecture done by
the book” application. However, We will cover a
‘battle-tested’ approach, that I used on real projects.
An approach that always came out pretty good, and saved
me a lot of time and effort on code rewrites after new
features came in 🙂. So, let’s get this started.

A lot of examples I saw —
were mostly setting up a blank project or explaining
basic concepts. It was great and all, but as soon as I
tried to apply any of the guides to a real project, I
wound up with more questions than answers. So for this
example — we’ll create an almost real-world API for a
content platform. An API will be able to list published
articles and show an individual article by ID. On top of
that, we’ll make a registration/login for users. Then we
allow logged-in users to create/edit/delete their own
articles, and have a basic admin API, where admin users
can create/edit/delete user profiles. This is still
pretty far from a real-world product but it should cover
most of the caveats, and give you an idea of how you can
organize stuff in your future applications.

## Initial Project.

For this tutorial, I assume
you have NodeJS and npm installed, and know how to use
them. For starters, let’s create a NodeJS application
with npm.

```
npm init
```

Enter the project name,
description, version, and other related info. As you
know, in clean architecture — framework, database/ORMs,
and other stuff like that are just details. So, for now,
we can skip all the steps you usually do when creating a
new project and start building. But we do need to
install a couple of essential packages to make things
run smoothly:

```
npm i --save-dev typescript ts-node @types/node dotenv
```

Of course, we’re going to
use Type Script (With the whole clean architecture, it
would be a waste not to utilize static typing and
interfaces), `ts-node`, and
`@types/node`
packages are required for running typescript locally
(But we better build it to native JS in production
environments).

You’d also need to generate
a `ts-config.json`
with the following command:

```
npx tsc --init
```

## Folder structure.

I battled with this a lot in
my time. None of the proposed options seemed to work for
me, so I took a little bit of best practices here and
there and came up with this 🙂

```
app/  
 bin/ # This folder would be an entrypoint-script(s) to our app  
 dist/ # Here, we'll have the built code for production version  
 src/  
 config/ # App's constants/enums/other configuration  
 interfaces/ # Interfaces for different parts of an app  
 controllers/ # These are called by your implementation (infrastructure) layer.  
 entities/ # Core business objects will be here.  
 use-cases/ # Core business logic goes here  
 infrastructure/ # This folder will contain actual implementations  
 temp/ # Misc. and temp files would go here, delete if not needed  
 .env # An app's environment and sensitive information  
 package.json  
 tsconfig.json
```

Since this is an API — we’re
only dealing with JSON responses. If you ever need HTML

- you should be able to add it after you give it some
  thought. I’d probably treat HTML as a detail and render
  it inside the `infrastructure`
  layer to keep things simple. Alternatively, we can add a
  `presentation` layer
  for it. Honestly, I’m not sure which way is more in line
  with clean architecture. Presenter is a valid concept of
  clean architecture, but HTML can also be treated as a
  detail. I guess it boils down to what works best for
  your product.

##   

Entities

As we know, the very first
thing in clean architecture is the `Entity`. Remember
that entities are core business objects, that aren't
affected by any code (e.g. in the real world - The user
would have a first and last name regardless if your app
exists or not). With that in mind, let's create `User` and `Article` entities

```
// app/src/entities/user.ts  
  
import Article from './article'  
import Entity from './entity'  
  
export default class User extends Entity<User> {  
 id!: number  
 firstName!: string  
 lastName!: string  
 email!: string  
 role!: 'user' | 'admin'  
 articles?: Article[]  
}
```

```
// app/src/entities/article.ts  
  
import Entity from './entity'  
import User from './user'  
  
export default class Article extends Entity<Article> {  
 id!: number  
 isPublished!: boolean  
 title!: string  
 description?: string  
 content!: string  
 author?: User  
 authorID!: number  
}
```

You’ve probably noticed that
each entity class inherits a parent `Entity` class. As
you know, we don't (and can't) have any dependencies
here. Only on other entities. But, for convenience, I
like to create a Base `Entity`
class with a constructor and inherit all the entities
from it. This class is on the same layer, so it’s
technically not cheating 😆

```
// app/src/entities/entity.ts  
  
export default class Entity<T> {  
 constructor(attrs?: Partial<T>) {  
 if (attrs) {  
 Object.assign(this, attrs)  
 }  
 }  
}
```

I like to use a base class
because now we’ll be able to do this:

```
const user = new User({ id: 1, firstName: 'Jonathan', lastName: 'Doe' ... })
```

You can skip this step if
you want, but I decided to put it here for
convenience.



>
> *In modern versions of TypeScript, in
> order for it to work — you’ll have to add* `*"useDefineForClassFields":
>  false*` *to your* `*tsconfig.json*`
>
>
>


Now, we have established
that our API will be able to register and login users,
but our `User`
entity does not have any attributes for that. Initially,
I had `password` and
`salt` as attributes
for the `User`
entity. But as I progressed, it became more and more
problematic to specify the correct typing and omit those
fields in all the files. After all, there are a dozen
use cases for users, but only two of them need that
`password` and `salt` attributes.
So I ended up creating a separate entity just for auth
purposes:

```
// app/src/entities/authUser.ts  
  
import User from './user'  
  
export default class AuthUser extends User {  
 password!: string  
 salt!: string  
 confirmPassword?: string  
}
```

This entity is still related
to a user but can be called all the auth-related
scenarios in our app.

The `app/src/entities/index.ts`
file is just an import/export of the entire folder, and
looks like this:

```
// app/src/entities/index.ts  
  
import Article from './article'  
import User from './user'  
import AuthUser from './authUser'  
  
export { User, AuthUser, Article }
```

It’s something that I like
to do for convenience (all related imports across the
app come from a single path), you can omit it if you
like, but it’s a good practice.

With that handled — we can
now move up a layer and figure out what our app can
do.

##   

Use cases

Use cases are my favorite
part of this entire concept, as they provide a great
overview of what a particular product is built for. It
was a bit tricky for me to figure out how to structure
use cases. After some time spent on real-world products
— structuring by entity worked best for me. But if you
have a particular functionality that doesn’t fit into a
single or any entity — there’s no problem with
structuring it by domain. After all, the purpose of use
cases is to describe business processes and show what
your app can do. So for our example, let’s structure use
cases like this:

```
use-cases/  
 user/  
 authorizeAdmin.ts  
 authorize.ts  
 create.ts  
 delete.ts  
 fetchAuthorized.ts  
 index.ts  
 list.ts  
 login.ts  
 profile.ts  
 register.ts  
 update.ts  
 article/  
 create.ts  
 delete.ts  
 feed.ts  
 index.ts  
 update.ts  
 userArticles.ts  
 view.ts
```

This may look to you like a
list of [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
or DB-read/write operations. But don’t be fooled. A use
case describes a single business process or some part of
a business logic. Here specifically, they only look like
CRUD, because our application is fairly simple. In a
real-world app, a single business task can involve
multiple CRUD operations from/into different sources.
Just for demonstration purposes, here’s how a use-case
folder might look in a real-world product:

```
user/  
 appointmentCheckIn.ts  
 assignToSalesRep.ts  
 trackVisit.ts  
 getSalesInfo.ts  
 index.ts  
 removeFromQueue.ts  
 syncWithSalesApi.ts
```

The point is that you
shouldn’t turn use cases into DB-access
tools/interfaces. Keep in mind that we don’t have a DB
yet 😉 This may be a bit confusing, but I hope things
will get clear once we see the code.

Back to our use cases — we
have quite a lot of them, and trying to describe each
one separately would grow into a separate article just
for the `use cases`
layer of this specific application. So I’ll only
describe some of the note-worthy things to give you an
idea of what I had in mind.

```
// src/use-cases/user/register.ts  
  
import { IUseCase, IValidator } from '../../interfaces'  
import { IUserDAO } from '../../interfaces/user'  
import { AuthUser, User } from '../../entities'  
import { ValidationError } from '../../errors'  
  
export default class RegisterUser implements IUseCase<User> {  
 constructor(  
 protected validator: IValidator<AuthUser>,  
 protected userDAO: IUserDAO,  
 protected encryptPassword: (password: string) => Promise<{ password: string; salt: string }>,  
 ) {}  
  
 async call(payload: Partial<AuthUser>): Promise<User> {  
 const { data, errors } = this.validator.validate(payload)  
 if (errors && errors.length > 0) {  
 console.error(errors)  
 throw new ValidationError('The data is invalid', errors)  
 }  
 delete data.confirmPassword  
  
 const { password, salt } = await this.encryptPassword(data.password)  
 Object.assign(data, {  
 role: 'user',  
 password,  
 salt,  
 })  
  
 return this.userDAO.create(data)  
 }  
}
```

Don’t be scared of a bunch
of imports on top. Those are interfaces, and we’ll cover
them shortly 😉

Meanwhile, as you can see
here we have a class with a single `call` method.
That method solves a single business task (Registers a
new user in this case). We can (and most likely should)
operate with Entities here. We also utilize all the
available tools at our disposal to solve this issue.
These tools are [injected](https://en.wikipedia.org/wiki/Dependency_injection) into our
use case in a class constructor. It’s important to be as
abstract here as possible. For instance, when we
register a new user — We do have a general idea of how
this process would work.   
First, we need to check if
the provided data is valid, so there’s a validator. we
don’t need to know exactly what package or code we will
use for it yet, but we do have an idea that it should
take our data as arguments check it, and get back to us,
plus - specify errors or invalid parts, if any. We can
work with that, and create an interface for it (We’ll do
it in the next layer).  
The next step is, if the data
is valid, we need to encrypt a password before we store
it. We don’t know yet how exactly we’re going to do it,
but it’s pretty safe to assume, that it would be a
function that would take the raw password as an argument
and return the encrypted one. After that’s dealt with -
we’re ready to store our data. We don’t know where we’ll
store it, but we do know that all the data storage
operations will be done through our DAOs ([Data
Access Objects](https://en.wikipedia.org/wiki/Data_access_object)) it could be stored in a
database, a file, an external API, or even sent
somewhere in a paper mail for all we know. All we need
to establish at that point is that our DAO will have a
`create` method,
that’ll take our user data, do its thing, and return an
instance of our new `User` entity.

By the way, a return type
does not necessarily need to be an Entity. I decided,
that this Use Case would return a new User object. But
in the real world, you may need to look at how your data
is used by whoever is using your API. Maybe there’s a
front-end app that just redirects you to a login or
“thank you” page after successful registration. In that
case — you’ll probably want to save yourself the trouble
and return a `boolean` value,
indicating that the registration was successful.

That’s pretty much the
concept of a use case in a nutshell. When I was just
starting with clean architecture and writing my first
use cases — not all of it was obvious. For instance,
after a brief research — I’ve figured out that our DAOs
should be simply an interface, that’s injected in a use
case. However, I struggled to decide where to put
validations and utility functions for small things like
encrypting a password or issuing an auth token. This was
especially confusing after you got used to validating
requests inside `Express`
middleware. For a minute there, I thought that they
should be in their own respective use cases, or simply
parts of controllers. But after giving it some thought,
I figured that validation of data is not really a
business task in itself, it’s more of a tool or even a
prerequisite to solving a business task, so I settled on
a “detail” that’s being injected in a use case.

As I said, I see no point in
looking at each use case under a microscope, so I’ll
just add the code for them below and we’ll continue:

```
// src/use-cases/user/login.ts  
  
import { User } from '../../entities'  
import { UnauthorizedError, ValidationError } from '../../errors'  
import { IUseCase } from '../../interfaces'  
import { ILoginResponse, IUserDAO } from '../../interfaces/user'  
  
export default class LoginUser implements IUseCase<ILoginResponse> {  
 constructor(  
 protected userDAO: IUserDAO,  
 protected comparePasswords: (input: string, encrypted: string) => Promise<boolean>,  
 protected issueToken: (payload: Partial<User>) => string,  
 ) {}  
  
 async call(email: string, password: string): Promise<ILoginResponse> {  
 if (!email || !password) {  
 throw new ValidationError('Email and Password are required')  
 }  
 const user = await this.userDAO.findForAuth(email)  
 const passwordsMatch = user ? await this.comparePasswords(password, user.password) : false  
  
 if (user && passwordsMatch) {  
 const { id, firstName, lastName, email, role } = user  
 return {  
 user: { id, firstName, lastName, email, role },  
 token: this.issueToken({ id, firstName, lastName, email }),  
 }  
 } else {  
 throw new UnauthorizedError('Invalid login or password')  
 }  
 }  
}
```

```
// src/use-cases/user/authorize.ts  
  
import { User } from '../../entities'  
import { IUserDAO } from '../../interfaces/user'  
import { IUseCase } from '../../interfaces'  
import { UnauthorizedError } from '../../errors'  
  
export default class AuthorizeUser implements IUseCase<User> {  
 constructor(  
 protected userDAO: IUserDAO,  
 protected verifyToken: (token: string) => User,  
 ) {}  
  
 async call(token: string): Promise<User> {  
 if (!token) {  
 throw new UnauthorizedError('You`re not authorized')  
 }  
 const { id } = this.verifyToken(token)  
 const user = await this.userDAO.findOneBy({ id })  
 if (!user) {  
 throw new UnauthorizedError('You`re not authorized')  
 }  
  
 return user  
 }  
}
```

```
// src/use-cases/user/authorizeAdmin.ts  
  
import { User } from '../../entities'  
import { IUserDAO } from '../../interfaces/user'  
import { IUseCase } from '../../interfaces'  
import { UnauthorizedError } from '../../errors'  
  
export default class AuthorizeAdmin implements IUseCase<User> {  
 constructor(  
 protected userDAO: IUserDAO,  
 protected verifyToken: (token: string) => User,  
 ) {}  
  
 async call(token: string): Promise<User> {  
 if (!token) {  
 throw new UnauthorizedError('You`re not authorized')  
 }  
 const { id } = this.verifyToken(token)  
 const user = await this.userDAO.findOneBy({ id, role: 'admin' })  
 if (!user) {  
 throw new UnauthorizedError('You`re not authorized')  
 }  
 return user  
 }  
}
```

```
// src/use-cases/user/fetchAuthorized.ts  
  
import { User } from '../../entities'  
import { IUseCase } from '../../interfaces'  
import { IUserDAO } from '../../interfaces/user'  
  
export default class FetchAuthorisedUser implements IUseCase<User | null> {  
 constructor(  
 protected userDAO: IUserDAO,  
 protected verifyToken: (token: string) => User,  
 ) {}  
  
 async call(token: string): Promise<User | null> {  
 if (!token) {  
 return null  
 }  
 try {  
 const { id } = this.verifyToken(token)  
 const user = await this.userDAO.findOneBy({ id })  
 return user  
 } catch {  
 return null  
 }  
 }  
}
```

```
// src/use-cases/user/list.ts  
  
import { User } from '../../entities'  
import { IPaginated, IUseCase } from '../../interfaces'  
import { IUserDAO } from '../../interfaces/user'  
  
export default class ListUsers implements IUseCase<IPaginated<User>> {  
 constructor(protected userDAO: IUserDAO) {}  
  
 async call(page: number = 1, perPage: number = 10): Promise<IPaginated<User>> {  
 return this.userDAO.listUsers({}, page, perPage)  
 }  
}
```

```
// src/use-cases/user/profile.ts  
  
import { User } from '../../entities'  
import { NotFoundError } from '../../errors'  
import { IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
import { IUserDAO } from '../../interfaces/user'  
  
export default class UserProfile implements IUseCase<User> {  
 constructor(  
 protected userDAO: IUserDAO,  
 protected articleDAO: IArticleDAO,  
 ) {}  
  
 async call(id: number, articlesPage?: number, articlesPerPage?: number): Promise<User> {  
 const user = await this.userDAO.findOneBy({ id })  
 if (!user) {  
 throw new NotFoundError('User was not found')  
 }  
 const articles = await this.articleDAO.userPublishedArticles(  
 user.id,  
 articlesPage,  
 articlesPerPage,  
 )  
 Object.assign(user, { articles })  
 return user  
 }  
}
```

```
// src/use-cases/user/create.ts  
  
import { AuthUser, User } from '../../entities'  
import { IUserDAO } from '../../interfaces/user'  
import { IUseCase, IValidator } from '../../interfaces'  
import { ValidationError } from '../../errors'  
  
export default class CreateUser implements IUseCase<User> {  
 constructor(  
 protected validator: IValidator<AuthUser>,  
 protected userDAO: IUserDAO,  
 protected encryptPassword: (password: string) => Promise<{ password: string; salt: string }>,  
 ) {}  
  
 async call(  
 payload: Pick<AuthUser, 'email' | 'firstName' | 'lastName' | 'role' | 'password'>,  
 ): Promise<User> {  
 const { data, errors } = this.validator.validate(payload)  
 if (errors && errors.length > 0) {  
 throw new ValidationError('The data is invalid', errors)  
 }  
 const { password, salt } = await this.encryptPassword(data.password)  
 Object.assign(data, {  
 password,  
 salt,  
 })  
 return this.userDAO.create(data)  
 }  
}
```

```
// src/use-cases/user/update.ts  
  
import { AuthUser } from '../../entities'  
import { ValidationError } from '../../errors'  
import { IUseCase, IValidator } from '../../interfaces'  
import { IUserDAO } from '../../interfaces/user'  
type UserPayload = Pick<  
 AuthUser,  
 'email' | 'firstName' | 'lastName' | 'password' | 'confirmPassword'  
>  
type AdminPayload = UserPayload & { role: 'admin' | 'user' }  
  
export default class UpdateUser implements IUseCase<boolean> {  
 constructor(  
 protected validator: IValidator<UserPayload | AdminPayload>,  
 protected userDAO: IUserDAO,  
 protected encryptPassword: (password: string) => Promise<{ password: string; salt: string }>,  
 ) {}  
  
 async call(id: number, payload: UserPayload | AdminPayload): Promise<boolean> {  
 const { data, errors } = this.validator.validate(payload)  
 if (errors && errors.length > 0) {  
 throw new ValidationError('Data is invalid', errors)  
 }  
 if (data.password) {  
 const { password, salt } = await this.encryptPassword(data.password)  
 Object.assign(data, {  
 password,  
 salt,  
 })  
 } else {  
 delete (data as Partial<UserPayload | AdminPayload>).password  
 }  
 delete (data as Partial<UserPayload | AdminPayload>).confirmPassword  
   
 return this.userDAO.update(id, data)  
 }  
}
```

```
// src/use-cases/user/delete.ts  
  
import { IUseCase } from '../../interfaces'  
import { IUserDAO } from '../../interfaces/user'  
  
export default class DeleteUser implements IUseCase<boolean> {  
 constructor(protected userDAO: IUserDAO) {}  
  
 async call(id: number): Promise<boolean> {  
 return this.userDAO.delete(id)  
 }  
}
```

Now, let’s create use cases
for an article:

```
// src/use-cases/article/feed.ts  
  
import { Article } from '../../entities'  
import { IPaginated, IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class ArticleFeed  
 implements IUseCase<IPaginated<Pick<Article, 'id' | 'title' | 'description' | 'author'>>>  
{  
 constructor(protected articleDAO: IArticleDAO) {}  
  
 async call(  
 page: number,  
 perPage: number,  
 ): Promise<IPaginated<Pick<Article, 'id' | 'title' | 'description' | 'author'>>> {  
 if (!page || !perPage) {  
 throw new Error('Please set pagination params')  
 }  
 return this.articleDAO.listAsFeed(page, perPage)  
 }  
}
```

```
// src/use-cases/article/view.ts  
  
import { Article } from '../../entities'  
import { NotFoundError } from '../../errors'  
import { IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class ViewArticle implements IUseCase<Article> {  
 constructor(protected articleDAO: IArticleDAO) {}  
  
 async call(id: number, userID?: number): Promise<Article> {  
 const article = await this.articleDAO.findOne(id)  
 if (!article || (!article.isPublished && article.authorID !== userID && !!article.authorID)) {  
 throw new NotFoundError('Article was not found')  
 }  
 return article  
 }  
}
```

```
// src/use-cases/article/create.ts  
  
import { Article, User } from '../../entities'  
import { ValidationError } from '../../errors'  
import { IUseCase, IValidator } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class CreateArticle implements IUseCase<Article> {  
 constructor(  
 protected validator: IValidator<Article>,  
 protected articleDAO: IArticleDAO,  
 ) {}  
  
 async call(  
 user: User,  
 payload: Pick<Article, 'title' | 'description' | 'content' | 'isPublished'>,  
 ): Promise<Article> {  
 const { data, errors } = this.validator.validate(payload)  
 if (errors && errors.length > 0) {  
 throw new ValidationError('The data is invalid', errors)  
 }  
 const article = new Article(data)  
 Object.assign(article, {  
 authorID: user.id,  
 isPublished: data.isPublished || false,  
 })  
  
 return this.articleDAO.create(article)  
 }  
}
```

```
// src/use-cases/article/update.ts   
  
import { Article, User } from '../../entities'  
import { NotFoundError, UnauthorizedError } from '../../errors'  
import { IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class UpdateArticle implements IUseCase<Article> {  
 constructor(protected articleDAO: IArticleDAO) {}  
  
 async call(  
 id: number,  
 user: Pick<User, 'id' | 'role'>,  
 payload: Pick<Article, 'title' | 'content' | 'description' | 'isPublished'>,  
 ): Promise<Article> {  
 const article = await this.articleDAO.findOne(id)  
 if (!article) {  
 throw new NotFoundError('Article not found')  
 }  
 if (article.authorID !== user.id && user.role !== 'admin') {  
 throw new UnauthorizedError('You are not allowed to update this article')  
 }  
  
 return this.articleDAO.update(id, payload)  
 }  
}
```

```
// src/use-cases/article/delete.ts  
  
import { User } from '../../entities'  
import { IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class DeleteArticle implements IUseCase<boolean> {  
 constructor(protected articleDAO: IArticleDAO) {}  
  
 async call(id: number, user: Pick<User, 'id' | 'role'>): Promise<boolean> {  
 if (user.role === 'admin') {  
 return this.articleDAO.delete(id)  
 }  
 return this.articleDAO.delete(id, user.id)  
 }  
}
```

```
// src/use-cases/article/userArticles.ts  
  
import { Article } from '../../entities'  
import { IUseCase } from '../../interfaces'  
import { IArticleDAO } from '../../interfaces/article'  
  
export default class UserArticlesList  
 implements IUseCase<Pick<Article, 'id' | 'title' | 'description' | 'isPublished'>[]>  
{  
 constructor(protected articleDAO: IArticleDAO) {}  
  
 async call(  
 userID: number,  
 publishedOnly: boolean = true,  
 page?: number,  
 perPage?: number,  
 ): Promise<Pick<Article, 'id' | 'title' | 'description' | 'isPublished'>[]> {  
 return publishedOnly  
 ? await this.articleDAO.userPublishedArticles(userID, page, perPage)  
 : await this.articleDAO.userAllArticles(userID, page, perPage)  
 }  
}
```

## What’s with the

errors?

Apart from all the
interfaces, you may have noticed an odd import from
`errors`. That’s not
quite a layer or even a concept in clean architecture.
It’s just another thing that I like to add for
convenience. At the top layers of our application
(infrastructure/implementation) we would need to handle
our errors. And I like my errors to be predictable and
well-structured. All error classes are pretty generic
and I can’t say that they’re coupled with implementation
in any way. So we’re not really violating the ‘clean
code’ practices.

To get it out of the way —
I’m just going to list the `IError` interface
and all the error types we’ll have in our app:

```
// src/interfaces/error.ts  
  
export default interface IError {  
 name: string  
 message: string  
 httpStatus: number  
 details?: unknown  
}
```

P.S. `httpStatus` here can
be controversial in terms of clean code, since HTTP is a
detail, and our core application shouldn’t know and care
about it. So if it bothers you too much - you can
replace it with a more abstract `errorCode` or
even remove it altogether. I reasoned that I’ll still
need to assign an HTTP status to an API response, so why
would I need to have a separate structure that tells
which error has which HTTP status of a bunch of
if-statements, when I can simply store the status code
in an error itself? Plus, having this attribute wouldn’t
break anything if our app wasn’t an API, it would just
be there and that’s all. So I assumed it was a fair
trade-off.

Our errors look like
this:

```
// src/errors/notFoundError.ts  
  
import { IError } from '../interfaces'  
  
export class NotFoundError extends Error implements IError {  
 public name = 'NotFoundError'  
 public httpStatus = 404  
  
 constructor(public message: string = 'Record not found') {  
 super(message)  
 }  
}
```

```
// src/errors/unauthorizedError.ts  
  
import { IError } from '../interfaces'  
  
export class UnauthorizedError extends Error implements IError {  
 public name = 'UnauthorizedError'  
 public httpStatus = 401  
  
 constructor(public message: string = 'Unautorized') {  
 super(message)  
 }  
}
```

```
// src/errors/validationError.ts  
  
import { IError } from '../interfaces'  
  
export class ValidationError extends Error implements IError {  
 public name = 'ValidationError'  
 public httpStatus = 422  
  
 constructor(  
 public message: string = 'Provided data is invalid',  
 public details?: { field: string; message: string }[] | string[],  
 ) {  
 super(message)  
 }  
}
```

Now, that’s that settled —
we can move up another layer and talk about the elephant
in the room.

##   

Interfaces

Interfaces are ports or
adapters, that make us very flexible with our
implementations and technologies that can be used. In
Clean Architecture, interfaces can present pretty much
everything, from a structured input a particular
use-case expects to receive, all the way to classes
we’ll use to access DB and/or encrypt data. In our use
cases, we noticed quite a few of those, like `IUseCase`, `IUserDAO`, etc.
So let's go ahead and describe those. P.S. We'll be
structuring interfaces similarly to the way we
structured use cases. But I'd like to put generic ones
on top:

```
interfaces/  
 user/  
 index.ts  
 userDAO.ts  
 userLoginResponse.ts  
 article/  
 articleDAO.ts  
 index.ts  
 error.ts  
 paginated.ts  
 useCase.ts  
 validator.ts  
 request.ts  
 index.ts
```

We’ll start with generic
interfaces. We’ve already described `IError` in a
previous section. Now let's see the`IUseCase`, `IValidator`, and
`IPaginated`:

```
// src/interfaces/useCase.ts  
  
export default interface IUseCase<T> {  
 call(...args: unknown[]): T | Promise<T>  
}
```

```
// src/interfaces/paginated.ts  
  
export default interface IPaginated<T> {  
 data: T[]  
 pagination: {  
 page: number  
 perPage: number  
 }  
}
```

```
// src/interfaces/validator.ts  
  
export interface IValidationResult<T> {  
 errors?: string[]  
 value: T  
}  
  
export default interface IValidator<T> {  
 validate(body: Partial<T>): IValidationResult<T>  
}
```

```
// src/interfaces/request.ts  
  
export default interface IRequest {  
 token?: string  
 params?: Record<string, string | number | boolean>  
 body?: unknown  
}
```

We’re already familiar with
`IValidator` and
`IUseCase`. First is
what we're going to inject in use cases to handle
validation. `IUseCase` is sort
of a unified format for all the use cases. This
interface, just as`IRequest`
will be needed later, in controllers.

Now for the user, and
article-related interfaces:

```
// src/interfaces/user/loginResponse.ts  
  
import { User } from '../../entities'  
  
export default interface ILoginResponse {  
 user: Partial<User>  
 token: string  
}
```

```
// src/interfaces/user/userDAO.ts  
  
import { User } from "../../entities";  
import { AuthUser, User } from '../../entities'  
import IPaginated from '../paginated'  
  
export default interface IUserDAO {  
 listUsers(filters: Partial<User>, page: number, perPage: number): Promise<IPaginated<User>>  
 findOneBy(filters: Partial<User>): Promise<User | null>  
 findForAuth(email: string): Promise<AuthUser | null>  
 create(payload: Partial<User>): Promise<User>  
 update(id: number, payload: Partial<User>): Promise<boolean>  
 delete(id: number): Promise<boolean>  
}
```

```
// src/interfaces/article/articleDAO.ts  
  
import { Article } from '../../entities'  
import IPaginated from '../paginated'  
  
export default interface IArticleDAO {  
 userPublishedArticles(  
 userID: number,  
 page?: number,  
 perPage?: number,  
 ): Promise<Pick<Article, 'id' | 'title' | 'description' | 'isPublished'>[]>  
 userAllArticles(  
 userID: number,  
 page?: number,  
 perPage?: number,  
 ): Promise<Pick<Article, 'id' | 'title' | 'description' | 'isPublished'>[]>  
 listAsFeed(  
 page: number,  
 perPage: number,  
 ): Promise<IPaginated<Pick<Article, 'id' | 'title' | 'description' | 'author'>>>  
 findOne(id: number): Promise<Article | null>  
 create(  
 payload: Pick<Article, 'title' | 'description' | 'content' | 'author' | 'isPublished'>,  
 ): Promise<Article>  
 update(  
 id: number,  
 payload: Pick<Article, 'title' | 'description' | 'content' | 'author' | 'isPublished'>,  
 ): Promise<Article>  
 delete(id: number, userID?: number): Promise<boolean>  
}
```

And just like this, we’ve
defined a backbone for our future data storage. We don’t
care what it is or how it's implemented. As long as it
is in line with our interfaces, our app will work just
fine.  
Do keep in mind, that whatever
interfaces/methods you describe here — are not carved in
stone. As you build your app (especially during the
implementation stage) you may (and probably will) revise
some input data structures, add new methods, etc. For
example, the code samples you see now — are from a
completed project. At the time I was done with this
layer, my interfaces were a lot thinner (My `IArticleDAO` had
2 or 3 simple methods). So the idea is to outline what
you know and leave room for adding what you will find
out later as you build your app.

As for now, we’re ready to
move one layer up.

##   

Controllers

Controllers are the glue
that holds the whole app together. It’s also the first
entry point into our core application from whatever our
implementation may be (HTTP, CLI, or anything else you
may come up with).

Here, we don’t need to be
too smart with the folder structure. I prefer to
structure those by domain and keep them on the same
level whenever possible. For our fairly simple app —
I’ve imagined it as something like this:

```
controllers/  
 admin.ts  
 article.ts  
 auth.ts  
 index.ts  
 user.ts
```

So the `auth` controller
would be responsible for the registration/login process,
`user` is for
displaying profiles, `article`
is for the articles’ CRUD, and the `admin` controller
would allow us to manage users as an app’s admin. Now
for our controllers’ code:

```
// src/controllers/auth.ts  
  
import { IRequest, IUseCase } from '../interfaces'  
import { Article, User } from '../entities'  
import { ILoginResponse } from '../interfaces/user'  
  
export default class AuthController {  
 constructor(  
 protected registerUser: IUseCase<User>,  
 protected loginUser: IUseCase<ILoginResponse>,  
 protected authorizeUser: IUseCase<User>,  
 protected userArticles: IUseCase<  
 Pick<Article, 'id' | 'title' | 'description' | 'isPublished'>[]  
 >,  
 protected updateProfile: IUseCase<boolean>,  
 ) {}  
  
 async register(request: IRequest): Promise<{ success: boolean }> {  
 const userPayload = request.body  
 const user = await this.registerUser.call(userPayload)  
 return { success: !!user.id }  
 }  
  
 async login(request: IRequest): Promise<ILoginResponse> {  
 const { email, password } = request.body as { email: string; password: string }  
 return this.loginUser.call(email, password)  
 }  
  
 async profile(request: IRequest): Promise<User> {  
 const user = await this.authorizeUser.call(request.token, false)  
 const page = parseInt(request.params?.page as string) || 1  
 const perPage = parseInt(request.params?.perPage as string) || 10  
 const articles = await this.userArticles.call(user.id, false, page, perPage)  
 Object.assign(user, { articles })  
 return user  
 }  
  
 async update(request: IRequest): Promise<boolean> {  
 const user = await this.authorizeUser.call(request.token)  
 return this.updateProfile.call(user.id, request.body)  
 }  
}
```

```
// src/controllers/user.ts  
  
import { IRequest, IUseCase } from '../interfaces'  
import { User } from '../entities'  
  
export default class UserController {  
 constructor(protected userProfile: IUseCase<User>) {}  
  
 async profile(request: IRequest): Promise<User> {  
 const { id } = request?.params as { id: number }  
 const page = request.params?.page || 1  
 const perPage = request.params?.perPage || 10  
 const user = await this.userProfile.call(id, page, perPage)  
 return user  
 }  
}
```

```
// src/controllers/article.ts  
  
import { IPaginated, IRequest, IUseCase } from '../interfaces'  
import { Article, User } from '../entities'  
  
export default class ArticleController {  
 constructor(  
 protected authorizeUser: IUseCase<User>,  
 protected fetchAuthorizedUser: IUseCase<User | null>,  
 protected articleFeed: IUseCase<  
 IPaginated<Pick<Article, 'id' | 'title' | 'description' | 'author'>>  
 >,  
 protected viewArticle: IUseCase<Article>,  
 protected createArticle: IUseCase<Article>,  
 protected updateArticle: IUseCase<Article>,  
 protected deleteArticle: IUseCase<boolean>,  
 ) {}  
  
 async feed(  
 request: IRequest,  
 ): Promise<IPaginated<Pick<Article, 'id' | 'title' | 'description' | 'author'>>> {  
 const page = parseInt(`${request.params?.page}`) || 1  
 const perPage = parseInt(`${request.params?.perPage}`) || 10  
 return this.articleFeed.call(page, perPage)  
 }  
  
 async view(request: IRequest): Promise<Article> {  
 const { id } = request.params as { id: string | number }  
 const user = await this.fetchAuthorizedUser.call(request?.token)  
 return this.viewArticle.call(id, user?.id)  
 }  
  
 async create(request: IRequest): Promise<Article> {  
 const user = await this.authorizeUser.call(request.token)  
 return this.createArticle.call(user, request.body)  
 }  
  
 async update(request: IRequest): Promise<Article> {  
 const user = await this.authorizeUser.call(request.token)  
 const articleID = parseInt(request.params?.id as string)  
 return this.updateArticle.call(articleID, user, request.body)  
 }  
  
 async delete(request: IRequest): Promise<boolean> {  
 const user = await this.authorizeUser.call(request.token)  
 const articleID = parseInt(request.params?.id as string)  
 return this.deleteArticle.call(articleID, user)  
 }  
}
```

```
// src/controllers/admin.ts  
  
import { User } from '../entities'  
import { IPaginated, IRequest, IUseCase } from '../interfaces'  
  
export default class AdminController {  
 constructor(  
 protected authorizeAdmin: IUseCase<User>,  
 protected listUsers: IUseCase<IPaginated<User>>,  
 protected updateUser: IUseCase<boolean>,  
 protected deleteUser: IUseCase<boolean>,  
 ) {}  
  
 async users(request: IRequest): Promise<IPaginated<User>> {  
 await this.authorizeAdmin.call(request.token)  
 const { page, perPage } = request.params as { page: number; perPage: number }  
 return this.listUsers.call(page, perPage)  
 }  
  
 async usersUpdate(request: IRequest): Promise<boolean> {  
 await this.authorizeAdmin.call(request.token)  
 const { id } = request.params as { id: number }  
 return this.updateUser.call(id, request.body)  
 }  
  
 async usersDelete(request: IRequest): Promise<boolean> {  
 await this.authorizeAdmin.call(request.token)  
 const { id } = request.params as { id: number }  
 return this.deleteUser.call(id)  
 }  
}
```

In a real-world app, the
admin area has a bit more features, so I’d probably
create a `users`
controller under an `admin` folder,
but for this particular example - we only have user
management under `admin` area, so
there’s no need to complicate things. Admin can also
edit/delete articles, but we’ll handle this differently
in our app (We have the same action for editing, and
checking that the current user is either an author of an
article or an admin).

It’s also worth mentioning
the `IRequest`
interface that we’ve described before. `IRequest` is a
way to unify the data format, our app would accept. To
perform 99% of our business tasks we'll need 3 main
components. `token`
(authorize users), `params`
(request-specific things, like resource IDs, filters,
etc.), and `body`
(used for write operations and would contain data we
need to store). So, whatever our entry point would be
(an API, Desktop Application, etc.) — We're using `IRequest` to
abstract our application from the platform we're running
it on. That's how Express API, for example, becomes just
an IO component.

As you see, the primary
cause for controllers is getting the data input in the
same format and utilizing use cases to perform business
tasks.

With this done — we have
outlined an entire core application without writing a
single line of implementation code.

But we will do it now:

##   

Implementation (Infrastructure)

We have finally gotten to
all the details. In this step, we can decide what
database and framework/router we’ll use. The beauty of
clean architecture is that you can design an entire
application before you get to this part. The whole
implementation layer is basically just a set of
adapters, that you plug into your app (or you’ll attach
your app to it 😉).

I prefer splitting
infrastructure by responsibility, and (when it makes
sense) by package. To figure out what it means — Let’s
take a look at what we have so far and figure out what
adapters we need to implement:

* As we are building an
  API, we’ll need to accept and route HTTP requests;
* We’ll need to store
  User and Article data somewhere;
* We also need to
  implement a bunch of encryption features for auth to
  work;
* We also need to
  validate data for our write operations

We can use this to split our
implementations by purpose:

```
/infrastructure  
 /api  
 /express  
 /routes  
 admin.ts  
 auth.ts  
 article.ts  
 index.ts  
 user.ts  
 index.ts  
 /data-access  
 /mysql  
 index.ts  
 client.ts  
 userDAO.ts  
 articleDAO.ts  
 /validation  
 /joi  
 /article  
 createUpdate.ts  
 index.ts  
 /user  
 adminUpdate.ts  
 create.ts  
 index.ts  
 register.ts  
 update.ts  
 index.ts  
 validator.ts  
 /utils  
 /auth  
 index.ts  
 comparePasswords.ts  
 encryptPassword.ts  
 issueToken.ts  
 verifyToken.ts  
 getToken.ts
```

You probably noticed that
the infrastructure is quite heavy and much less
structured compared to previous layers. I can also add
that here, at this layer, I’ve faced most of the
challenges in my time (In terms of where to put and how
to implement stuff). So I’d like to explain the general
concept before we cover each part of it.

## Get Vitalii

Zdanovskyi’s stories in your inbox

Join Medium
for free to get updates
from this writer.

Subscribe

Subscribe

Remember me
for faster sign in

By its nature, the
infrastructure layer contains implementations for most
of the app’s interfaces. However, this concept may get a
bit complicated when applied to a real-world app. For
instance, an API isn’t an implementation of anything in
the app but more of an entry point that lets the outside
world to interact with it. An alternative would be to
split this folder into two: `infrastructure`
(implementations of apps interfaces) and `ports/entrypoints`
(APIs, HTMLs, CLIs, and other possible forms of our
app). It’s a reasonable approach, you could use. As for
me — I decided not to have two folders representing the
same layer, so my API lives in the infrastructure
folder, along with all the other details.

Another noteworthy thing is
since the `infrastructure`
layer holds implementations for the vast majority of our
app’s interfaces — there won’t be a fixed or predictable
folder structure. Implementation of database adapters
(DAOs) won’t be structured in the same manner as the API
routers. Also, each part may hold config/implementation
specific to itself (DB connection, etc.). So you may
need to treat each folder as a separate mini-app.

It’s also the only layer
where we can use packages/frameworks, so let’s get this
covered before we go any further:

We’ll be using `express` for the API
part and `MySQL` for
data storage. I'll also add `bcrypt` for
password encryption and validation, and `jsonwebtoken` for
issuing/validating auth tokens. Then, we’ll need to
cover the validation part. I’ll use the `joi` package for
that.

We’ll also use `morgan` package for
`express` request
logging and `method-override`
for error handling. Now, let’s install these packages:

```
npm i --save mysql2 express morgan method-override bcrypt jsonwebtoken joi
```

And, since we are using
typescript — don’t forget to add type definitions for
these packages as well:

```
npm i --save-dev @types/express @types/morgan @types/method-override @types/bcrypt @types/jsonwebtoken
```

## Data-access

(Persistence)

Now let’s look into the
implementation code, starting with MySQL:

```
// src/infrastructure/data-access/mysql/client.ts  
  
import mysql from 'mysql2/promise'  
import { app } from '../../../config'  
  
const client = mysql.createPool({  
 host: app.database.host,  
 port: app.database.port,  
 user: app.database.user,  
 password: app.database.password,  
 database: app.database.dbName,  
 waitForConnections: true,  
 connectionLimit: 5,  
 queueLimit: 0,  
})  
  
export default client
```

You can use ENV variables
here if you want. I prefer to have a generic application
config file as a single source of truth. That way, our
app won’t have a bunch of `process.env`
calls in different places. This makes all the
creds-related tweaks a lot easier. A config file looks
like this:

```
// src/config/app.ts  
  
export default {  
 env: process.env.NODE\_ENV,  
 port: process.env.PORT,  
 jwtSecret: process.env.APP\_JWT\_SECRET,  
 database: {  
 host: process.env.DB\_HOST as string,  
 port: Number(process.env.DB\_PORT),  
 user: process.env.DB\_USER as string,  
 password: process.env.DB\_PASS as string,  
 dbName: process.env.DB\_NAME as string,  
 }  
}
```

We’ll get back to the `config` part later
down the road. As for now - we can proceed to our DAO
implementations:

```
// src/infrastructure/data-access/mysql/userDAO.ts  
  
import { ResultSetHeader, RowDataPacket } from 'mysql2'  
import { AuthUser, User } from '../../../entities'  
import { IUserDAO } from '../../../interfaces/user'  
import client from './client'  
import { IPaginated } from '../../../interfaces'  
import { ValidationError } from '../../../errors'  
  
export default class MySQLUserDAO implements IUserDAO {  
 async listUsers(  
 filters: Partial<User>,  
 page: number,  
 perPage: number,  
 ): Promise<IPaginated<User>> {  
 let query = 'SELECT `id`, `firstName`, `lastName`, `email`, `role` FROM `users`'  
 const sqlFilters = Object.keys(filters).map((key) => `${key} = ?`)  
 if (sqlFilters.length > 0) {  
 query = `${query} WHERE ${sqlFilters.join(' AND ')}`  
 }  
 const [rows]: [RowDataPacket[], unknown] = await client.query(  
 `${query} LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,  
 Object.values(filters),  
 )  
 return {  
 data: rows.map((r) => new User(r as User)),  
 pagination: { page, perPage },  
 }  
 }  
  
 async findOneBy(filters: Partial<User>): Promise<User | null> {  
 let query = 'SELECT `id`, `firstName`, `lastName`, `email`, `role` FROM `users`'  
 const sqlFilters = Object.keys(filters).map((key) => `${key} = ?`)  
 if (sqlFilters.length > 0) {  
 query = `${query} WHERE ${sqlFilters.join(' AND ')} LIMIT 1`  
 }  
 const [rows]: [RowDataPacket[], unknown] = await client.query(query, Object.values(filters))  
 if (rows.length < 1) {  
 return null  
 }  
 return new User(rows[0] as unknown as User)  
 }  
  
 async findForAuth(email: string): Promise<AuthUser | null> {  
 const [rows]: [RowDataPacket[], unknown] = await client.query(  
 `SELECT * FROM \\`users\\` WHERE \\`email\\` = ? LIMIT 1`,  
 email,  
 )  
 if (rows.length < 1) {  
 return null  
 }  
 return new AuthUser(rows[0] as unknown as AuthUser)  
 }  
  
 async create(payload: Partial<User>): Promise<User> {  
 try {  
 const fields = Object.keys(payload).join('`, `')  
 const values = Object.values(payload)  
 const query = `INSERT INTO \\`users\\` (\\`${fields}\\`) VALUES (${values.map(() => '?').join(', ')})`  
 const [result] = await client.query(query, values)  
 const [[data]]: [RowDataPacket[], unknown] = await client.query(  
 `SELECT * FROM \\`users\\` WHERE \\`id\\` = ? LIMIT 1`,  
 (result as { insertId: number }).insertId,  
 )  
 if (!data.id) {  
 throw new Error('Unable to create user')  
 }  
 const user = new User(data as unknown as User)  
 return user  
 } catch (error) {  
 const message = (error as Error).message  
 if (message.includes('Duplicate entry') && message.includes('email')) {  
 throw new ValidationError('The data is invalid', [  
 { field: 'email', message: 'This email is already taken' },  
 ])  
 }  
 throw error  
 }  
 }  
  
 async update(id: number, payload: Partial<User>): Promise<boolean> {  
 const updateFields = Object.keys(payload)  
 if (updateFields.length === 0) {  
 return false  
 }  
 const updateValues = Object.values(payload)  
 const updateString = updateFields.map((field) => `\\`${field}\\` = ?`).join(', ')  
 const [{ affectedRows }]: [ResultSetHeader, unknown] = await client.query(  
 `UPDATE \\`users\\` SET ${updateString} WHERE \\`id\\` = ?`,  
 [...updateValues, id],  
 )  
 return affectedRows > 0  
 }  
  
 async delete(id: number): Promise<boolean> {  
 const [result]: [ResultSetHeader, unknown] = await client.query(  
 `DELETE FROM \\`users\\` WHERE \\`id\\` = ?`,  
 id,  
 )  
 return result.affectedRows > 0  
 }  
}
```

```
// src/infrastructure/data-access/mysql/articleDAO.ts  
  
import { Article } from '../../../entities'  
import { IPaginated } from '../../../interfaces'  
import { IArticleDAO } from '../../../interfaces/article'  
import client from './client'  
  
export default class MySQLArticleDAO implements IArticleDAO {  
 async listAsFeed(page: number, perPage: number): Promise<IPaginated<Article>> {  
 let query = 'SELECT * FROM `articles` LIMIT ? OFFSET ?'  
 const rows = await client.query(query, [perPage, (page - 1) * perPage])  
 return {  
 data: rows.map(r => new Article(r as unknown as Article)),  
 pagination: { page, perPage },  
 }  
 }  
  
 async create(payload: Pick<Article, 'title' | 'description' | 'content' | 'authorID' | 'isPublished'>): Promise<Article> {  
 const fields = Object.keys(payload).join('`, `')  
 const values = Object.values(payload)  
 const query = `INSERT INTO \\`articles\\` (\\`${fields}\\`) VALUES (${values.map(() => '?').join(', ')})`  
 const [id] = await client.query(query, values)  
 const [article] = await client.query(`SELECT * FROM \\`articles\\` WHERE \\`id\\` = ? LIMIT 1`, id)  
 if (!article) {  
 throw new Error('Unable to create article')  
 }  
 return new Article(article as unknown as Article)  
 }  
}
```

As you can see, I preferred
using raw SQL here instead of ORMs or Query Builders. If
you don’t like this — you can absolutely add something
like `knex` or even
full-featured ORMs, like `sequelize`
or `prisma`. But
keep in mind, that you can not turn our app’s entities
into ORM models, so you’ll have to define them somewhere
in the `infrastructure`
layer, and manually keep track of those so they are in
line with our core application. When working on a big
product — this may become quite a problem, as you have
to support two big applications at the same time.

## But what about

migrations?

Right, since we’re using a
relational database, it’s common practice to manage its
structure efficiently. This “Where do I put migrations”
issue was quite a pain when I first tried to create a
clean architecture app. But as usual, it’s pretty
obvious once you give it some thought. We obviously
can’t put it anywhere else in our app, as migrations are
MySQL-specific features (in our case). So there’s no
reason it should be anywhere else but under `data-access/mysql`
folder. It may look a bit messy if you’ve been building
something like [MVC](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller) apps for a
while, yet if you think about it from a different angle,
it’s not that bad. We have MySQL as an app’s data access
adapter, and everything required for that adapter sits
in one place, at the implementation layer, which is in
line with clean architecture principles.

For migrations, I used `db-migrate` package,
so let’s briefly cover that part:

```
npm install db-migrate db-migrate-mysql
```

Now we add a `database.json` file
for this lib, under `mysql` folder.
This is required for `db-migrate`
to be able to talk to the database:

```
// src/infrastructure/data-access/mysql/database.json  
  
{  
 "dev": {  
 "host": {  
 "ENV": "DB\_HOST"  
 },  
 "port": {  
 "ENV": "DB\_PORT"  
 },  
 "user": {  
 "ENV": "DB\_USER"  
 },  
 "password": {  
 "ENV": "DB\_PASS"  
 },  
 "database": {  
 "ENV": "DB\_NAME"  
 },  
 "driver": "mysql",  
 "multipleStatements": true  
 }  
}
```

I also added a few scripts
to our `package.json` to
make migrations a bit easier:

```
{  
 "name": "clean-architecture-node-ts",  
 "version": "1.0.0",  
 "description": "",  
 "scripts": {  
 ...  
 "migrate:new": "db-migrate create $1 --sql-file -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:up": "db-migrate up -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:down": "db-migrate down -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 ...  
 },  
}
```

I’m not going to do an
in-depth description or write SQL migrations here. The
point is that we can now manage migrations, and they are
located in `src/infrastructure/data-access/mysql/migrations`
folder. You can look at migrations for this
project [here](https://github.com/vitalii-z8i/nodejs-ts-clean-architecture-api/tree/main/src/infrastructure/data-access/mysql/migrations)

## Data Validation

As I mentioned before —
we’re using `joi`
package for validation. For this part — I came up with
the idea of having a generic validator class that takes
`JOI.Schema` as an
attribute and has a `validate`
method. Let’s look at the code:

```
// src/inftrastructure/validation/joi/validator.ts  
  
import Joi from 'joi'  
import { IValidator } from '../../../interfaces'  
import { IValidationResult } from '../../../interfaces/validator'  
  
export default class JOIValidator<T> implements IValidator<T> {  
 constructor(protected schema: Joi.Schema<T>) {}  
  
 public validate(data: T): IValidationResult<T> {  
 const result = this.schema.validate(data)  
 const errors = result.error  
 ? result.error.details.map((ed) => ({ field: ed.path.join('.'), message: ed.message }))  
 : []  
  
 return { data: result.value, errors }  
 }  
}
```

Now, our validators would
look like this:

```
// src/infrastructure/validation/joi/user/adminUpdate.ts  
  
import Joi from 'joi'  
import JOIValidator from '../validator'  
  
const adminValidator = Joi.object({  
 firstName: Joi.string().required(),  
 lastName: Joi.string().required(),  
 email: Joi.string().email().required(),  
 role: Joi.string().allow('user', 'admin').only().required(),  
 password: Joi.string().min(6).optional(),  
 confirmPassword: Joi.when(Joi.ref('password'), {  
 is: Joi.required(),  
 then: Joi.any()  
 .valid(Joi.ref('password'))  
 .required()  
 .options({  
 messages: {  
 'any.required': 'password confirmation is required',  
 'any.only': 'must match password',  
 },  
 }),  
 otherwise: Joi.forbidden(),  
 }),  
})  
  
export default new JOIValidator(adminValidator)
```

```
// src/infrastructure/validation/joi/user/create.ts  
  
import Joi from 'joi'  
import JOIValidator from '../validator'  
  
const createValidator = Joi.object({  
 firstName: Joi.string().required(),  
 lastName: Joi.string().required(),  
 email: Joi.string().email().required(),  
 password: Joi.string().min(6).required(),  
 role: Joi.string().valid('admin', 'user').required(),  
})  
  
export default new JOIValidator(createValidator)
```

```
// src/infrastructure/validation/joi/user/register.ts  
  
import Joi from 'joi'  
import JOIValidator from '../validator'  
  
const registerValidator = Joi.object({  
 firstName: Joi.string().required(),  
 lastName: Joi.string().required(),  
 email: Joi.string().email().required(),  
 password: Joi.string().min(6).required(),  
 confirmPassword: Joi.any()  
 .valid(Joi.ref('password'))  
 .required()  
 .options({  
 messages: {  
 'any.required': 'password confirmation is required',  
 'any.only': 'must match password',  
 },  
 }),  
})  
  
export default new JOIValidator(registerValidator)
```

```
// src/infrastructure/validation/joi/user/update.ts  
  
import Joi from 'joi'  
import JOIValidator from '../validator'  
  
const updateValidator = Joi.object({  
 firstName: Joi.string().required(),  
 lastName: Joi.string().required(),  
 email: Joi.string().email().required(),  
 password: Joi.string().min(6).optional(),  
 confirmPassword: Joi.when(Joi.ref('password'), {  
 is: Joi.required(),  
 then: Joi.any()  
 .valid(Joi.ref('password'))  
 .required()  
 .options({  
 messages: {  
 'any.required': 'password confirmation is required',  
 'any.only': 'must match password',  
 },  
 }),  
 otherwise: Joi.forbidden(),  
 }),  
})  
  
export default new JOIValidator(updateValidator)
```

```
// src/infrastructure/validation/joi/article/createUpdate.ts  
  
import Joi from 'joi'  
import JOIValidator from '../validator'  
  
const articleValidator = Joi.object({  
 title: Joi.string().required(),  
 description: Joi.string().optional(),  
 content: Joi.string().required(),  
 isPublished: Joi.boolean().allow(0, 1).optional(),  
})  
  
export default new JOIValidator(articleValidator)
```

`user` and `article` folders also
contain an `index.ts` file
that would export all the validators in a folder, and
the main `index.ts`
in a `vailidation/joi`
looks like this:

```
// src/infrastructure/validation/joi/index.ts  
  
import * as user from './user'  
import * as article from './article'  
  
export { user, article }
```

## Utils/Auth functions

This is simply a bunch of
utility/helper functions grouped in a single place.
There is no need to talk about it too much. So, I’ll
just show you the code 🙂

```
// src/infrastructure/utils/auth/encryptPassword.ts  
  
import bcrypt from 'bcrypt'  
  
export default async (rawPassword: string): Promise<{ password: string; salt: string }> => {  
 const salt = await bcrypt.genSalt(10)  
 const password = await bcrypt.hash(rawPassword, salt)  
  
 return { password, salt }  
}
```

```
// src/infrastructure/utils/auth/issueToken.ts  
  
import jwt from 'jsonwebtoken'  
import { app } from '../../../config'  
import { User } from '../../../entities'  
  
export default (payload: Partial<User>, expiresIn?: string): string => {  
 const jwtToken = jwt.sign(  
 payload,  
 app.jwtSecret as string,  
 expiresIn ? { expiresIn: '2d' } : undefined,  
 )  
  
 return jwtToken  
}
```

```
// src/infrastructure/utils/auth/passwordsMatch.ts  
  
import bcrypt from 'bcrypt'  
  
export default async (password: string, encryptedPassword: string): Promise<boolean> => {  
 return bcrypt.compare(password, encryptedPassword)  
}
```

```
// src/infrastructure/utils/auth/verifyToken.ts  
  
import jwt from 'jsonwebtoken'  
import { app } from '../../../config'  
import { User } from '../../../entities'  
import { UnauthorizedError } from '../../../errors'  
  
export default <T = User>(token: string): T => {  
 try {  
 return jwt.verify(token, app.jwtSecret as string) as unknown as T  
 } catch (err) {  
 console.error(err)  
 throw new UnauthorizedError('Your token is invalid or expired')  
 }  
}
```

Now we’re finally ready to
start creating an API. But before we do — there’s one
more little thing I’d like to add:

## Services config

We’re going to add another
config file to our app. It’s pretty simple, but could
help manage and support your app in the future:

```
// src/config/services.ts  
  
import { MySQLArticleDAO, MySQLUserDAO } from '../infrastructure/data-access/mysql'  
import { encryptPassword, issueToken, passwordsMatch, verifyToken } from '../infrastructure/utils/auth'  
import * as validators from '../infrastructure/validation/joi'  
  
export default {  
 user: {  
 validators: validators.user,  
 DAO: MySQLUserDAO,  
 },  
 article: {  
 validators: validators.article,  
 DAO: MySQLArticleDAO,  
 },  
 utils: {  
 encryptPassword,  
 issueToken,  
 verifyToken,  
 passwordsMatch,  
 },  
}
```

If you’re wondering what is
it for — having this file can make your life easier,
should you ever be tasked to swap out some of the app’s
components. Everything that listed here, will be
used/initialized inside API files. Without this file —
we’d referenced our `Article
 DAO` like this.

```
const articleDAO = new MySQLArticleDAO()
```

But if you use `src/config/services.ts`

- your implementations would be referenced like this:

```
const articleDAO = new config.services.article.DAO()
```

That way, should you ever
swap `MySQLArticleDAO`
to something else — you’ll only have to change the
implementation name in a single place. I guess that it
doesn’t seem like too big of an issue in my example, but
imagine a really big product with 100+ files inside
`infrastructure`
layer alone. This can be quite a pain to manage if you
don’t use this file.

Yet, whether to use this
approach or not, is entirely up to you. If you’re
confident you’re not going to need it for your project —
There’s nothing wrong with referencing implementations
directly.

In any case, we can now
finally move to building the API:

## API

This part is just a simple
Express API, that we all know and love. All we do here
is initialize controllers, inject respective use cases,
with DAOs, validators, and other functions, and call an
appropriate controller method for a given URL.

One thing I can mention here
is that I’m barely using any express middleware
abilities. It’s quite a common practice to utilize
express middleware for things like user authorization,
and validating data. Yet if we’re building a clean
architecture application — we shouldn’t do that. This
would be a bad practice because our app would now depend
on Express API and wouldn’t behave the same if we
changed Express to something else. Also, these parts are
either use cases or tasks that should be performed
inside use cases. Let’s look at `createArticle`
use case for example: To create an article - we should
come up with a title, and have the actual article
written itself. We should also be a registered author.
If we are to translate this to software language, we get
this: `title`, `content`, and
`author` are
required to create an article. Now, creating an article
is a business task, and what we’ve stated above - are
business rules. Business rules should be relevant and
are required regardless if we’re creating an article via
Express API, console, or an HTML form. Therefore, these
rules should live and be executed inside a use case. I
hope that makes sense.

Now, let’s see the code.

Our very first entry point
in an API would look like this:

```
// src/infrastructure/api/express/index.ts  
  
import express from 'express'  
import logger from 'morgan'  
import cors from 'cors'  
import methodOverride from 'method-override'  
import routes from './routes'  
import { IError } from '../../../interfaces'  
  
const app: express.Application = express()  
  
app.use(logger('dev'))  
app.use(express.json())  
app.use(  
 cors({  
 origin: '*', // Please don't do this in real-world apps  
 methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',  
 credentials: true,  
 }),  
)  
app.use(express.urlencoded({ extended: false }))  
  
app.get('/', async (\_req: express.Request, res: express.Response) => {  
 res.send({ name: 'Articles API' })  
})  
  
routes.attach(app)  
  
app.use('*', (req: express.Request, res: express.Response) => {  
 res.status(404).send({  
 error: 'NotFound',  
 message: `Cannot ${req.method} ${req.baseUrl}`,  
 })  
})  
  
app.use(methodOverride())  
app.use((err: IError, \_req: express.Request, res: express.Response) => {  
 console.error(err)  
 res.status(err.httpStatus || 500).send({  
 error: err.name,  
 message: err.message,  
 details: err?.details,  
 })  
})  
  
export default app
```

In case you’re wondering
what is the `routes.attach(app)`
line do - It’s described in `index.ts` file
under `routes`
folder:

```
// src/infrastructure/api/express/routes/index.ts  
  
import { Application } from 'express'  
import auth from './auth'  
import articles from './articles'  
import users from './users'  
import admin from './admin'  
  
export default {  
 attach(app: Application): void {  
 app.use('/auth', auth)  
 app.use('/articles', articles)  
 app.use('/users', users)  
 app.use('/admin', admin)  
 },  
}
```

The rest of it are simply
routes descriptions, so there’s not much to talk about
here:

```
// src/infrastructure/api/express/routes/admin.ts  
  
import express, { NextFunction, Request, Response } from 'express'  
import { services } from '../../../../config'  
import AdminController from '../../../../controllers/admin'  
import { AuthorizeAdmin, DeleteUser, ListUsers, UpdateUser } from '../../../../use-cases/user'  
  
const userDAO = new services.user.DAO()  
  
const controller = new AdminController(  
 new AuthorizeAdmin(userDAO, services.utils.verifyToken),  
 new ListUsers(userDAO),  
 new UpdateUser(services.user.validators.adminUpdate, userDAO, services.utils.encryptPassword),  
 new DeleteUser(userDAO),  
)  
  
const router = express.Router()  
  
router.use((req: Request, \_res: Response, next: NextFunction) => {  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 Object.assign(req, { token })  
 next()  
})  
  
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const token = (req as unknown as { token: string }).token  
 const { page, perPage } = req.query as unknown as { page: number; perPage: number }  
 const result = await controller.users({ token, params: { page, perPage } })  
 res.send(result)  
 } catch (err) {  
 next(err)  
 }  
})  
  
router.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const token = (req as unknown as { token: string }).token  
 const id = parseInt(req.params.id)  
 const body = req.body  
 const success = await controller.usersUpdate({ token, body, params: { id } })  
 res.send({ success })  
 } catch (err) {  
 next(err)  
 }  
})  
  
router.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const token = (req as unknown as { token: string }).token  
 const id = parseInt(req.params.id)  
 const success = await controller.usersDelete({ token, params: { id } })  
 res.send({ success })  
 } catch (err) {  
 next(err)  
 }  
})  
  
export default router
```

```
// src/infrastructure/api/express/routes/articles.ts  
  
import express, { NextFunction, Request, Response, Router } from 'express'  
import { services } from '../../../../config'  
import { ArticleController } from '../../../../controllers'  
import { AuthorizeUser, FetchAuthorisedUser } from '../../../../use-cases/user'  
import {  
 ArticleFeed,  
 CreateArticle,  
 DeleteArticle,  
 UpdateArticle,  
 ViewArticle,  
} from '../../../../use-cases/article'  
  
const articleDAO = new services.article.DAO()  
const userDAO = new services.user.DAO()  
  
const controller = new ArticleController(  
 new AuthorizeUser(userDAO, services.utils.verifyToken),  
 new FetchAuthorisedUser(userDAO, services.utils.verifyToken),  
 new ArticleFeed(articleDAO),  
 new ViewArticle(articleDAO),  
 new CreateArticle(services.article.validators.createUpdate, articleDAO),  
 new UpdateArticle(articleDAO),  
 new DeleteArticle(articleDAO),  
)  
  
const router: Router = express.Router()  
  
router.get('/', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { page, perPage } = req.query as unknown as { page: number; perPage: number }  
 const result = await controller.feed({ params: { page, perPage } })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { id } = req.params as unknown as { id: string }  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const result = await controller.view({ token, params: { id } })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.post('/', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const { title, description, content, isPublished } = req.body  
 const result = await controller.create({  
 token,  
 body: { title, description, content, isPublished },  
 })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { id } = req.params as unknown as { id: string }  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const { title, description, content, isPublished } = req.body  
 const result = await controller.update({  
 token,  
 params: { id },  
 body: { title, description, content, isPublished },  
 })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { id } = req.params as unknown as { id: string }  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const success = await controller.delete({ token, params: { id } })  
 res.send({ success })  
 } catch (err) {  
 return next(err)  
 }  
})  
  
export default router
```

```
// src/infrastructure/api/express/routes/auth.ts  
  
import express, { NextFunction, Request, Response, Router } from 'express'  
import { services } from '../../../../config'  
import { AuthController } from '../../../../controllers'  
import { AuthorizeUser, LoginUser, RegisterUser, UpdateUser } from '../../../../use-cases/user'  
import { UserArticlesList } from '../../../../use-cases/article'  
  
const userDAO = new services.user.DAO()  
const articleDAO = new services.article.DAO()  
  
const controller = new AuthController(  
 new RegisterUser(services.user.validators.register, userDAO, services.utils.encryptPassword),  
 new LoginUser(userDAO, services.utils.passwordsMatch, services.utils.issueToken),  
 new AuthorizeUser(userDAO, services.utils.verifyToken),  
 new UserArticlesList(articleDAO),  
 new UpdateUser(services.user.validators.update, userDAO, services.utils.encryptPassword),  
)  
  
const router: Router = express.Router()  
  
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { email, firstName, lastName, password, confirmPassword } = req.body  
 const result = await controller.register({  
 body: { email, firstName, lastName, password, confirmPassword },  
 })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { email, password } = req.body  
 const result = await controller.login({ body: { email, password } })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const { page, perPage } = req.query as unknown as { page: number; perPage: number }  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const result = await controller.profile({ token, params: { page, perPage } })  
 res.send(result)  
 } catch (err) {  
 return next(err)  
 }  
})  
  
router.put('/profile', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const token = [...(req.headers['authorization']?.split(' ') || [])].pop() || ''  
 const { email, password, firstName, lastName, confirmPassword } = req.body  
 const success = await controller.update({  
 token,  
 body: { email, password, firstName, lastName, confirmPassword },  
 })  
 res.send({ success })  
 } catch (err) {  
 return next(err)  
 }  
})  
  
export default router
```

```
// src/infrastructure/api/express/routes/users.ts  
  
import express, { NextFunction, Request, Response } from 'express'  
import { services } from '../../../../config'  
import { UserController } from '../../../../controllers'  
import { UserProfile } from '../../../../use-cases/user'  
  
const router = express.Router()  
  
const controller = new UserController(  
 new UserProfile(new services.user.DAO(), new services.article.DAO()),  
)  
  
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {  
 try {  
 const id = parseInt(req.params?.id)  
 const { page, perPage } = req.query as unknown as { page: number; perPage: number }  
 const result = await controller.profile({ params: { id, page, perPage } })  
 res.send(result)  
 } catch (err) {  
 next(err)  
 }  
})  
  
export default router
```

## Final steps

We’re almost done… Now we’ll
add an entry-point file to `bin` folder. That
will be the script we’ll execute from a terminal:

```
// bin/app  
  
require('dotenv').config()  
  
const APP\_DIR = process.env.NODE\_ENV === 'production' ? 'dist' : 'src'  
const { api } = require(`../${APP\_DIR}`)  
const config = require(`../${APP\_DIR}/config`)  
const port = config.app.port || 3000  
  
api.listen(port, () => console.log(`API is listening on port ${port}`))
```

You’ve probably mentioned
that we have an import for the app’s main folder (`src` or `dist`). The index
file in there looks like this:

```
// src/index.ts  
  
import api from './infrastructure/api/express'  
  
export { api }
```

If we would have any other
ports apart from an API — we should also place them
here.

As I mentioned, we’ll run
our dev server on `nodemon` so we
won't have to restart it every time we change something.
So in addition, create a `nodemon.json`
file:

```
{  
 "watch": [  
 "src",  
 ".env"  
 ],  
 "ext": "js,ts,json",  
 "exec": "ts-node"  
}
```

For the production app, we
would build the whole app into JS and run the same
script but from the `dist` folder.

We should also set up a
`.env` file, with
all the sensitive info:

```
NODE\_ENV=development  
PORT=3000  
APP\_JWT\_SECRET=such-token-so-secret  
DB\_HOST=database-host  
DB\_PORT=3306  
DB\_USER=root  
DB\_PASS=secret-mysql-pass  
DB\_NAME=article-api
```

And our `package.json` would
have the following scripts:

```
{  
 ...  
 "scripts": {  
 "build": "rm -fr dist/* && tsc",  
 "start": "node ./bin/app",  
 "dev": "nodemon ./bin/app",  
 "migrate:new": "db-migrate create $1 --sql-file -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:up": "db-migrate up -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:down": "db-migrate down -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 }  
 ...  
}
```

## It works!

Now, assuming you already
have an empty MySQL database `article-api` and
configured your env file - we can now launch the app:

```
npm run migrate:up  
npm run dev
```

Your app should now be live,
and you should be able to visit <http://localhost:3000/>

## But how do we create an

admin?

That is a problem. Our app
has an entire admin area, but we can’t create a first
admin user. Let’s get it covered. For this part, we’ll
create a new entry point into our app — the [CLI](https://en.wikipedia.org/wiki/Command-line_interface). Now, there are
easier
ways to do this, especially considering that it’s likely
a one-time operation, but my goal here is to demonstrate
all the features an app like this could have.

We already have a `CreateUser` use case
that allows us to add admins too. But it’s used only
inside an `AdminController`
that has admin-restricted access. It’s a desired
behavior, but we need a secure way to create that first
admin user. That’s why I decided to add a CLI part. A
CLI could replicate some or all the features we
currently have for API, but for this purpose - we’ll
need a separate controller. let’s call it a `ScriptsController`

```
// src/controllers/scripts.ts  
  
import { AuthUser, User } from '../entities'  
import { IRequest, IUseCase } from '../interfaces'  
  
export default class ScriptsController {  
 constructor(protected createUser: IUseCase<User>) {}  
  
 async createAdmin(request: IRequest): Promise<User> {  
 const { email, password } = request.body as Pick<AuthUser, 'email' | 'password'>  
  
 return this.createUser.call({  
 email,  
 password,  
 firstName: 'Admin',  
 lastName: 'Adminson',  
 role: 'admin',  
 })  
 }  
}
```

As you can see, we’re
utilizing an existing use case here without any
problems. We could get all the data like first and last
names from user input, but since it’s basically a
utility script — I decided not to bother with it.

Now, let’s create a CLI
entry point itself:

```
// src/infrastructure/cli/index.ts  
  
import readline from 'node:readline'  
import { services } from '../../config'  
import { ScriptsController } from '../../controllers'  
import { IError } from '../../interfaces'  
import { CreateUser } from '../../use-cases/user'  
import { User } from '../../entities'  
  
const consoleReader = readline.createInterface({ input: process.stdin, output: process.stdout })  
function getInput(prompt: string): Promise<string> {  
 return new Promise<string>((resolve) => {  
 consoleReader.question(prompt, (answer: string) => {  
 resolve(answer)  
 })  
 })  
}  
  
const createUser = new CreateUser(  
 services.user.validators.create,  
 new services.user.DAO(),  
 services.utils.encryptPassword,  
)  
  
const controller = new ScriptsController(createUser)  
  
const commands: Record<string, () => Promise<unknown>> = {  
 'create-admin': async () => {  
 try {  
 const body = {  
 email: await getInput('Enter Admin email address: '),  
 password: await getInput('Create Admin password: '),  
 }  
 consoleReader.close()  
 const admin: User = await controller.createAdmin({ body })  
 console.log('Admin Created!')  
 console.log(`You can now login with: ${admin.email}`)  
 } catch (error) {  
 const response = error as IError  
 console.log(`${response.name}: ${response.message}`)  
 if (response.details) {  
 console.log(response.details)  
 }  
 }  
 },  
}  
  
const cli = async () => {  
 const availableCommands = Object.keys(commands).join(', ')  
 const commandName = process.argv[2]  
 if (!commandName && typeof commandName !== 'string') {  
 console.error(`Please choose one of the following commands: ${availableCommands}`)  
 process.exit()  
 }  
 if (!commands[commandName]) {  
 console.error(  
 `Don't know how to handle command: ${commandName}. Supported commands: ${availableCommands}`,  
 )  
 process.exit()  
 }  
 await commands[commandName]()  
 process.exit()  
}  
  
export default cli
```

So, we have a basic
functionality for reading user input from a console.
Apart from that, it’s business as usual: We initialize
and call the appropriate controller method of our core
app. Ideally, I’d split this into multiple files to keep
things clean and organized, but since we’re only doing
one script, I decided to keep it simple.

Now we’ll need to add `cli` to our app’s
global exports, create a `bin/cli`
entry point file, and modify our `package.json`

```
// src/index.ts  
  
import api from './infrastructure/api/express'  
import cli from './infrastructure/cli'  
  
export { api, cli }
```

```
// bin/cli  
  
require('dotenv').config()  
const { cli } = require('../dist')  
cli()
```

```
// package.json  
  
{  
 ...  
 "scripts": {  
 "build": "rm -fr dist/* && tsc",  
 "start": "node ./bin/app",  
 "dev": "nodemon ./bin/app",  
 "cli": "node ./bin/cli",  
 "migrate:new": "db-migrate create $1 --sql-file -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:up": "db-migrate up -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json",  
 "migrate:down": "db-migrate down -m src/infrastructure/data-access/mysql/migrations --config src/infrastructure/data-access/mysql/database.json"  
 },  
 ...  
}
```

You may have noticed that
`bin/cli` addresses
a production version of our app in `dist` directory.
Since these CLI scripts are mostly production-focused
(And I was a bit lazy to set up a dev-version too 😂),
we’ll need to build our app before running this script:

```
npm run build  
npm run cli create-admin
```

You’ll be prompted to enter
your admin email and password, and in the end — we’ll be
able to log in with those credentials:

![create-admin script executed in linux terminal](./A definitive guide to building a NodeJS app, using Clean
Architecture (and TypeScript) _ by Vitalii Zdanovskyi _ Medium_files/1_47yphaCFxyM32ulJLrI5jA.png)

And just like that, our app
now has a small CLI feature 😉

You can even turn your whole
app into CLI if you’d like, or swap databases in a
matter of minutes (Just implement new DAOs and change
the reference in `config/services.ts`).
The possibilities are limitless…

##   

Who’s it for? And when it’s good?

If you’ve read this far —
you’ve probably noticed that building an app like this
is pretty time-consuming. And do keep in mind that it
was a pretty simple app too. Real-world applications are
usually a lot more complex than that. So if you want to
use clean architecture — you’ll have to put some time
and effort into it at the very beginning. The good news
is that it usually pays out in the end 🙂

So when is it a good idea to
use this approach?

I tend to use it whenever
possible on mid-to-big-size projects. But that’s just
me. What I can objectively state is that it’s a very
good approach for situations when you are building a
complex product, and a lot of the features are vague,
unknown, or may be subject to change in the near future.

About 80% of products revise their features or add
new ones, that conflict with current functionality, or
push your code base past its limits. This is a bad
influence on code quality. You collect technical debt,
fight the framework, and may end up with messy and
poorly optimized code. I’ve seen it everywhere,
regardless of your team size or developer expertise. And
in my experience — no other design pattern could handle
complex, deal-breaking changes better than this one. Its
modular structure and business-focused approach handle
most of the complex changes very well. So if you have
some extra time on your hands, and you want to build a
product that lasts — it’s definitely worth doing.

Of course, if your product
will grow in a predictable and structured manner, or if
you have all the details figured out — You can probably
use some fancy framework, generate a bunch of MVC
structures, and have everything ready in half the time
you’d spend on building a clean architecture
application. Not saying that it’s a bad thing, though.

Some products do not rely on constant growth. If
your goal is to solve a fixed set of business problems,
you know your product will do just that without any
further development, and you see a way to build it using
a framework, in a clean and efficient manner — that is
perfectly fine. I once built a Video CMS project, which
required an admin area for uploading videos and
providing a list of uploaded videos to a smart TV app. I
did this project fairly quickly using Ruby on Rails. And
it worked out just fine. However, there are other
products that would have turned into a disaster if I’d
built them like this. So, the bottom line is — there’s a
time and a place for everything.

Overall, I hope this guide
was useful to you. I probably haven’t covered all the
files and parts of the app, so I’ll leave a link to a
GitHub repo for reference. Have fun and build products
that last 😉

<https://github.com/vitalii-z8i/nodejs-ts-clean-architecture-api>



















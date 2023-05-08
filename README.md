## Getting Started

This section will give you the instruction about setting up this project locally.

### Prerequisites

These are the lists of tools that you need to run the project.

- [npm](https://www.npmjs.com/)
- [Nodejs](https://nodejs.org/en/)
- [Docker](https://docker.com)

### Installation of Repo

1. Clone the repo

```sh
git@github.com:Tsaikkari/Senior-Backend.git
```

2. Install dependencies:

```sh
npm install
```

3. For Mac and Linux user, give the permission to execute `script.sh` file. The script will run a postgres container as the app's database

```sh
chmod -x ./script.sh;
```

4. Create a `.env` file in the root directory and include the following varables:

```sh
PORT = 5000
DB_PASSWORD = seniorHappy
JWT_SECRET = ashdjgksdkfj
```

6. Finally, start the app:

```sh
npm start
```

### Environment variables

* NODE_ENV
* PORT
* JWT_SECRET
* LOCALE

PostgreSQL
* DB_PASSWORD
* DATABASE_URL

Sendinblue
* SIB_API_KEY
* EMAIL_LOGIN
* EMAIL_PASSWORD

Stripe
* STRIPE_API_KEY
* STRIPE_WEBHOOK_SECRET

Posti
* POSTI_USERNAME
* POSTI_PASSWORD
* POSTI_CUSTOMER_NUMBER

### Commit Message format

The message of the commit should only follow the following format:
["CI", "CHORE", "DOCS", "FEATURE", "FIX", "PERF", "REFACTOR", "REVERT", "STYLE", "HOTPATCH"]
EG:- FEATURE: Description about Feature
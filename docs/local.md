# Run Docs locally

> ⚠️ Running Docs locally using the methods described below is for testing purposes only.  It is based on building Docs using Minio as the S3 storage solution: if you want to use Minio for production deployment of Docs, you will need to comply with Minio's AGPL-3.0 licence.

**Prerequisite**

Make sure you have a recent version of Docker and [Docker Compose](https://docs.docker.com/compose/install) installed on your laptop:

```shellscript
$ docker -v

Docker version 20.10.2, build 2291f61

$ docker compose version

Docker Compose version v2.32.4
```

> ⚠️ You may need to run the following commands with sudo but this can be avoided by adding your user to the `docker` group.

**Project bootstrap**

The easiest way to start working on the project is to use GNU Make:

```shellscript
$ make bootstrap FLUSH_ARGS='--no-input'
```

This command builds the `app` container, installs dependencies, performs database migrations and compile translations. It's a good idea to use this command each time you are pulling code from the project repository to avoid dependency-related or migration-related issues.

Your Docker services should now be up and running 🎉

You can access to the project by going to <http://localhost:3000>.

You will be prompted to log in, the default credentials are:

```
username: impress
password: impress
```

📝 Note that if you need to run them afterwards, you can use the eponym Make rule:

```shellscript
$ make run
```

**Adding content**
You can create a basic demo site by running:

```shellscript
$ make demo
```

Finally, you can check all available Make rules using:

```shellscript
$ make help
```

**Django admin**

You can access the Django admin site at

<http://localhost:8071/admin>.

You first need to create a superuser account:

```shellscript
$ make superuser
```

## Front-end dev instructions
⚠️ For the frontend developer, it is often better to run the frontend in development mode locally.

To do so, install the frontend dependencies with the following command:

```shellscript
$ make frontend-development-install
```

And run the frontend locally in development mode with the following command:

```shellscript
$ make run-frontend-development
```

To start all the services, except the frontend container, you can use the following command:

```shellscript
$ make run-backend
```

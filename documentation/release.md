# Releasing a new version

Whenever we are cooking a new release (e.g. `4.18.1`) we should follow a standard procedure described below:

1.  Create a new branch named: `release/4.18.1`.
   2.  Bump the release number for backend project, frontend projects, and Helm files:

       - for backend, update the version number by hand in `pyproject.toml`,
       - for each projects (`src/frontend`, `src/frontend/apps/*`, `src/frontend/packages/*`, `src/mail`), run `yarn version --new-version --no-git-tag-version 4.18.1` in their directory. This will update their `package.json` for you,
       - for Helm, update Docker image tag in files located at `src/helm/env.d` for both `preprod` and `production` environments:

         ```yaml
         image:
           repository: lasuite/impress-backend
           pullPolicy: Always
           tag: "v4.18.1" # Replace with your new version number, without forgetting the "v" prefix
      
         ...
      
         frontend:
           image:
             repository: lasuite/impress-frontend
             pullPolicy: Always
             tag: "v4.18.1" 

          y-provider:
            image:
              repository: lasuite/impress-y-provider
              pullPolicy: Always
              tag: "v4.18.1" 
         ```

         The new images don't exist _yet_: they will be created automatically later in the process.

3.  Update the project's `Changelog` following the [keepachangelog](https://keepachangelog.com/en/0.3.0/) recommendations

4.  Commit your changes with the following format: the 🔖 release emoji, the type of release (patch/minor/patch) and the release version:

    ```text
    🔖(minor) bump release to 4.18.0
    ```

5.  Open a pull request, wait for an approval from your peers and merge it.
6.  Checkout and pull changes from the `main` branch to ensure you have the latest updates.
7.  Tag and push your commit:

    ```bash
    git tag v4.18.1 && git push origin tag v4.18.1
    ```

    Doing this triggers the CI and tells it to build the new Docker image versions that you targeted earlier in the Helm files.

8.  Ensure the new [backend](https://hub.docker.com/r/lasuite/impress-frontend/tags) and [frontend](https://hub.docker.com/r/lasuite/impress-frontend/tags) image tags are on Docker Hub.
9.  The release is now done!

# Deploying

> [!TIP]
> The `staging` platform is deployed automatically with every update of the `main` branch.

Making a new release doesn't publish it automatically in production.

Deployment is done by ArgoCD. ArgoCD checks for the `production` tag and automatically deploys the production platform with the targeted commit.

To publish, we mark the commit we want with the `production` tag. ArgoCD is then notified that the tag has changed. It then deploys the Docker image tags specified in the Helm files of the targeted commit.

To publish the release you just made:

```bash
git tag --force production v4.18.1
git push --force origin production
```
# Installation
If you want to install Docs you've come to the right place.
Here are a bunch of resources to help you install the project.

## Kubernetes
We (Docs maintainers) are only using the Kubernetes deployment method in production. We can only provide advanced support for this method.
Please follow the instructions laid out [here](/docs/installation/kubernetes.md).

## Docker Compose
We are aware that not everyone has Kubernetes Cluster laying around 😆. 
We also provide [Docker images](https://hub.docker.com/u/lasuite?page=1&search=impress) that you can deploy using Compose. 
Please follow the instructions [here](/docs/installation/compose.md). 
⚠️ Please keep in mind that we do not use it ourselves in production. Let us know in the issues if you run into troubles, we'll try to help.

## Other ways to install Docs
Community members have contributed several other ways to install Docs. While we owe them a big thanks 🙏, please keep in mind we (Docs maintainers) can't provide support on these installation methods as we don't use them ourselves and there are two many options out there for us to keep track of. Of course you can contact the contributors and the broader community for assistance.

Here is the list of other methods in alphabetical order:
- Coop-Cloud: [code](https://git.coopcloud.tech/coop-cloud/lasuite-docs)
- Nix: [Packages](https://search.nixos.org/packages?channel=unstable&query=lasuite-docs), ⚠️ unstable
- Podman: [code][https://codeberg.org/philo/lasuite-docs-podman], ⚠️ experimental
- YunoHost: [code](https://github.com/YunoHost-Apps/lasuite-docs_ynh), [app store](https://apps.yunohost.org/app/lasuite-docs)

Feel free to make a PR to add ones that are not listed above 🙏

## Cloud providers
Some cloud providers are making it easy to deploy Docs on their infrastructure.

Here is the list in alphabetical order:
- Clever Cloud 🇫🇷 : [market place][https://www.clever-cloud.com/product/docs/], [technical doc](https://www.clever.cloud/developers/guides/docs/#deploy-docs)

Feel free to make a PR to add ones that are not listed above 🙏
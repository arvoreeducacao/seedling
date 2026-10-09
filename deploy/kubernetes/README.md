# Seedling on Kubernetes

`seedling.yaml` is a starting point, not a turnkey install. Every value in it is a placeholder: replace the hosts, the secret values, the ingress class and the storage size before you apply it.

## What it runs

One pod with two containers that share a volume:

- `web` runs the Seedling server from `ghcr.io/arvoreeducacao/seedling-web`. It talks to Docker over `tcp://127.0.0.1:2375`, which only the pod can reach.
- `dind` is a privileged Docker daemon that runs the candidates' sandboxes. Its `postStart` hook adds `DOCKER-USER` rules that drop traffic from sandboxes to private, carrier-grade NAT and link-local ranges, so a sandbox cannot reach the cluster network or a cloud metadata endpoint. Sandboxes keep public internet access.

Both containers mount the same volume at `/data`, so the paths Seedling hands Docker for bind mounts exist inside the daemon too. Docker's own storage lives on a second sub path of the volume, which keeps the sandbox image across restarts.

Seedling keeps live session state in memory and SQLite on the volume. Run exactly one replica with the `Recreate` strategy.

## Steps

1. Pick two hosts: one for the app and one for candidate previews. Put the preview host on a registrable domain of its own (see `SECURITY.md`).
2. Fill the `seedling-env` secret, or better, create it from your secret manager and delete it from the file. Every variable is described in the main README.
3. Point both hosts at your ingress controller and give them a certificate.
4. Apply the manifest:

   ```sh
   kubectl apply -f deploy/kubernetes/seedling.yaml
   kubectl -n seedling rollout status deployment/seedling
   ```

5. Load the sandbox image into the pod's Docker daemon, from the published image:

   ```sh
   kubectl -n seedling exec deploy/seedling -c web -- sh -c \
     'docker pull ghcr.io/arvoreeducacao/seedling-sandbox:latest && docker tag ghcr.io/arvoreeducacao/seedling-sandbox:latest seedling-sandbox:latest'
   ```

   or built from the source that ships inside the web image:

   ```sh
   kubectl -n seedling exec deploy/seedling -c web -- docker build -t seedling-sandbox:latest sandbox
   ```

   Repeat after upgrades that change `sandbox/`. Running sessions keep the image they started with.

6. Open the app host. While no account exists, the server log prints a one-time setup link (`kubectl -n seedling logs deploy/seedling -c web`), unless your email is in `SEEDLING_ADMIN_EMAILS`.

## Upgrading

```sh
kubectl -n seedling set image deployment/seedling web=ghcr.io/arvoreeducacao/seedling-web:<commit>
kubectl -n seedling rollout status deployment/seedling
```

A rollout restarts the pod and its Docker daemon, which stops every running sandbox. Check that no interview is in progress first: the Sessions page lists live sessions.

## Time zone

Dates follow the server's time zone. `NEXT_PUBLIC_SEEDLING_TIMEZONE` is read when the image is built, so to show another zone build the image yourself:

```sh
docker build --build-arg NEXT_PUBLIC_SEEDLING_TIMEZONE=Europe/Lisbon -t registry.example.com/seedling-web:custom .
```

# Kanidm Theme

CSS-only theme for Kanidm plus reproducible Playwright screenshots and visual regression checks. No Kanidm or kaniop fork.

## Version policy

**Use the latest Kanidm version adopted by the latest stable release of [kaniop](https://github.com/pando85/kaniop).** `ci/resolve-version.sh` queries GitHub's latest released kaniop tag, reads that tag's `Cargo.toml`, and requires its `kanidm_client` and `kanidm_proto` versions to match. The selected version is used for `kanidm/server` and `kanidm/tools` alike.

This intentionally does not follow Kanidm's `latest` image tag or unreleased kaniop commits. Currently kaniop `v0.23.0` selects Kanidm `1.12.1`.

```bash
bash ci/resolve-version.sh
```

If the manifest format changes or its versions disagree, the workflow fails rather than using an unverified release.

## Bouncer branding

The visible identity uses the Bouncer mark supplied for this theme. Its
transparent silhouette is traced in `assets/bouncer-mask.svg` and embedded as
an SVG data URI in `override.css`, since the deployed Kanidm server mounts only
that CSS file. The mask uses `--bs-heading-color` for both light and dark modes.

The theme replaces the logos on login, recovery, signup, credential-reset, and
authenticated navigation pages. It also removes the **Powered by Kanidm**
footer. Domain display names and navigation text are retained so that users
still know which identity domain they are using.

**CSS-only limitation:** Kanidm's HTML templates still provide browser tab
titles (including `- Kanidm`), favicon links, and some internal wording (such
as `Kanidm domain:`). CSS cannot safely rewrite those, so full removal of the
upstream product name needs separately supported server-side/template
configuration, not a misleading visual text substitution.

To change the logo in the future, update `assets/bouncer-mask.svg`, regenerate
the URL-encoded SVG data URI used by `--archaic-brand-mark`, and run
`node ci/check-logo.mjs`. PR visual checks produce screenshots for both
desktop color schemes and mobile.

## CI screenshots

GitHub Actions runs on push, pull request, Monday morning UTC, and manual dispatch. The workflow creates an isolated Kanidm container (with the actual `override.css` mounted), configures certificates, seeds synthetic identities and an OAuth2 app, and captures screenshots using three Chromium projects:

- Desktop (1440 × 900), light mode
- Desktop (1440 × 900), dark mode
- Pixel 7, light mode

Download the artifact named `kanidm-visuals-<run-id>` on the workflow run page. Extract it, open `index.html` for the gallery, or attach the ZIP to a ChatGPT conversation for visual review. The ZIP contains screenshots, `manifest.json`, the Playwright report, and any test diffs/traces.

### Visual regression baselines

The initial runs capture screenshots **without approved baselines**. Only once you review and commit reference images will CI perform pixel comparisons.

With Kanidm running locally and fixture credentials loaded:

```bash
UPDATE_BASELINES=1 npx playwright test --update-snapshots
```

Review and commit `tests/*-snapshots/*.png`. Future runs compare against those images.

Alternatively, run **Actions → Propose visual baselines → Run workflow**. It generates the screenshots against the currently compatible Kanidm release and attempts to open a PR containing the reference images for review. GitHub Actions must have permission to create pull requests in the repository settings. After you merge reviewed baselines, the regular visual workflow automatically requires that all covered states have baselines. Set `STRICT_VISUAL_BASELINES=1` if you also want to fail tests missing a reference image. Update baselines deliberately after expected changes or version upgrades.

## Running locally

Requires Docker, Node.js 22+, and Linux. No Kubernetes cluster or production credentials needed.

```bash
npm install
npx playwright install chromium
export KANIDM_VERSION="$(bash ci/resolve-version.sh | sed -n 's/.*kanidm\/server://p')"
bash ci/start.sh
bash ci/seed.sh
source .local/credentials.env
npx playwright test
node ci/build-gallery.mjs
bash ci/stop.sh
```

Open `index.html` to inspect the local gallery. The scripts assume that a disposable IdP is created on `localhost:8443` and will reset its test identities; never point them at production.

## Current coverage

Login (username, password), credential reset token entry, recovery/signup availability, populated app launcher, profile, credential settings, device enrolment, RADIUS settings, administrator persons and groups. Device-enrolment secrets/QR codes and random UUIDs are masked.

The suite does **not** yet cover the entire Kanidm UI state space: TOTP, passkey and backup-code challenges, OAuth2 consent, device authorization, and interactive signup/recovery scenarios need dedicated stateful fixtures. These will be added incrementally rather than claiming false coverage from a URL crawl.

## Deploy the CSS with kaniop

Add to the existing `Kanidm.spec`:

```yaml
spec:
  volumes:
    - name: ui-theme
      configMap:
        name: kanidm-theme
  volumeMounts:
    - name: ui-theme
      mountPath: /hpkg/override.css
      subPath: override.css
      readOnly: true
```

### Reusable Kustomize distribution

The repository root is a Kustomize base. It generates a content-hashed
`kanidm-theme` ConfigMap in namespace `kanidm` containing `override.css`.
Consumers can use this Git repository without publishing a container image
or copying CSS into their GitOps repositories.

In the consuming `kustomization.yaml`, add a `resources` entry pinned to a
**full commit SHA** (do not follow `main` automatically):

```yaml
resources:
  - https://github.com/archaic-work/kanidm-theme.git?ref=<40-character-commit-sha>
```

Keep the Kaniop volume reference at the *base* name `kanidm-theme`, not the
generated hashed name. Kustomize must be taught the CRD's ConfigMap reference
via the consuming project's `configurations` / `nameReference` rule:

```yaml
nameReference:
  - kind: ConfigMap
    version: v1
    fieldSpecs:
      - kind: Kanidm
        group: kaniop.rs
        version: v1beta1
        path: spec/volumes/configMap/name
```

Render the consuming overlay with `kustomize build` or `kubectl kustomize`
and verify `spec.volumes[].configMap.name` matches the generated ConfigMap.

To update: review and merge the theme changes, copy the new theme commit SHA
into the consuming GitOps repository, verify the rendered manifests, then
merge its separate deployment PR. A rollout is needed after CSS changes
because Kubernetes `subPath` mounts do not receive live ConfigMap updates.
Confirm Kaniop recreates the Kanidm Pod or restart it in a controlled
maintenance window.

## Security

Only synthetic CI accounts are used. Credentials are generated per run and masked in job logs. Do not publish traces or screenshots without checking for sensitive information; downloaded artifacts should remain with trusted collaborators. The generated container, database volume, and CLI token cache are removed at the end of a run.

## References

- [Kanidm container quickstart](https://github.com/kanidm/kanidm/blob/v1.12.1/book/src/evaluation_quickstart.md)
- [Kanidm UI templates](https://github.com/kanidm/kanidm/tree/v1.12.1/server/core/templates)
- [kaniop v0.23.0 dependency manifest](https://github.com/pando85/kaniop/blob/v0.23.0/Cargo.toml)

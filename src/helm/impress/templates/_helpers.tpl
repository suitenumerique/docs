{{/*
Expand the name of the chart.
*/}}
{{- define "impress.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "impress.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "impress.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
impress.labels
*/}}
{{- define "impress.labels" -}}
helm.sh/chart: {{ include "impress.chart" . }}
{{ include "impress.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "impress.selectorLabels" -}}
app.kubernetes.io/name: {{ include "impress.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
transform dictionary of environment variables
Usage : {{ include "impress.env.transformDict" .Values.envVars }}

Example:
envVars:
  # Using simple strings as env vars
  ENV_VAR_NAME: "envVar value"
  # Using a value from a configMap
  ENV_VAR_FROM_CM:
    configMapKeyRef:
      name: cm-name
      key: "key_in_cm"
  # Using a value from a secret
  ENV_VAR_FROM_SECRET:
    secretKeyRef:
      name: secret-name
      key: "key_in_secret"
*/}}
{{- define "impress.env.transformDict" -}}
{{- range $key, $value := . }}
- name: {{ $key | quote }}
{{- if $value | kindIs "map" }}
  valueFrom: {{ $value | toYaml | nindent 4 }}
{{- else }}
  value: {{ $value | quote }}
{{- end }}
{{- end }}
{{- end }}


{{/*
impress env vars
*/}}
{{- define "impress.common.env" -}}
{{- $topLevelScope := index . 0 -}}
{{- $workerScope := index . 1 -}}
{{- include "impress.env.transformDict" $workerScope.envVars -}}
{{- end }}

{{/*
impress backend django env vars - combines common backend.envVars with backend.django.envVars
*/}}
{{- define "impress.backend.django.env" -}}
{{- $topLevelScope := index . 0 -}}
{{- $workerScope := index . 1 -}}
{{- include "impress.env.transformDict" $workerScope.envVars -}}
{{- include "impress.env.transformDict" (($workerScope.django | default dict).envVars | default dict) -}}
{{- end }}

{{/*
impress celery env vars - combines common backend.envVars with backend.celery.envVars
*/}}
{{- define "impress.backend.celery.env" -}}
{{- $topLevelScope := index . 0 -}}
{{- $workerScope := index . 1 -}}
{{- include "impress.env.transformDict" $workerScope.envVars -}}
{{- include "impress.env.transformDict" ($workerScope.celery.envVars | default dict) -}}
{{- end }}

{{/*
Common labels

Requires array with top level scope and component name
*/}}
{{- define "impress.common.labels" -}}
{{- $topLevelScope := index . 0 -}}
{{- $component := index . 1 -}}
{{- include "impress.labels" $topLevelScope }}
app.kubernetes.io/component: {{ $component }}
{{- end }}

{{/*
Common selector labels

Requires array with top level scope and component name
*/}}
{{- define "impress.common.selectorLabels" -}}
{{- $topLevelScope := index . 0 -}}
{{- $component := index . 1 -}}
{{- include "impress.selectorLabels" $topLevelScope }}
app.kubernetes.io/component: {{ $component }}
{{- end }}

{{- define "impress.probes.abstract" -}}
{{- if .exec -}}
exec:
{{- toYaml .exec | nindent 2 }}
{{- else if .tcpSocket -}}
tcpSocket:
{{- toYaml .tcpSocket | nindent 2 }}
{{- else -}}
httpGet:
  path: {{ .path }}
  port: {{ .targetPort }}
{{- end }}
initialDelaySeconds: {{ .initialDelaySeconds | eq nil | ternary 0 .initialDelaySeconds }}
timeoutSeconds: {{ .timeoutSeconds | eq nil | ternary 1 .timeoutSeconds }}
{{- end }}

{{/*
Full name for the backend

Requires top level scope
*/}}
{{- define "impress.backend.fullname" -}}
{{ include "impress.fullname" . }}-backend
{{- end }}

{{/*
Full name for the frontend

Requires top level scope
*/}}
{{- define "impress.frontend.fullname" -}}
{{ include "impress.fullname" . }}-frontend
{{- end }}

{{/*
Full name for the Posthog

Requires top level scope
*/}}
{{- define "impress.posthog.fullname" -}}
{{ include "impress.fullname" . }}-posthog
{{- end }}

{{/*
Full name for the yProvider

Requires top level scope
*/}}
{{- define "impress.yProvider.fullname" -}}
{{ include "impress.fullname" . }}-y-provider
{{- end }}

{{/*
Full name for the docSpec

Requires top level scope
*/}}
{{- define "impress.docSpec.fullname" -}}
{{ include "impress.fullname" . }}-docspec
{{- end }}

{{/*
Full name for the yhub collaboration server

Requires top level scope
*/}}
{{- define "impress.yhub.fullname" -}}
{{ include "impress.fullname" . }}-yhub
{{- end }}

{{/*
Full name for the yhub worker, when it is deployed apart from the server

Requires top level scope
*/}}
{{- define "impress.yhub.worker.fullname" -}}
{{ include "impress.yhub.fullname" . }}-worker
{{- end }}

{{/*
yhub worker env vars - combines common yhub.envVars with yhub.worker.envVars

Merged rather than appended: a variable the worker sets differently from the
server (YHUB_TASK_CONCURRENCY, typically) is meant to replace it, and emitting
both would leave the value to kubernetes' last-one-wins rule and show the
variable twice in the pod. deepCopy because merge writes into its first
argument, which is a live values map.
*/}}
{{- define "impress.yhub.worker.env" -}}
{{- $topLevelScope := index . 0 -}}
{{- $workerScope := index . 1 -}}
{{- $workerEnvVars := ($workerScope.worker | default dict).envVars | default dict -}}
{{- include "impress.env.transformDict" (merge (deepCopy $workerEnvVars) $workerScope.envVars) -}}
{{- end }}

{{/*
The role a yhub pod runs, as an environment variable. Only when the worker is
deployed apart: a single deployment runs both halves, which is what yhub does
when the variable is absent. Skipped when the deployment names the role itself,
in either env map — an explicit value wins, as everywhere else here.

Usage: {{ include "impress.yhub.roleEnv" (dict "root" $ "role" "server") }}
*/}}
{{- define "impress.yhub.roleEnv" -}}
{{- $root := .root -}}
{{- $named := merge (dict) (($root.Values.yhub.worker | default dict).envVars | default dict) ($root.Values.yhub.envVars | default dict) -}}
{{- if and $root.Values.yhub.worker.enabled (not (hasKey $named "YHUB_ROLE")) }}
- name: "YHUB_ROLE"
  value: {{ .role | quote }}
{{- end }}
{{- end }}

{{/*
JWT signing keys — the RSA keys the services sign the calls they make to each
other with. The jwt-keys job generates them once into a secret every service
mounts read-only, so no key is ever templated into a manifest, written in a
values file, or kept anywhere the services themselves can write.

Requires top level scope
*/}}
{{- define "impress.jwtKeys.secretName" -}}
{{- .Values.jwtKeys.existingSecret | default (printf "%s-jwt-keys" (include "impress.fullname" .)) -}}
{{- end }}

{{- define "impress.jwtKeys.serviceAccountName" -}}
{{- .Values.jwtKeys.job.serviceAccountName | default (printf "%s-jwt-keys" (include "impress.fullname" .)) -}}
{{- end }}

{{- define "impress.jwtKeys.backendPath" -}}
{{ .Values.jwtKeys.mountPath }}/{{ .Values.jwtKeys.backendKeyFilename }}
{{- end }}

{{- define "impress.jwtKeys.yhubPath" -}}
{{ .Values.jwtKeys.mountPath }}/{{ .Values.jwtKeys.yhubKeyFilename }}
{{- end }}

{{/*
The volume holding the keys. A pod referencing a secret that does not exist yet
stays in ContainerCreating and mounts it as soon as the job creates it, so
nothing else is needed to order the two.

Requires top level scope
*/}}
{{- define "impress.jwtKeys.volume" -}}
- name: jwt-keys
  secret:
    secretName: {{ include "impress.jwtKeys.secretName" . }}
    # read-only for everyone, as the files the job generates are
    defaultMode: 0444
{{- end }}

{{- define "impress.jwtKeys.volumeMount" -}}
- name: jwt-keys
  mountPath: {{ .Values.jwtKeys.mountPath }}
  readOnly: true
{{- end }}

{{/*
`*_FILE` environment variables pointing at the keys, added only when the
deployment did not set them by hand — configuring a key of your own stays
possible, and wins.

Requires top level scope
*/}}
{{- define "impress.jwtKeys.backendEnv" -}}
{{- if not (hasKey (.Values.backend.envVars | default dict) "JWT_PRIVATE_KEY_FILE") }}
- name: "JWT_PRIVATE_KEY_FILE"
  value: {{ include "impress.jwtKeys.backendPath" . | quote }}
{{- end }}
{{- end }}

{{- define "impress.jwtKeys.yhubEnv" -}}
{{- if not (hasKey (.Values.yhub.envVars | default dict) "YHUB_JWT_PRIVATE_KEY_FILE") }}
- name: "YHUB_JWT_PRIVATE_KEY_FILE"
  value: {{ include "impress.jwtKeys.yhubPath" . | quote }}
{{- end }}
{{- end }}


{{/*
Full name for the Celery Worker

Requires top level scope
*/}}


{{- define "impress.celery.worker.fullname" -}}
{{ include "impress.fullname" . }}-celery-worker
{{- end }}

{{/*
Usage : {{ include "impress.secret.dockerconfigjson.name" (dict "fullname" (include "impress.fullname" .) "imageCredentials" .Values.path.to.the.image1) }}
*/}}
{{- define "impress.secret.dockerconfigjson.name" }}
{{- if (default (dict) .imageCredentials).name }}{{ .imageCredentials.name }}{{ else }}{{ .fullname | trunc 63 | trimSuffix "-" }}-dockerconfig{{ end -}}
{{- end }}

{{/*
Usage : {{ include "impress.secret.dockerconfigjson" (dict "fullname" (include "impress.fullname" .) "imageCredentials" .Values.path.to.the.image1) }}
*/}}
{{- define "impress.secret.dockerconfigjson" }}
{{- if .imageCredentials -}}
apiVersion: v1
kind: Secret
metadata:
  name: {{ template "impress.secret.dockerconfigjson.name" (dict "fullname" .fullname "imageCredentials" .imageCredentials) }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: {{ template "impress.secret.dockerconfigjson.data" .imageCredentials }}
{{- end -}}
{{- end }}

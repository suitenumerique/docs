{{/*
Spread the pods of one role across nodes when possible, instead of the
operator's hard anti-affinity. Takes a dict with the instance `name` and the
pod `type` (failover or sentinel).
*/}}
{{- define "valkey.softAntiAffinity" -}}
podAntiAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        topologyKey: kubernetes.io/hostname
        labelSelector:
          matchLabels:
            buf.red/name: {{ .name }}
            buf.red/type: {{ .type }}
{{- end }}
